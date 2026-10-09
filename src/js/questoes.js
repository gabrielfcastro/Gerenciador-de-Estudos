// ── Caderno de questões: estado, servidor e tela ──────────────────────────────
// As regras ficam em questoes-logica.js (puras e testadas) e o HTML em
// questoes-visual.js. Este módulo só junta as peças: guarda o estado, fala com
// o servidor e escreve o resultado na tela.

import { Api } from './api.js';
import { getCategories } from './categories.js';
import { buildCsel, registerCsel } from './csel.js';
import { toast, confirmar } from './ui.js';
import * as L from './questoes-logica.js';
import * as V from './questoes-visual.js';

const PAGINA = 30;
const SEM_CONEXAO = 'Sem conexão com o servidor.';
const $ = (id) => document.getElementById(id);

const estado = {
  questoes: [],
  filtros: { ...L.FILTRO_VAZIO },
  limite: PAGINA,
  refazer: null,
  respondendo: false,
  salvando: false,
  focoAnterior: null,
  form: { id: null, tipo: 'ME', gabarito: '', materia: null },
};

// Matérias do formulário: as do app + as que já existem no caderno (um novo ciclo zera as do app).
const opcoesDeMateria = () => L.opcoesDeMateria(getCategories(), estado.questoes);

function materiaDoFiltro(nome) {
  const o = nome ? opcoesDeMateria().find(x => L.normalizar(x.name) === L.normalizar(nome)) : null;
  return o ? { nome: o.name, cor: o.color } : (nome ? { nome, cor: '' } : null);
}

registerCsel('q-csel', {
  onSelect: (id) => {
    const o = id ? opcoesDeMateria().find(x => x.id === Number(id)) : null;
    estado.form.materia = o ? { nome: o.name, cor: o.color } : null;
    limparErro('materia');
    atualizarSugestoes();
  },
  getCategories: opcoesDeMateria,
});

async function mensagemDeErro(resp, padrao) {
  try { return (await resp.json()).error || padrao; } catch { return padrao; }
}

// ═══════════════════════════ lista e filtros ═══════════════════════════
export async function carregarQuestoes() {
  try {
    estado.questoes = await Api.getQuestions();
  } catch {
    toast('Não consegui carregar as questões.', 'erro');
    return;
  }
  desenharLista();
}

function desenharLista() {
  estado.filtros = L.sanearFiltros(estado.questoes, estado.filtros);
  const f = estado.filtros;
  const vazio = estado.questoes.length === 0;

  $('q-filtros').hidden = vazio;
  $('q-painel').hidden = vazio;
  $('q-painel').innerHTML = vazio ? '' : V.htmlPainel(L.resumoGeral(estado.questoes), f.situacao);
  $('qf-materia').innerHTML = V.htmlOpcoes(L.opcoesDoFiltro(estado.questoes, f, 'materia'), 'Todas as matérias', f.materia);
  $('qf-assunto').innerHTML = V.htmlOpcoes(L.opcoesDoFiltro(estado.questoes, f, 'assunto'), 'Todos os assuntos', f.assunto);
  $('qf-banca').innerHTML = V.htmlOpcoes(L.opcoesDoFiltro(estado.questoes, f, 'banca'), 'Todas as bancas', f.banca);
  $('qf-tipo').innerHTML = V.htmlSegTipo(L.contarPorTipo(estado.questoes, f), f.tipo);
  $('qf-erradas').checked = f.situacao === 'revisar';
  $('qf-limpar').hidden = !L.temFiltroAtivo(f);

  const lista = L.filtrar(estado.questoes, f);
  $('q-acoes-topo').innerHTML = vazio ? '' : V.htmlTopoAcoes(lista.length);

  const alvo = $('q-resultado');
  if (vazio) { alvo.innerHTML = V.htmlVazioCaderno(); return; }
  if (!lista.length) { alvo.innerHTML = V.htmlSemResultados(); return; }

  const visiveis = lista.slice(0, estado.limite);
  alvo.innerHTML = V.htmlContagemOculta(lista.length)
    + `<div class="q-lista">${visiveis.map(V.htmlLinha).join('')}</div>`
    + (lista.length > visiveis.length ? V.htmlMostrarMais(lista.length - visiveis.length) : '');
}

