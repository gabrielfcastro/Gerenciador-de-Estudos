// ── Caderno de questões: lógica pura (sem tela) ───────────────────────────────
// Tudo aqui é função pura: recebe dados e devolve dados, sem tocar no DOM nem na
// rede. Isso deixa as regras (filtros, validação, tesoura, correção) fáceis de
// testar a fundo; o questoes.js só desenha o resultado.

export const LETRAS = ['A', 'B', 'C', 'D', 'E'];
export const LIMITE_TEXTO_CURTO = 100;
export const FILTRO_VAZIO = Object.freeze({ materia: '', assunto: '', banca: '', tipo: 'todos', situacao: '', busca: '' });

export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function rotuloTipo(tipo) {
  return tipo === 'CE' ? 'Certo ou errado' : 'Múltipla escolha';
}

// ── relógio (injetável, pra os testes darem o mesmo resultado em qualquer dia) ─
let relogio = () => new Date();

/** Troca o "agora" (só pra testes). Devolve uma função que restaura o relógio de verdade. */
export function usarRelogio(fn) {
  const anterior = relogio;
  relogio = fn;
  return () => { relogio = anterior; };
}

const pad2 = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hojeLocal = () => isoLocal(relogio());

/** O servidor guarda "AAAA-MM-DD HH:MM:SS" em UTC; devolve o dia (AAAA-MM-DD) no horário local de quem estuda. */
export function dataLocalDe(sqliteUtc) {
  const d = new Date(String(sqliteUtc).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : isoLocal(d);
}

const emMs = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const somarDias = (iso, n) => new Date(emMs(iso) + n * 86400000).toISOString().slice(0, 10);
const diferencaEmDias = (deIso, ateIso) => Math.round((emMs(ateIso) - emMs(deIso)) / 86400000);

// ── revisão espaçada: a escada de prazos ──────────────────────────────────────
/** Dias até a próxima revisão depois do 1º, 2º, 3º... acerto SEGUIDO. Errou: volta pro começo. */
export const INTERVALOS_DIAS = [1, 3, 7, 15, 30, 60];

export function intervaloDe(acertosSeguidos) {
  if (!(acertosSeguidos > 0)) return 0;
  return INTERVALOS_DIAS[Math.min(acertosSeguidos, INTERVALOS_DIAS.length) - 1];
}

/** Data (AAAA-MM-DD, local) da próxima revisão de quem acertou na última; null pra quem errou ou nunca fez. */
export function proximaRevisao(q) {
  if (q.ultima_acertou !== true || !q.ultima_respondida_em) return null;
  const base = dataLocalDe(q.ultima_respondida_em);
  return base ? somarDias(base, intervaloDe(q.acertos_seguidos || 1)) : null;
}

/** Positivo = falta tempo · 0 = é hoje · negativo = atrasou. */
export function diasAteRevisao(q) {
  const prox = proximaRevisao(q);
  return prox ? diferencaEmDias(hojeLocal(), prox) : null;
}

// ── situação da questão ───────────────────────────────────────────────────────
/**
 * 'novas'     = nunca resolvida
 * 'revisar'   = errou na última vez
 * 'vencidas'  = acertou, mas o prazo de revisão chegou
 * 'dominadas' = acertou e o prazo ainda não chegou (ou não há data pra calcular)
 */
export function situacaoDe(q) {
  if (q.ultima_acertou == null) return 'novas';
  if (!q.ultima_acertou) return 'revisar';
  const dias = diasAteRevisao(q);
  return dias !== null && dias <= 0 ? 'vencidas' : 'dominadas';
}

/** Os números do painel de desempenho: sempre o caderno inteiro, sem olhar os filtros. */
export function resumoGeral(questoes) {
  const total = questoes.length;
  const conta = (s) => questoes.filter(q => situacaoDe(q) === s).length;
  const dominadas = conta('dominadas');
  const vencidas = conta('vencidas');
  const revisar = conta('revisar');
  const tentativas = questoes.reduce((soma, q) => soma + (q.tentativas || 0), 0);
  const acertos = questoes.reduce((soma, q) => soma + (q.acertos || 0), 0);
  return {
    total, dominadas, vencidas, revisar, hoje: vencidas + revisar, novas: conta('novas'),
    tentativas, acertos, erros: tentativas - acertos,
    taxaAcerto: tentativas ? Math.round((acertos / tentativas) * 100) : null,
    pctDominadas: total ? Math.round((dominadas / total) * 100) : 0,
  };
}

// ── filtros ───────────────────────────────────────────────────────────────────
// A matéria é identificada pelo NOME (o caderno vive num arquivo próprio e não depende
// dos ids das matérias do app, que recomeçam a cada novo ciclo).
const valorDo = (q, campo) => (campo === 'materia' ? q.materia_nome : q[campo]);
const rotuloDe = (q, campo) => valorDo(q, campo);

/** `ignorar` desliga um filtro específico — usado pra contar as opções de cada lista. */
export function passaFiltro(q, f, ignorar) {
  if (ignorar !== 'materia' && f.materia && q.materia_nome !== f.materia) return false;
  if (ignorar !== 'assunto' && f.assunto && q.assunto !== f.assunto) return false;
  if (ignorar !== 'banca' && f.banca && q.banca !== f.banca) return false;
  if (ignorar !== 'tipo' && f.tipo !== 'todos' && q.tipo !== f.tipo) return false;
  if (f.situacao) {
    const s = situacaoDe(q);
    const bate = f.situacao === 'hoje' ? (s === 'revisar' || s === 'vencidas') : s === f.situacao;   // 'hoje' = errou + vencidas
    if (!bate) return false;
  }
  if (f.busca && !normalizar(q.enunciado).includes(normalizar(f.busca))) return false;
  return true;
}

export function filtrar(questoes, f) {
  return questoes.filter(q => passaFiltro(q, f));
}

export function temFiltroAtivo(f) {
  return Boolean(f.materia || f.assunto || f.banca || f.tipo !== 'todos' || f.situacao || String(f.busca || '').trim());
}

/**
 * Opções de uma lista de filtro, com a contagem calculada respeitando os OUTROS
 * filtros: assim nenhuma opção leva a uma tela vazia sem aviso.
 */
export function opcoesDoFiltro(questoes, f, campo) {
  const base = questoes.filter(q => passaFiltro(q, f, campo));
  const mapa = new Map();
  for (const q of base) {
    const valor = valorDo(q, campo);
    if (!valor) continue;
    const item = mapa.get(valor) || { valor, rotulo: rotuloDe(q, campo), n: 0 };
    item.n += 1;
    mapa.set(valor, item);
  }
  const escolhido = f[campo];
  if (escolhido && !mapa.has(escolhido)) {
    const exemplo = questoes.find(q => valorDo(q, campo) === escolhido);
    mapa.set(escolhido, { valor: escolhido, rotulo: exemplo ? rotuloDe(exemplo, campo) : escolhido, n: 0 });
  }
  const opcoes = [...mapa.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return { total: base.length, opcoes };
}

export function contarPorTipo(questoes, f) {
  const base = questoes.filter(q => passaFiltro(q, f, 'tipo'));
  return { todos: base.length, ME: base.filter(q => q.tipo === 'ME').length, CE: base.filter(q => q.tipo === 'CE').length };
}

/** Assunto e banca "pertencem" à matéria: ao trocar de matéria, some o que não existe nela. */
export function sanearFiltros(questoes, f) {
  const daMateria = f.materia ? questoes.filter(q => q.materia_nome === f.materia) : questoes;
  const r = { ...f };
  for (const campo of ['assunto', 'banca']) {
    if (r[campo] && !daMateria.some(q => q[campo] === r[campo])) r[campo] = '';
  }
  return r;
}

// ── resumo e textos ───────────────────────────────────────────────────────────
export function textoProximaRevisao(dias) {
  return dias === 1 ? 'amanhã' : `em ${dias} dias`;
}

function quandoRevisar(q) {
  const dias = diasAteRevisao(q);
  if (dias === null) return '';
  if (dias > 0) return `revisar ${textoProximaRevisao(dias)}`;
  if (dias === 0) return 'revisar hoje';
  return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`;
}

export function textoStatus(q) {
  if (q.ultima_acertou == null) return 'Ainda não refeita';
  const n = q.tentativas || 0;
  const base = `${q.ultima_acertou ? 'Acertou' : 'Errou'} na última · ${n} ${n === 1 ? 'tentativa' : 'tentativas'}`;
  const quando = q.ultima_acertou ? quandoRevisar(q) : '';
  return quando ? `${base} · ${quando}` : base;
}

/** Fisher-Yates sobre uma cópia; `aleatorio` é injetável pra poder testar. */
export function embaralhar(lista, aleatorio = Math.random) {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// ── formulário ────────────────────────────────────────────────────────────────
/** Alternativas sem as vazias do fim (a E é opcional): ['a','b','c','',''] → ['a','b','c']. */
export function alternativasPreenchidas(alternativas) {
  const a = (alternativas || []).map(x => String(x ?? '').trim());
  while (a.length && !a[a.length - 1]) a.pop();
  return a;
}

/** Mesmas regras do servidor, pra avisar o erro na hora (o servidor continua sendo a palavra final). */
export function validarFormulario(d) {
  const erros = {};
  if (!String(d.materia_nome ?? '').trim()) erros.materia = 'Escolha uma matéria.';
  else if (String(d.materia_nome).trim().length > LIMITE_TEXTO_CURTO) erros.materia = `Máximo de ${LIMITE_TEXTO_CURTO} caracteres.`;
  if (!String(d.enunciado ?? '').trim()) erros.enunciado = 'Escreva o enunciado.';
  if (String(d.assunto ?? '').trim().length > LIMITE_TEXTO_CURTO) erros.assunto = `Máximo de ${LIMITE_TEXTO_CURTO} caracteres.`;
  if (String(d.banca ?? '').trim().length > LIMITE_TEXTO_CURTO) erros.banca = `Máximo de ${LIMITE_TEXTO_CURTO} caracteres.`;

  const gabarito = String(d.gabarito ?? '').trim().toUpperCase();
  if (d.tipo === 'CE') {
    if (gabarito !== 'C' && gabarito !== 'E') erros.gabarito = 'Marque se o item é certo ou errado.';
  } else {
    const alts = alternativasPreenchidas(d.alternativas);
    if (alts.length < 2) erros.alternativas = 'Preencha pelo menos 2 alternativas.';
    else if (alts.some(a => !a)) erros.alternativas = 'Preencha as alternativas em ordem, sem pular letras.';
    if (!erros.alternativas && !(gabarito.length === 1 && LETRAS.slice(0, alts.length).includes(gabarito))) {
      erros.gabarito = 'Marque qual alternativa é a correta.';
    }
  }
  return { ok: Object.keys(erros).length === 0, erros };
}

export function montarPayload(d) {
  return {
    materia_nome: String(d.materia_nome ?? '').trim(),
    materia_cor: String(d.materia_cor ?? '').trim(),
    assunto: String(d.assunto ?? '').trim(),
    banca: String(d.banca ?? '').trim(),
    tipo: d.tipo,
    enunciado: String(d.enunciado ?? '').trim(),
    alternativas: d.tipo === 'CE' ? [] : alternativasPreenchidas(d.alternativas),
    gabarito: String(d.gabarito ?? '').trim().toUpperCase(),
    justificativa: String(d.justificativa ?? '').trim(),
  };
}

// ── modo refazer: estado e transições (a tesoura mora aqui) ───────────────────
const LIMPA_QUESTAO = { cortadas: [], marcada: null, respondida: false, resultado: null, riscouAGabarito: false, erro: '' };

export function estadoInicialRefazer(fila) {
  return { fila, indice: 0, ...LIMPA_QUESTAO, salvas: {}, acertos: 0, erros: 0, errouIds: [], fim: false };
}

export const questaoAtual = (e) => e.fila[e.indice];

/** Risca ou restaura uma alternativa. Só existe em múltipla escolha, e antes de responder. */
export function alternarCorte(e, i) {
  const q = questaoAtual(e);
  if (e.respondida || !q || q.tipo === 'CE') return e;
  const cortadas = e.cortadas.includes(i) ? e.cortadas.filter(x => x !== i) : [...e.cortadas, i].sort((a, b) => a - b);
  return { ...e, cortadas, marcada: e.marcada === i ? null : e.marcada, erro: '' };
}

/** Alternativa riscada não pode ser marcada; depois de responder, nada muda. */
export function marcarAlternativa(e, i) {
  if (e.respondida || e.cortadas.includes(i)) return e;
  return { ...e, marcada: i, erro: '' };
}

export function respostaMarcada(e) {
  if (e.marcada === null) return null;
  return questaoAtual(e).tipo === 'CE' ? ['C', 'E'][e.marcada] : LETRAS[e.marcada];
}

export function pedirResposta(e) {
  if (e.marcada === null) return { pode: false, estado: { ...e, erro: 'Escolha uma alternativa antes de responder.' } };
  return { pode: true, estado: { ...e, erro: '' } };
}

export function aplicarResultado(e, resultado) {
  const q = questaoAtual(e);
  const idxGabarito = q.tipo === 'CE' ? ['C', 'E'].indexOf(resultado.gabarito) : LETRAS.indexOf(resultado.gabarito);
  const semEsta = e.errouIds.filter(id => id !== q.id);
  return {
    ...e,
    respondida: true,
    resultado,
    riscouAGabarito: e.cortadas.includes(idxGabarito),
    acertos: e.acertos + (resultado.acertou ? 1 : 0),
    erros: e.erros + (resultado.acertou ? 0 : 1),
    errouIds: resultado.acertou ? semEsta : [...semEsta, q.id],
  };
}

/** As questões que ficaram erradas na rodada (a última tentativa de cada uma). */
export function filaDasErradas(e) {
  return e.fila.filter(q => e.errouIds.includes(q.id));
}

// ── navegar livremente entre as questões da rodada ────────────────────────────
// Ao sair de uma questão, o que ela tinha (tesouras, marcação, resposta) fica guardado em `salvas`;
// ao voltar, tudo reaparece. A questão em que você está é sempre a "viva" (os campos do próprio estado).
const camposDaQuestao = (e) => ({
  cortadas: e.cortadas, marcada: e.marcada, respondida: e.respondida,
  resultado: e.resultado, riscouAGabarito: e.riscouAGabarito, erro: e.erro,
});

function irPara(e, indice) {
  const salvas = { ...e.salvas, [questaoAtual(e).id]: camposDaQuestao(e) };
  return { ...e, salvas, indice, fim: false, ...(salvas[e.fila[indice].id] || LIMPA_QUESTAO) };
}

export function anterior(e) { return e.indice > 0 ? irPara(e, e.indice - 1) : e; }
export function seguinte(e) { return e.indice + 1 < e.fila.length ? irPara(e, e.indice + 1) : e; }

/** Depois de responder: avança; na última, mostra o fim (sem apagar a resposta dela). */
export function proxima(e) {
  if (e.indice + 1 >= e.fila.length) {
    return { ...e, salvas: { ...e.salvas, [questaoAtual(e).id]: camposDaQuestao(e) }, fim: true };
  }
  return irPara(e, e.indice + 1);
}

const respondidaNaRodada = (e, i) => (i === e.indice ? e.respondida : Boolean((e.salvas[e.fila[i].id] || {}).respondida));
export const totalRespondidas = (e) => e.fila.filter((_, i) => respondidaNaRodada(e, i)).length;
export const indicesNaoRespondidos = (e) => e.fila.map((_, i) => i).filter(i => !respondidaNaRodada(e, i));

export function irParaPrimeiraPulada(e) {
  const [primeira] = indicesNaoRespondidos(e);
  return primeira === undefined ? e : irPara(e, primeira);
}

export function refazerEsta(e) {
  return { ...e, ...LIMPA_QUESTAO };
}

const ID_BASE_CADERNO = 100000;

/**
 * Matérias oferecidas no formulário: as do app (com a cor de hoje) mais as que só existem no
 * caderno. Assim o caderno nunca fica sem matéria, mesmo depois de um novo ciclo zerar o app.
 */
export function opcoesDeMateria(categorias, questoes) {
  const vistos = new Set(categorias.map(c => normalizar(c.name)));
  const extras = [];
  for (const q of questoes) {
    const nome = q.materia_nome;
    if (!nome || vistos.has(normalizar(nome))) continue;
    vistos.add(normalizar(nome));
    extras.push({ name: nome, color: q.materia_cor });
  }
  extras.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return [
    ...categorias.map(c => ({ id: c.id, name: c.name, color: c.color })),
    ...extras.map((m, i) => ({ id: ID_BASE_CADERNO + i, ...m })),
  ];
}

/** Valores já usados (assunto ou banca) pra sugerir no formulário. Assunto é filtrado pela matéria. */
export function sugestoes(questoes, campo, materiaNome) {
  const daMateria = campo === 'assunto' && materiaNome
    ? questoes.filter(q => q.materia_nome === materiaNome)
    : questoes;
  return [...new Set(daMateria.map(q => q[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}