import test from 'node:test';
import assert from 'node:assert/strict';

// ── DOM falso: o bastante pra rodar o app sem navegador ─────────────────────
class El {
  constructor(tag = 'div') {
    this.tag = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.className = '';
    this.innerHTML = ''; this.textContent = ''; this.value = ''; this.checked = false; this.hidden = false;
    this.style = {}; this.parent = null; this._cls = new Set();
    this.classList = {
      add: (c) => this._cls.add(c), remove: (c) => this._cls.delete(c), contains: (c) => this._cls.has(c),
      toggle: (c, f) => { (f === undefined ? !this._cls.has(c) : f) ? this._cls.add(c) : this._cls.delete(c); },
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter(x => x !== f); }
  click() { (this.listeners.click || []).slice().forEach(f => f({ target: this })); }
  focus() { document.activeElement = this; }
  closest() { return null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const registro = new Map(); const criados = []; const docListeners = {};
globalThis.document = {
  activeElement: null, body: new El('body'), documentElement: new El('html'),
  getElementById(id) { if (!registro.has(id)) registro.set(id, new El()); return registro.get(id); },
  createElement(tag) { const e = new El(tag); criados.push(e); return e; },
  querySelectorAll: () => [],
  addEventListener(t, f) { (docListeners[t] ||= []).push(f); },
  removeEventListener(t, f) { docListeners[t] = (docListeners[t] || []).filter(x => x !== f); },
};
globalThis.window = { addEventListener() {} };
const el = (id) => document.getElementById(id);

// ── servidor falso, com as mesmas regras do de verdade ───────────────────────
const CATS = [{ id: 1, name: 'Dir. Financeiro', color: '#d4537e' }, { id: 2, name: 'Contabilidade', color: '#1d9e75' }];
const Qs = (o = {}) => ({
  id: 1, materia_nome: 'Dir. Financeiro', materia_cor: '#d4537e', assunto: 'Restos a pagar', banca: 'FCC',
  tipo: 'ME', enunciado: 'Qual está certa?', alternativas: ['um', 'dois', 'tres'], gabarito: 'B', justificativa: 'Porque sim.',
  tentativas: 0, acertos: 0, ultima_acertou: null, ...o,
});
let servidor;
function novoServidor(questoes = []) { servidor = { questoes: questoes.map(q => ({ ...q })), chamadas: [], erro: null, proximoId: 100 }; }
const chamadas = (metodo, caminho) => servidor.chamadas.filter(c => c.metodo === metodo && c.caminho === caminho);
globalThis.fetch = async (url, opts = {}) => {
  const metodo = opts.method || 'GET', caminho = url.replace('http://localhost:8000/api', '');
  const corpo = opts.body ? JSON.parse(opts.body) : null;
  servidor.chamadas.push({ metodo, caminho, corpo });
  const r = (status, dados) => ({ ok: status < 400, status, json: async () => dados });
  if (caminho === '/categories') return r(200, CATS);
  if (caminho === '/questions' && metodo === 'GET') return r(200, servidor.questoes);
  if (caminho === '/questions' && metodo === 'POST') {
    if (servidor.erro) return r(422, { error: servidor.erro });
    const nova = Qs({ ...corpo, id: servidor.proximoId++ });
    servidor.questoes.unshift(nova); return r(201, nova);
  }
  if (caminho === '/questions/answer') {
    const q = servidor.questoes.find(x => x.id === corpo.question_id);
    const acertou = q.gabarito === corpo.resposta;
    q.tentativas += 1; q.acertos += acertou ? 1 : 0; q.ultima_acertou = acertou;
    q.acertos_seguidos = acertou ? (q.acertos_seguidos || 0) + 1 : 0;
    q.ultima_respondida_em = servidor.agora || new Date().toISOString().slice(0, 19).replace('T', ' ');
    return r(200, { acertou, gabarito: q.gabarito, justificativa: q.justificativa, tentativas: q.tentativas, acertos: q.acertos,
                    acertos_seguidos: q.acertos_seguidos, ultima_respondida_em: q.ultima_respondida_em });
  }
  const m = caminho.match(/^\/questions\/(\d+)$/);
  if (m && metodo === 'PUT') { const q = servidor.questoes.find(x => x.id === Number(m[1])); Object.assign(q, corpo); return r(200, q); }
  if (m && metodo === 'DELETE') { servidor.questoes = servidor.questoes.filter(x => x.id !== Number(m[1])); return r(200, { ok: true }); }
  return r(200, {});
};

const { loadCategories } = await import('../src/js/categories.js');
const csel = await import('../src/js/csel.js');
const { Questoes, carregarQuestoes, inicializarQuestoes } = await import('../src/js/questoes.js');
novoServidor();            // o servidor falso precisa existir antes de carregar as matérias
await loadCategories();
inicializarQuestoes();

async function iniciar(questoes) {
  novoServidor(questoes);
  Questoes.limpar();
  el('q-tela-lista').hidden = false; el('q-tela-refazer').hidden = true;
  await carregarQuestoes();
}
const confirmarNoModal = (aceitar) => {
  const botoes = criados.slice().reverse();
  botoes.find(b => b.className.includes(aceitar ? 'btn-confirmar' : 'btn-cancelar')).click();
};
const ultimoToast = () => { const c = el('toast-root').children; return c[c.length - 1]; };
const linhas = () => (el('q-resultado').innerHTML.match(/class="q-linha"/g) || []).length;
const MUITAS = (n) => Array.from({ length: n }, (_, i) => Qs({ id: i + 1, enunciado: `Questão número ${i + 1}` }));

// ── lista e filtros ─────────────────────────────────────────────────────────
test('carregar: desenha as questões e mostra o painel de filtros', async () => {
  await iniciar([Qs({ id: 1, enunciado: 'Primeiro enunciado' }), Qs({ id: 2, enunciado: 'Segundo enunciado' })]);
  assert.match(el('q-resultado').innerHTML, /Primeiro enunciado/);
  assert.equal(linhas(), 2);
  assert.equal(el('q-filtros').hidden, false);
  assert.match(el('q-acoes-topo').innerHTML, /aria-label="Resolver 2 questões"/);
});

test('caderno vazio: mostra o convite e esconde os filtros', async () => {
  await iniciar([]);
  assert.match(el('q-resultado').innerHTML, /Seu caderno está vazio/);
  assert.equal(el('q-filtros').hidden, true);
  assert.ok(!el('q-acoes-topo').innerHTML.includes('Refazer'));
});

test('filtro por matéria reduz a lista e as opções de assunto', async () => {
  await iniciar([Qs({ id: 1, materia_nome: 'Dir. Financeiro', assunto: 'Restos a pagar' }), Qs({ id: 2, materia_nome: 'Contabilidade', assunto: 'Depreciação' })]);
  Questoes.filtro('materia', 'Contabilidade');
  assert.equal(linhas(), 1);
  assert.match(el('qf-assunto').innerHTML, /Depreciação/);
  assert.ok(!el('qf-assunto').innerHTML.includes('Restos a pagar'));
});

test('trocar de matéria some com o assunto que não existe nela', async () => {
  await iniciar([Qs({ id: 1, materia_nome: 'Dir. Financeiro', assunto: 'Restos a pagar' }), Qs({ id: 2, materia_nome: 'Contabilidade', assunto: 'Depreciação' })]);
  Questoes.filtro('materia', 'Dir. Financeiro'); Questoes.filtro('assunto', 'Restos a pagar');
  Questoes.filtro('materia', 'Contabilidade');
  assert.match(el('q-resultado').innerHTML, /Depreciação/);
});

test('sem resultados: mostra o aviso e "limpar" traz tudo de volta', async () => {
  await iniciar([Qs({ id: 1 }), Qs({ id: 2 })]);
  Questoes.buscar('texto que não existe');
  assert.match(el('q-resultado').innerHTML, /Nenhuma questão com esses filtros/);
  assert.equal(el('qf-limpar').hidden, false);
  Questoes.limpar();
  assert.equal(linhas(), 2);
  assert.equal(el('qf-limpar').hidden, true);
  assert.equal(el('qf-busca').value, '');
});

test('"só as que errei" mostra apenas as com última tentativa errada', async () => {
  await iniciar([Qs({ id: 1, ultima_acertou: false, tentativas: 1 }), Qs({ id: 2, ultima_acertou: true, tentativas: 1 }), Qs({ id: 3 })]);
  Questoes.somenteErradas(true);
  assert.equal(linhas(), 1);
});

test('filtro de tipo', async () => {
  await iniciar([Qs({ id: 1 }), Qs({ id: 2, tipo: 'CE', alternativas: [], gabarito: 'C' })]);
  Questoes.tipo('CE');
  assert.equal(linhas(), 1);
});

test('paginação: mostra 30 e libera mais sob demanda', async () => {
  await iniciar(MUITAS(35));
  assert.equal((el('q-resultado').innerHTML.match(/class="q-linha"/g) || []).length, 30);
  assert.match(el('q-resultado').innerHTML, /Mostrar mais \(5\)/);
  Questoes.mostrarMais();
  assert.equal((el('q-resultado').innerHTML.match(/class="q-linha"/g) || []).length, 35);
  assert.ok(!el('q-resultado').innerHTML.includes('Mostrar mais'));
});

// ── modo refazer ────────────────────────────────────────────────────────────
test('refazer: abre a rodada só com as questões filtradas', async () => {
  await iniciar([Qs({ id: 1, banca: 'FCC' }), Qs({ id: 2, banca: 'FGV' })]);
  Questoes.filtro('banca', 'FGV');
  Questoes.iniciarRefazer();
  assert.equal(el('q-tela-lista').hidden, true);
  assert.equal(el('q-tela-refazer').hidden, false);
  assert.match(el('q-tela-refazer').innerHTML, /Questão 1 de 1/);
});

test('refazer: sem questões nos filtros, avisa e não abre', async () => {
  await iniciar([Qs({ id: 1 })]);
  Questoes.buscar('nada');
  Questoes.iniciarRefazer();
  assert.equal(el('q-tela-refazer').hidden, true);
  assert.match(ultimoToast().textContent, /Nenhuma questão/);
});

test('tesoura: riscar uma alternativa a deixa tachada e impede de marcar', async () => {
  await iniciar([Qs()]);
  Questoes.iniciarRefazer();
  Questoes.cortar(1);
  assert.match(el('q-tela-refazer').innerHTML, /q-alt cortada/);
  Questoes.marcar(1);
  assert.ok(!el('q-tela-refazer').innerHTML.includes('q-alt marcada'));
  Questoes.cortar(1);
  assert.ok(!el('q-tela-refazer').innerHTML.includes('q-alt cortada'));
});

test('responder sem marcar: mostra o aviso e NÃO chama o servidor', async () => {
  await iniciar([Qs()]);
  Questoes.iniciarRefazer();
  await Questoes.responder();
  assert.match(el('q-tela-refazer').innerHTML, /Escolha uma alternativa antes de responder/);
  assert.equal(chamadas('POST', '/questions/answer').length, 0);
});

test('responder certo: corrige no servidor e mostra a justificativa', async () => {
  await iniciar([Qs()]);
  Questoes.iniciarRefazer();
  Questoes.marcar(1);
  await Questoes.responder();
  const [c] = chamadas('POST', '/questions/answer');
  assert.deepEqual(c.corpo, { question_id: 1, resposta: 'B' });
  assert.match(el('q-tela-refazer').innerHTML, /Você acertou/);
  assert.match(el('q-tela-refazer').innerHTML, /Porque sim\./);
});

test('responder errado: mostra o gabarito e conta o erro', async () => {
  await iniciar([Qs()]);
  Questoes.iniciarRefazer();
  Questoes.marcar(0);
  await Questoes.responder();
  assert.match(el('q-tela-refazer').innerHTML, /Você errou\. O gabarito é B\./);
  assert.match(el('q-tela-refazer').innerHTML, /0 acertos · 1 erro/);
});

test('responder duas vezes seguidas só registra uma tentativa', async () => {
  await iniciar([Qs()]);
  Questoes.iniciarRefazer();
  Questoes.marcar(1);
  await Promise.all([Questoes.responder(), Questoes.responder()]);
  assert.equal(chamadas('POST', '/questions/answer').length, 1);
});

test('responder com o servidor recusando: avisa e mantém a questão aberta', async () => {
  await iniciar([Qs()]);
  Questoes.iniciarRefazer();
  Questoes.marcar(1);
  const original = globalThis.fetch;
  globalThis.fetch = async (url, o) => (url.endsWith('/questions/answer')
    ? { ok: false, status: 404, json: async () => ({ error: 'questão não encontrada' }) } : original(url, o));
  try { await Questoes.responder(); } finally { globalThis.fetch = original; }
  assert.match(ultimoToast().textContent, /não encontrada/);
  assert.ok(!el('q-tela-refazer').innerHTML.includes('Você acertou'));
});

test('rodada completa: próxima, fim, e refazer só as erradas', async () => {
  await iniciar([Qs({ id: 1 }), Qs({ id: 2, enunciado: 'Segunda' })]);   // as duas têm gabarito B
  Questoes.iniciarRefazer();
  Questoes.marcar(1); await Questoes.responder(); Questoes.proxima();    // acerta a primeira (qualquer que seja a ordem)
  Questoes.marcar(0); await Questoes.responder(); Questoes.proxima();    // erra a segunda
  assert.match(el('q-tela-refazer').innerHTML, /Fim da rodada/);
  assert.match(el('q-tela-refazer').innerHTML, /Refazer as erradas \(1\)/);
  Questoes.refazerErradas();
  assert.match(el('q-tela-refazer').innerHTML, /Questão 1 de 1/);
});

test('sair do modo refazer volta pra lista e recarrega do servidor', async () => {
  await iniciar([Qs()]);
  Questoes.iniciarRefazer();
  const antes = chamadas('GET', '/questions').length;
  await Questoes.sair();
  assert.equal(el('q-tela-lista').hidden, false);
  assert.equal(el('q-tela-refazer').hidden, true);
  assert.equal(chamadas('GET', '/questions').length, antes + 1);
});

// ── formulário ──────────────────────────────────────────────────────────────
function preencherValido() {
  csel.pickCsel('q-csel', 1, 'Dir. Financeiro', '#d4537e');
  el('qm-enunciado').value = '  Qual é a correta?  ';
  el('qm-assunto').value = ' Restos a pagar '; el('qm-banca').value = 'FCC'; el('qm-justificativa').value = 'Porque sim';
  ['  um ', 'dois', 'tres', '', ''].forEach((v, i) => { el('qm-alt-' + i).value = v; });
  Questoes.marcarGabarito('B');
}

test('abrir o formulário novo: título, modal aberto e sem botão de excluir', async () => {
  await iniciar([Qs()]);
  Questoes.abrirNovo();
  assert.equal(el('qm-titulo').textContent, 'Nova questão');
  assert.ok(el('q-form-modal').classList.contains('open'));
  assert.equal(el('qm-excluir').hidden, true);
  assert.equal(el('qm-salvar-outra').hidden, false);
});

test('salvar vazio: mostra os erros nos campos e NÃO chama o servidor', async () => {
  await iniciar([Qs()]);
  Questoes.abrirNovo();
  el('qm-enunciado').value = '';
  await Questoes.salvar();
  assert.equal(el('qm-erro-enunciado').textContent, 'Escreva o enunciado.');
  assert.equal(el('qm-erro-materia').textContent, 'Escolha uma matéria.');
  assert.equal(chamadas('POST', '/questions').length, 0);
  assert.ok(el('q-form-modal').classList.contains('open'));
});

test('salvar válido: manda o payload limpo, fecha e recarrega a lista', async () => {
  await iniciar([]);
  Questoes.abrirNovo();
  preencherValido();
  await Questoes.salvar();
  const [c] = chamadas('POST', '/questions');
  assert.deepEqual(c.corpo, { materia_nome: 'Dir. Financeiro', materia_cor: '#d4537e', assunto: 'Restos a pagar', banca: 'FCC', tipo: 'ME', enunciado: 'Qual é a correta?',
    alternativas: ['um', 'dois', 'tres'], gabarito: 'B', justificativa: 'Porque sim' });
  assert.ok(!el('q-form-modal').classList.contains('open'));
  assert.match(el('q-resultado').innerHTML, /Qual é a correta\?/);
  assert.match(ultimoToast().textContent, /salva/);
});

test('certo ou errado: não manda alternativas e exige o gabarito', async () => {
  await iniciar([]);
  Questoes.abrirNovo();
  csel.pickCsel('q-csel', 1, 'Dir. Financeiro', '#d4537e');
  Questoes.definirTipo('CE');
  el('qm-enunciado').value = 'Julgue o item.';
  await Questoes.salvar();
  assert.match(el('qm-erro-gabarito').textContent, /certo ou errado/);
  Questoes.marcarGabarito('E');
  await Questoes.salvar();
  const [c] = chamadas('POST', '/questions');
  assert.equal(c.corpo.tipo, 'CE'); assert.deepEqual(c.corpo.alternativas, []); assert.equal(c.corpo.gabarito, 'E');
});

test('trocar o tipo descarta o gabarito (a letra C de múltipla escolha não é o "Certo")', async () => {
  await iniciar([]);
  Questoes.abrirNovo();
  Questoes.marcarGabarito('C');
  Questoes.definirTipo('CE');
  assert.equal(el('qm-bloco-me').hidden, true);
  assert.equal(el('qm-bloco-ce').hidden, false);
  assert.equal(el('qm-ce-c').getAttribute('aria-checked'), 'false');
  assert.equal(el('qm-ce-e').getAttribute('aria-checked'), 'false');
});

test('"salvar e adicionar outra": mantém matéria, assunto e banca, limpa o resto e deixa aberto', async () => {
  await iniciar([]);
  Questoes.abrirNovo();
  preencherValido();
  await Questoes.salvarEOutra();
  assert.equal(chamadas('POST', '/questions').length, 1);
  assert.ok(el('q-form-modal').classList.contains('open'));
  assert.equal(el('qm-enunciado').value, '');
  assert.equal(el('qm-assunto').value, 'Restos a pagar');
  assert.equal(el('qm-banca').value, 'FCC');
  assert.equal(el('q-csel-text').textContent, 'Dir. Financeiro');
});

test('o servidor recusando: mostra a mensagem e mantém o formulário aberto', async () => {
  await iniciar([]);
  Questoes.abrirNovo();
  preencherValido();
  servidor.erro = 'matéria não encontrada';
  await Questoes.salvar();
  assert.match(ultimoToast().textContent, /matéria não encontrada/);
  assert.ok(el('q-form-modal').classList.contains('open'));
});

test('editar: preenche o formulário com a questão e salva com PUT', async () => {
  await iniciar([Qs({ id: 7, enunciado: 'Original', alternativas: ['um', 'dois', 'tres'] })]);
  Questoes.abrir(7);
  assert.equal(el('qm-titulo').textContent, 'Editar questão');
  assert.equal(el('qm-enunciado').value, 'Original');
  assert.equal(el('qm-excluir').hidden, false);
  assert.equal(el('qm-salvar-outra').hidden, true);
  el('qm-enunciado').value = 'Editado';
  await Questoes.salvar();
  const [c] = chamadas('PUT', '/questions/7');
  assert.equal(c.corpo.enunciado, 'Editado');
  assert.equal(chamadas('POST', '/questions').length, 0);
});

test('novo formulário já vem com matéria, assunto e banca dos filtros ativos', async () => {
  await iniciar([Qs({ id: 1 })]);
  Questoes.filtro('materia', 'Dir. Financeiro'); Questoes.filtro('banca', 'FCC');
  Questoes.abrirNovo();
  assert.equal(el('q-csel-text').textContent, 'Dir. Financeiro');
  assert.equal(el('qm-banca').value, 'FCC');
});

test('sugestões de assunto vêm das questões da matéria escolhida', async () => {
  await iniciar([Qs({ id: 1, materia_nome: 'Dir. Financeiro', assunto: 'Restos a pagar' }), Qs({ id: 2, materia_nome: 'Contabilidade', assunto: 'Depreciação' })]);
  Questoes.abrirNovo();
  csel.pickCsel('q-csel', 2, 'Contabilidade', '#1d9e75');
  assert.match(el('qm-dl-assuntos').innerHTML, /Depreciação/);
  assert.ok(!el('qm-dl-assuntos').innerHTML.includes('Restos a pagar'));
});

// ── excluir e fechar ────────────────────────────────────────────────────────
test('excluir pela lista: pede confirmação e só então apaga', async () => {
  await iniciar([Qs({ id: 3 })]);
  const p = Questoes.excluir(3);
  confirmarNoModal(true);
  await p;
  assert.equal(chamadas('DELETE', '/questions/3').length, 1);
  assert.match(el('q-resultado').innerHTML, /Seu caderno está vazio/);
});

test('excluir cancelado: nada é apagado', async () => {
  await iniciar([Qs({ id: 3 })]);
  const p = Questoes.excluir(3);
  confirmarNoModal(false);
  await p;
  assert.equal(chamadas('DELETE', '/questions/3').length, 0);
});

test('excluir dentro do formulário: confirma, apaga e fecha', async () => {
  await iniciar([Qs({ id: 4 })]);
  Questoes.abrir(4);
  const p = Questoes.excluirDoFormulario();
  confirmarNoModal(true);
  await p;
  assert.equal(chamadas('DELETE', '/questions/4').length, 1);
  assert.ok(!el('q-form-modal').classList.contains('open'));
});

test('Escape fecha o formulário', async () => {
  await iniciar([Qs()]);
  Questoes.abrirNovo();
  (docListeners.keydown || []).slice().forEach(f => f({ key: 'Escape', preventDefault() {} }));
  assert.ok(!el('q-form-modal').classList.contains('open'));
});

test('o aviso de erro de um campo some assim que a pessoa o edita', async () => {
  await iniciar([]);
  Questoes.abrirNovo();
  await Questoes.salvar();
  assert.equal(el('qm-erro-enunciado').textContent, 'Escreva o enunciado.');
  assert.equal(el('qm-enunciado').getAttribute('aria-invalid'), 'true');
  Questoes.editou('enunciado');
  assert.equal(el('qm-erro-enunciado').textContent, '');
  assert.equal(el('qm-enunciado').getAttribute('aria-invalid'), 'false');
  assert.ok(el('qm-erro-materia').textContent, 'os erros dos outros campos continuam');
});

// ── o caderno não depende das matérias do app (que um novo ciclo zera) ─────
async function comAppSemMaterias(fn) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, o) => (url.endsWith('/categories') ? { ok: true, status: 200, json: async () => [] } : original(url, o));
  try { await loadCategories(); await fn(); }
  finally { globalThis.fetch = original; await loadCategories(); }
}

test('o formulário oferece as matérias que já estão no caderno mesmo com o app sem nenhuma matéria', async () => {
  await iniciar([Qs({ id: 1, materia_nome: 'Direito financeiro', materia_cor: '#fb923c' })]);
  await comAppSemMaterias(async () => {
    Questoes.abrirNovo();
    assert.match(el('q-csel-menu').innerHTML, /Direito financeiro/);
  });
});

test('editar uma questão cuja matéria não existe mais no app mantém a matéria', async () => {
  await iniciar([Qs({ id: 9, materia_nome: 'Direito financeiro', materia_cor: '#fb923c' })]);
  await comAppSemMaterias(async () => {
    Questoes.abrir(9);
    assert.equal(el('q-csel-text').textContent, 'Direito financeiro');
    await Questoes.salvar();
    const [c] = chamadas('PUT', '/questions/9');
    assert.equal(c.corpo.materia_nome, 'Direito financeiro'); assert.equal(c.corpo.materia_cor, '#fb923c');
  });
});

test('escolher no formulário uma matéria do app grava o nome e a cor dela', async () => {
  await iniciar([]);
  Questoes.abrirNovo();
  csel.pickCsel('q-csel', 2, 'Contabilidade', '#1d9e75');
  el('qm-enunciado').value = 'Julgue o item.';
  Questoes.definirTipo('CE'); Questoes.marcarGabarito('C');
  await Questoes.salvar();
  const [c] = chamadas('POST', '/questions');
  assert.equal(c.corpo.materia_nome, 'Contabilidade'); assert.equal(c.corpo.materia_cor, '#1d9e75');
});

// ── painel de desempenho ───────────────────────────────────────────────────
const TRES = () => [Qs({ id: 1, tentativas: 3, acertos: 1, ultima_acertou: false }), Qs({ id: 2, banca: 'FGV', tentativas: 1, acertos: 1, ultima_acertou: true }), Qs({ id: 3 })];

test('o painel mostra os números do caderno todo', async () => {
  await iniciar(TRES());
  const h = el('q-painel').innerHTML;
  assert.match(h, /q-kpi-num">3</); assert.match(h, /q-kpi-num ok">1</); assert.match(h, /q-kpi-num err">1</); assert.match(h, /q-kpi-num nd">1</);
  assert.equal(el('q-painel').hidden, false);
});

test('o painel NÃO muda quando os filtros mudam (ele é o caderno inteiro)', async () => {
  await iniciar(TRES());
  Questoes.filtro('banca', 'FGV');
  assert.equal(linhas(), 1);
  assert.match(el('q-painel').innerHTML, /q-kpi-num">3</);
});

test('clicar em "Para revisar" filtra a lista e marca o cartão e a caixa "Só as que errei"', async () => {
  await iniciar(TRES());
  Questoes.situacao('revisar');
  assert.equal(linhas(), 1);
  assert.equal(el('qf-erradas').checked, true);
  assert.match(el('q-painel').innerHTML, /aria-pressed="true" onclick="Questoes\.situacao\('revisar'\)"/);
});

test('clicar de novo no mesmo cartão tira o filtro', async () => {
  await iniciar(TRES());
  Questoes.situacao('dominadas'); Questoes.situacao('dominadas');
  assert.equal(linhas(), 3);
});

test('o cartão "No caderno" limpa a situação', async () => {
  await iniciar(TRES());
  Questoes.situacao('novas'); assert.equal(linhas(), 1);
  Questoes.situacao('todas');
  assert.equal(linhas(), 3);
});

test('a caixa "Só as que errei" e o cartão andam juntos', async () => {
  await iniciar(TRES());
  Questoes.somenteErradas(true);
  assert.match(el('q-painel').innerHTML, /aria-pressed="true" onclick="Questoes\.situacao\('revisar'\)"/);
  Questoes.somenteErradas(false);
  assert.match(el('q-painel').innerHTML, /aria-pressed="true" onclick="Questoes\.situacao\('todas'\)"/);
});

test('caderno vazio esconde o painel', async () => {
  await iniciar([]);
  assert.equal(el('q-painel').hidden, true);
});

test('depois de resolver e voltar, o painel reflete o resultado', async () => {
  await iniciar([Qs({ id: 1 }), Qs({ id: 2 })]);
  assert.match(el('q-painel').innerHTML, /q-kpi-num ok">0</);
  Questoes.iniciarRefazer();
  Questoes.marcar(1); await Questoes.responder();     // todas têm gabarito B: acerta
  await Questoes.sair();
  assert.match(el('q-painel').innerHTML, /q-kpi-num ok">1</);
  assert.match(el('q-painel').innerHTML, /100%/);
});

// ── revisão espaçada ───────────────────────────────────────────────────────
const { usarRelogio, situacaoDe } = await import('../src/js/questoes-logica.js');
const HOJE = new Date(2026, 9, 8, 12, 0, 0);
const diasAtras = (n) => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 19).replace('T', ' '); };
const ACERTOU = (id, seguidos, dias, o = {}) => Qs({ id, ultima_acertou: true, acertos_seguidos: seguidos, ultima_respondida_em: diasAtras(dias), tentativas: seguidos, acertos: seguidos, ...o });
async function comHoje(fn) { const restaurar = usarRelogio(() => HOJE); try { await fn(); } finally { restaurar(); } }

test('o painel e a lista distinguem as vencidas das dominadas', async () => {
  await comHoje(async () => {
    await iniciar([ACERTOU(1, 1, 1), ACERTOU(2, 1, 0), ACERTOU(3, 3, 10)]);
    assert.match(el('q-painel').innerHTML, /q-kpi-num ok">1</);
    assert.match(el('q-painel').innerHTML, /q-kpi-num venc">2</);
    Questoes.situacao('vencidas');
    assert.equal(linhas(), 2);
  });
});

test('"Revisar hoje" abre uma rodada só com o que errou e o que venceu, ignorando os filtros', async () => {
  await comHoje(async () => {
    await iniciar([ACERTOU(1, 1, 1), ACERTOU(2, 1, 0), Qs({ id: 3, ultima_acertou: false, tentativas: 1 }), Qs({ id: 4 })]);
    Questoes.buscar('texto que não existe');                      // a lista fica vazia, mas o painel continua valendo
    Questoes.revisarHoje();
    assert.equal(el('q-tela-refazer').hidden, false);
    assert.match(el('q-tela-refazer').innerHTML, /Questão 1 de 2/);
  });
});

test('"Revisar hoje" sem nada pendente avisa e não abre rodada', async () => {
  await comHoje(async () => {
    await iniciar([ACERTOU(1, 1, 0), Qs({ id: 2 })]);
    Questoes.revisarHoje();
    assert.equal(el('q-tela-refazer').hidden, true);
    assert.match(ultimoToast().textContent, /Nada para revisar hoje/);
  });
});

test('acertar uma vencida a coloca em dia (sem precisar recarregar) e mostra a próxima revisão', async () => {
  await comHoje(async () => {
    await iniciar([ACERTOU(1, 1, 1)]);
    servidor.agora = diasAtras(0);
    assert.equal(situacaoDe(JSON.parse(JSON.stringify(servidor.questoes[0]))), 'vencidas');
    Questoes.situacao('vencidas'); Questoes.iniciarRefazer();
    Questoes.marcar(1); await Questoes.responder();
    assert.match(el('q-tela-refazer').innerHTML, /Você acertou · próxima revisão em 3 dias/);   // 2 acertos seguidos = 3 dias
    await Questoes.sair();
    assert.match(el('q-painel').innerHTML, /q-kpi-num ok">1</);
    assert.match(el('q-painel').innerHTML, /q-kpi-num venc">0</);
  });
});

test('errar uma questão em dia a leva pra "Para revisar" e zera a escada', async () => {
  await comHoje(async () => {
    await iniciar([ACERTOU(1, 5, 0)]);
    servidor.agora = diasAtras(0);
    Questoes.iniciarRefazer();
    Questoes.marcar(0); await Questoes.responder();                // errou (gabarito é B)
    await Questoes.sair();
    assert.match(el('q-painel').innerHTML, /q-kpi-num err">1</);
    assert.equal(servidor.questoes[0].acertos_seguidos, 0);
  });
});

// ── a linha de resumo visível saiu; navegação entre questões ───────────────
test('não existe mais a linha repetida "N questões · Acerto nas tentativas" (o painel já mostra)', async () => {
  await iniciar([Qs({ id: 1 }), Qs({ id: 2 })]);
  assert.ok(!el('q-resultado').innerHTML.includes('Acerto nas tentativas'));
});

test('a quantidade continua anunciada pra leitor de tela, sem aparecer na tela', async () => {
  await iniciar([Qs({ id: 1 }), Qs({ id: 2 })]);
  assert.match(el('q-resultado').innerHTML, /class="sr-only" role="status">2 questões</);
  Questoes.buscar('texto que não existe');
  assert.ok(!el('q-resultado').innerHTML.includes('sr-only'));
  Questoes.limpar();
});

const TRES_Q = () => [Qs({ id: 1 }), Qs({ id: 2 }), Qs({ id: 3 })];
const tecla = (key, alvo = { tagName: 'DIV' }) => (docListeners.keydown || []).slice().forEach(f => f({ key, target: alvo, preventDefault() {} }));

test('as setas avançam e voltam entre as questões sem precisar responder', async () => {
  await iniciar(TRES_Q());
  Questoes.iniciarRefazer();
  assert.match(el('q-tela-refazer').innerHTML, /Questão 1 de 3/);
  Questoes.seguinte(); Questoes.seguinte();
  assert.match(el('q-tela-refazer').innerHTML, /Questão 3 de 3/);
  Questoes.anterior();
  assert.match(el('q-tela-refazer').innerHTML, /Questão 2 de 3/);
});

test('ao voltar, a questão mantém tesouras e marcação, e a respondida mostra o resultado', async () => {
  await iniciar(TRES_Q());
  Questoes.iniciarRefazer();
  Questoes.cortar(0); Questoes.marcar(2);
  Questoes.seguinte(); Questoes.anterior();
  assert.match(el('q-tela-refazer').innerHTML, /q-alt cortada/); assert.match(el('q-tela-refazer').innerHTML, /q-alt marcada/);
  Questoes.cortar(0); Questoes.marcar(1); await Questoes.responder();       // gabarito B: acerta
  Questoes.seguinte(); Questoes.anterior();
  assert.match(el('q-tela-refazer').innerHTML, /Você acertou/);
});

test('o teclado também navega: seta direita avança e seta esquerda volta', async () => {
  await iniciar(TRES_Q());
  Questoes.iniciarRefazer();
  tecla('ArrowRight'); assert.match(el('q-tela-refazer').innerHTML, /Questão 2 de 3/);
  tecla('ArrowLeft');  assert.match(el('q-tela-refazer').innerHTML, /Questão 1 de 3/);
});

test('as setas do teclado não navegam enquanto a pessoa digita ou tem janela aberta', async () => {
  await iniciar(TRES_Q());
  Questoes.iniciarRefazer();
  tecla('ArrowRight', { tagName: 'TEXTAREA' });
  assert.match(el('q-tela-refazer').innerHTML, /Questão 1 de 3/);
  el('q-form-modal').classList.add('open');
  tecla('ArrowRight');
  assert.match(el('q-tela-refazer').innerHTML, /Questão 1 de 3/);
  el('q-form-modal').classList.remove('open');
});

test('as setas do teclado não fazem nada fora do modo resolver', async () => {
  await iniciar(TRES_Q());
  tecla('ArrowRight');
  assert.equal(el('q-tela-refazer').hidden, true);
});

test('terminar a rodada pulando uma questão avisa e leva até ela', async () => {
  await iniciar(TRES_Q());
  Questoes.iniciarRefazer();
  Questoes.marcar(1); await Questoes.responder(); Questoes.proxima();          // responde a 1ª
  Questoes.seguinte();                                                            // pula a 2ª
  Questoes.marcar(1); await Questoes.responder(); Questoes.proxima();          // responde a 3ª → fim
  assert.match(el('q-tela-refazer').innerHTML, /pulou 1 questão/);
  Questoes.irParaPulada();
  assert.match(el('q-tela-refazer').innerHTML, /Questão 2 de 3/);
});