function mudarFiltros(novos) {
  estado.filtros = { ...estado.filtros, ...novos };
  estado.limite = PAGINA;
  desenharLista();
}

// ═══════════════════════════ modo refazer ═══════════════════════════
function atualizada(q) {
  return estado.questoes.find(x => x.id === q.id) || q;
}

function abrirRefazer(fila) {
  estado.refazer = L.estadoInicialRefazer(fila);
  $('q-tela-lista').hidden = true;
  $('q-tela-refazer').hidden = false;
  $('view-questoes').scrollTop = 0;
  desenharRefazer();
}

function desenharRefazer(foco) {
  const e = estado.refazer;
  if (!e) return;
  const tela = $('q-tela-refazer');
  tela.innerHTML = e.fim ? V.htmlFim(e) : V.htmlCartaoRefazer(e);
  for (const seletor of [].concat(foco || [])) {                 // o primeiro que existir e estiver habilitado
    const alvo = tela.querySelector(seletor);
    if (alvo && !alvo.disabled && alvo.focus) { alvo.focus(); break; }
  }
}

function registrarResultadoLocal(id, r) {
  const q = estado.questoes.find(x => x.id === id);
  if (q) {
    q.tentativas = r.tentativas; q.acertos = r.acertos; q.ultima_acertou = r.acertou;
    q.acertos_seguidos = r.acertos_seguidos; q.ultima_respondida_em = r.ultima_respondida_em;
  }
}

async function responder() {
  if (estado.respondendo || !estado.refazer || estado.refazer.respondida) return;
  const pedido = L.pedirResposta(estado.refazer);
  estado.refazer = pedido.estado;
  if (!pedido.pode) { desenharRefazer(); return; }

  const q = L.questaoAtual(estado.refazer);
  estado.respondendo = true;
  try {
    const resp = await Api.answerQuestion(q.id, L.respostaMarcada(estado.refazer));
    if (!resp.ok) { toast(await mensagemDeErro(resp, 'Não consegui registrar a resposta.'), 'erro'); return; }
    const resultado = await resp.json();
    estado.refazer = L.aplicarResultado(estado.refazer, resultado);
    registrarResultadoLocal(q.id, resultado);
    desenharRefazer('[data-foco="proxima"]');
  } catch {
    toast(SEM_CONEXAO, 'erro');
  } finally {
    estado.respondendo = false;
  }
}

async function sair() {
  estado.refazer = null;
  $('q-tela-refazer').hidden = true;
  $('q-tela-lista').hidden = false;
  await carregarQuestoes();
}

// ═══════════════════════════ formulário ═══════════════════════════
const ERRO_DO_CAMPO = {
  materia: 'qm-erro-materia', enunciado: 'qm-erro-enunciado', alternativas: 'qm-erro-alternativas',
  gabarito: 'qm-erro-gabarito', assunto: 'qm-erro-assunto', banca: 'qm-erro-banca',
};
const CONTROLE_DO_CAMPO = {
  materia: 'q-csel-trigger', enunciado: 'qm-enunciado', alternativas: 'qm-alt-0', assunto: 'qm-assunto', banca: 'qm-banca',
};
const ORDEM_DE_FOCO = ['materia', 'enunciado', 'alternativas', 'assunto', 'banca'];

function limparErro(campo) {
  $(ERRO_DO_CAMPO[campo]).textContent = '';
  if (CONTROLE_DO_CAMPO[campo]) $(CONTROLE_DO_CAMPO[campo]).setAttribute('aria-invalid', 'false');
}

function limparErros() { Object.keys(ERRO_DO_CAMPO).forEach(limparErro); }

