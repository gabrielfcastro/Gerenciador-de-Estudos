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

// ── situação da questão (a última tentativa decide) ───────────────────────────
/** 'dominadas' = acertou na última vez · 'revisar' = errou na última vez · 'novas' = nunca resolvida */
export function situacaoDe(q) {
  if (q.ultima_acertou == null) return 'novas';
  return q.ultima_acertou ? 'dominadas' : 'revisar';
}

/** Os números do painel de desempenho: sempre o caderno inteiro, sem olhar os filtros. */
export function resumoGeral(questoes) {
  const total = questoes.length;
  const conta = (s) => questoes.filter(q => situacaoDe(q) === s).length;
  const dominadas = conta('dominadas');
  const tentativas = questoes.reduce((soma, q) => soma + (q.tentativas || 0), 0);
  const acertos = questoes.reduce((soma, q) => soma + (q.acertos || 0), 0);
  return {
    total, dominadas, revisar: conta('revisar'), novas: conta('novas'),
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
  if (f.situacao && situacaoDe(q) !== f.situacao) return false;
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
export function resumoDesempenho(lista) {
  const tentativas = lista.reduce((s, q) => s + (q.tentativas || 0), 0);
  const acertos = lista.reduce((s, q) => s + (q.acertos || 0), 0);
  return { tentativas, acertos, percentual: tentativas ? Math.round((acertos / tentativas) * 100) : null };
}

export function textoStatus(q) {
  if (q.ultima_acertou == null) return 'Ainda não refeita';
  const n = q.tentativas || 0;
  return `${q.ultima_acertou ? 'Acertou' : 'Errou'} na última · ${n} ${n === 1 ? 'tentativa' : 'tentativas'}`;
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
  return { fila, indice: 0, ...LIMPA_QUESTAO, acertos: 0, erros: 0, errouIds: [], fim: false };
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

export function proxima(e) {
  const indice = e.indice + 1;
  if (indice >= e.fila.length) return { ...e, ...LIMPA_QUESTAO, fim: true };
  return { ...e, ...LIMPA_QUESTAO, indice };
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