function mostrarErros(erros) {
  limparErros();
  for (const [campo, msg] of Object.entries(erros)) {
    $(ERRO_DO_CAMPO[campo]).textContent = msg;
    if (CONTROLE_DO_CAMPO[campo]) $(CONTROLE_DO_CAMPO[campo]).setAttribute('aria-invalid', 'true');
  }
  const primeiro = ORDEM_DE_FOCO.find(c => erros[c]);
  if (primeiro && CONTROLE_DO_CAMPO[primeiro]) $(CONTROLE_DO_CAMPO[primeiro]).focus();
}

function lerAlternativas() {
  return [0, 1, 2, 3, 4].map(i => $('qm-alt-' + i).value || '');
}

function escreverAlternativas(valores) {
  [0, 1, 2, 3, 4].forEach(i => { $('qm-alt-' + i).value = valores[i] ?? ''; });
}

function desenharAlternativasForm(valores) {
  const gabarito = estado.form.tipo === 'ME' ? estado.form.gabarito : '';
  $('qm-alts').innerHTML = V.htmlAlternativasForm(valores, gabarito);
  escreverAlternativas(valores);
}

function aplicarTipoNoFormulario() {
  const ehCE = estado.form.tipo === 'CE';
  $('qm-tipo-me').setAttribute('aria-checked', String(!ehCE));
  $('qm-tipo-ce').setAttribute('aria-checked', String(ehCE));
  $('qm-bloco-me').hidden = ehCE;
  $('qm-bloco-ce').hidden = !ehCE;
  $('qm-ce-c').setAttribute('aria-checked', String(ehCE && estado.form.gabarito === 'C'));
  $('qm-ce-e').setAttribute('aria-checked', String(ehCE && estado.form.gabarito === 'E'));
  if (!ehCE) desenharAlternativasForm(lerAlternativas());
}

function mostrarMateriaNoCsel() {
  const opcoes = opcoesDeMateria();
  const m = estado.form.materia;
  const o = m ? opcoes.find(x => L.normalizar(x.name) === L.normalizar(m.nome)) : null;
  if (o) estado.form.materia = { nome: o.name, cor: o.color };      // vale o nome e a cor de hoje
  buildCsel('q-csel', opcoes, o ? o.id : null);
  const dot = $('q-csel-dot'), texto = $('q-csel-text');
  if (o) {
    dot.style.display = 'inline-block';
    dot.style.background = o.color;
    texto.textContent = o.name;
    texto.classList.remove('placeholder');
  } else {
    dot.style.display = 'none';
    texto.textContent = '— Escolha uma matéria —';
    texto.classList.add('placeholder');
  }
}

function atualizarSugestoes() {
  const opcoes = (valores) => valores.map(v => `<option value="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"></option>`).join('');
  $('qm-dl-assuntos').innerHTML = opcoes(L.sugestoes(estado.questoes, 'assunto', estado.form.materia ? estado.form.materia.nome : null));
  $('qm-dl-bancas').innerHTML = opcoes(L.sugestoes(estado.questoes, 'banca', null));
}

function lerFormulario() {
  return {
    materia_nome: estado.form.materia ? estado.form.materia.nome : '',
    materia_cor: estado.form.materia ? estado.form.materia.cor : '',
    tipo: estado.form.tipo,
    enunciado: $('qm-enunciado').value,
    alternativas: lerAlternativas(),
    gabarito: estado.form.gabarito,
    assunto: $('qm-assunto').value,
    banca: $('qm-banca').value,
    justificativa: $('qm-justificativa').value,
  };
}

function abrirFormulario(id) {
  const q = id == null ? null : estado.questoes.find(x => x.id === id);
  if (id != null && !q) return;
  const f = estado.filtros;
  estado.form = {
    id: q ? q.id : null,
    tipo: q ? q.tipo : (f.tipo === 'CE' ? 'CE' : 'ME'),
    gabarito: q ? q.gabarito : '',
    materia: q ? { nome: q.materia_nome, cor: q.materia_cor } : materiaDoFiltro(f.materia),
  };
  estado.focoAnterior = document.activeElement;
  $('qm-titulo').textContent = q ? 'Editar questão' : 'Nova questão';
  $('qm-enunciado').value = q ? q.enunciado : '';
  $('qm-assunto').value = q ? q.assunto : (f.assunto || '');
  $('qm-banca').value = q ? q.banca : (f.banca || '');
  $('qm-justificativa').value = q ? q.justificativa : '';
  desenharAlternativasForm(q ? q.alternativas : []);
  aplicarTipoNoFormulario();
  mostrarMateriaNoCsel();
  limparErros();
  atualizarSugestoes();
  $('qm-excluir').hidden = !q;
  $('qm-salvar-outra').hidden = Boolean(q);
  $('q-form-modal').classList.add('open');
  $('qm-enunciado').focus();
}

function fecharFormulario() {
  $('q-form-modal').classList.remove('open');
  const anterior = estado.focoAnterior;
  if (anterior && anterior.focus) anterior.focus();
}

/** Depois de "salvar e adicionar outra": mantém matéria, assunto, banca e tipo; limpa o resto. */
function prepararProxima(payload) {
  estado.form = { id: null, tipo: payload.tipo, gabarito: '', materia: { nome: payload.materia_nome, cor: payload.materia_cor } };
  $('qm-enunciado').value = '';
  $('qm-justificativa').value = '';
  $('qm-assunto').value = payload.assunto;
  $('qm-banca').value = payload.banca;
  desenharAlternativasForm([]);
  aplicarTipoNoFormulario();
  mostrarMateriaNoCsel();
  limparErros();
  atualizarSugestoes();
  $('qm-enunciado').focus();
}

async function salvarFormulario(outra) {
  if (estado.salvando) return;
  const dados = lerFormulario();
  const validacao = L.validarFormulario(dados);
  if (!validacao.ok) { mostrarErros(validacao.erros); return; }
  const payload = L.montarPayload(dados);

  estado.salvando = true;
  try {
    const resp = estado.form.id == null
      ? await Api.createQuestion(payload)
      : await Api.updateQuestion(estado.form.id, payload);
    if (!resp.ok) { toast(await mensagemDeErro(resp, 'Não consegui salvar a questão.'), 'erro'); return; }
    toast('Questão salva.', 'ok');
    await carregarQuestoes();
    if (outra) prepararProxima(payload); else fecharFormulario();
  } catch {
    toast(SEM_CONEXAO, 'erro');
  } finally {
    estado.salvando = false;
  }
}

async function apagar(id) {
  const ok = await confirmar('A questão e o histórico de tentativas dela serão apagados.',
    { titulo: 'Excluir questão?', confirmar: 'Excluir', perigo: true });
  if (!ok) return false;
  try {
    const resp = await Api.deleteQuestion(id);
    if (!resp.ok) { toast(await mensagemDeErro(resp, 'Não consegui excluir a questão.'), 'erro'); return false; }
  } catch {
    toast(SEM_CONEXAO, 'erro');
    return false;
  }
  toast('Questão excluída.', 'ok');
  await carregarQuestoes();
  return true;
}

// ═══════════════════════════ API pública da tela ═══════════════════════════
export const Questoes = {
  // filtros
  filtro: (campo, valor) => mudarFiltros({ [campo]: valor }),
  tipo: (valor) => mudarFiltros({ tipo: valor }),
  // "Só as que errei" e o cartão "Para revisar" são a mesma coisa vista de dois lugares
  somenteErradas: (ligado) => mudarFiltros({ situacao: ligado ? 'revisar' : (estado.filtros.situacao === 'revisar' ? '' : estado.filtros.situacao) }),
  situacao: (valor) => mudarFiltros({ situacao: (valor === 'todas' || estado.filtros.situacao === valor) ? '' : valor }),
  buscar: (texto) => mudarFiltros({ busca: String(texto || '').trim() }),
  limpar() {
    $('qf-busca').value = '';
    mudarFiltros({ ...L.FILTRO_VAZIO });
  },
  mostrarMais() { estado.limite += PAGINA; desenharLista(); },

  // lista
  abrirNovo: () => abrirFormulario(null),
  abrir: (id) => abrirFormulario(id),
  excluir: (id) => apagar(id),

  // modo refazer
  iniciarRefazer() {
    const lista = L.filtrar(estado.questoes, estado.filtros);
    if (!lista.length) { toast('Nenhuma questão nos filtros atuais.', 'erro'); return; }
    abrirRefazer(L.embaralhar(lista));
  },
  /** A fila da revisão espaçada: o que errou + o que venceu. Ignora os filtros da lista. */
  revisarHoje() {
    const fila = estado.questoes.filter(q => ['revisar', 'vencidas'].includes(L.situacaoDe(q)));
    if (!fila.length) { toast('Nada para revisar hoje.', 'ok'); return; }
    abrirRefazer(L.embaralhar(fila));
  },
  cortar(i) { estado.refazer = L.alternarCorte(estado.refazer, i); desenharRefazer(`.q-tesoura[data-alt="${i}"]`); },
  marcar(i) { estado.refazer = L.marcarAlternativa(estado.refazer, i); desenharRefazer(`.q-alt-corpo[data-alt="${i}"]`); },
  responder,
  proxima() { estado.refazer = L.proxima(estado.refazer); desenharRefazer(); },
  anterior() { if (!estado.refazer) return; estado.refazer = L.anterior(estado.refazer); desenharRefazer(['[data-nav="anterior"]', '[data-nav="seguinte"]']); },
  seguinte() { if (!estado.refazer) return; estado.refazer = L.seguinte(estado.refazer); desenharRefazer(['[data-nav="seguinte"]', '[data-nav="anterior"]']); },
  irParaPulada() { estado.refazer = L.irParaPrimeiraPulada(estado.refazer); desenharRefazer(); },
  refazerEsta() { estado.refazer = L.refazerEsta(estado.refazer); desenharRefazer(); },
  refazerErradas() { abrirRefazer(L.embaralhar(L.filaDasErradas(estado.refazer).map(atualizada))); },
  refazerTudo() { abrirRefazer(L.embaralhar(estado.refazer.fila.map(atualizada))); },
  sair,

  // formulário
  definirTipo(tipo) {
    if (estado.form.tipo === tipo) return;
    estado.form.tipo = tipo;
    estado.form.gabarito = '';          // a letra "C" de múltipla escolha não é o "Certo"
    limparErro('gabarito');
    aplicarTipoNoFormulario();
  },
  marcarGabarito(valor) {
    estado.form.gabarito = valor;
    limparErro('gabarito');
    if (estado.form.tipo === 'ME') desenharAlternativasForm(lerAlternativas()); else aplicarTipoNoFormulario();
  },
  editou: (campo) => limparErro(campo),
  salvar: () => salvarFormulario(false),
  salvarEOutra: () => salvarFormulario(true),
  fecharFormulario,
  async excluirDoFormulario() {
    if (estado.form.id == null) return;
    if (await apagar(estado.form.id)) fecharFormulario();
  },
};

export function inicializarQuestoes() {
  $('q-form-modal').addEventListener('click', (e) => { if (e.target === $('q-form-modal')) fecharFormulario(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {            // setas navegam entre as questões da rodada
      const r = estado.refazer;
      if (!r || r.fim || $('q-tela-refazer').hidden || $('q-form-modal').classList.contains('open')) return;
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;   // não atrapalha quem digita
      if (document.querySelector && document.querySelector('[role="alertdialog"]')) return;
      e.preventDefault();
      if (e.key === 'ArrowLeft') Questoes.anterior(); else Questoes.seguinte();
      return;
    }
    if (e.key !== 'Escape' || !$('q-form-modal').classList.contains('open')) return;
    if (document.querySelector && document.querySelector('[role="alertdialog"]')) return;   // o "Escape" é do diálogo de confirmação
    fecharFormulario();
  });
}