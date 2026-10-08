import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/js/questoes-logica.js';

const Q = (o = {}) => ({
  id: 1, materia_nome: 'Dir. Financeiro', materia_cor: '#d4537e', assunto: 'Restos a pagar',
  banca: 'FCC', tipo: 'ME', enunciado: 'Qual alternativa está correta?', alternativas: ['a', 'b', 'c'], gabarito: 'B',
  justificativa: '', tentativas: 0, acertos: 0, ultima_acertou: null, ...o,
});
const F = (o = {}) => ({ ...L.FILTRO_VAZIO, ...o });

// ── filtros ────────────────────────────────────────────────────────────────
test('normalizar: ignora acento, caixa e espaços nas pontas', () => {
  assert.equal(L.normalizar('  Não CUMULATIVIDADE '), 'nao cumulatividade');
});

test('passaFiltro: sem filtro nenhum, toda questão passa', () => {
  assert.equal(L.passaFiltro(Q(), F()), true);
});

test('passaFiltro: matéria, assunto, banca e tipo', () => {
  assert.equal(L.passaFiltro(Q(), F({ materia: 'Dir. Financeiro' })), true);
  assert.equal(L.passaFiltro(Q(), F({ materia: 'Contabilidade' })), false);
  assert.equal(L.passaFiltro(Q(), F({ assunto: 'Restos a pagar' })), true);
  assert.equal(L.passaFiltro(Q(), F({ assunto: 'Outro' })), false);
  assert.equal(L.passaFiltro(Q(), F({ banca: 'FGV' })), false);
  assert.equal(L.passaFiltro(Q(), F({ tipo: 'CE' })), false);
  assert.equal(L.passaFiltro(Q({ tipo: 'CE' }), F({ tipo: 'CE' })), true);
});

test('passaFiltro: "só as que errei" exige a última tentativa errada', () => {
  assert.equal(L.passaFiltro(Q({ ultima_acertou: false }), F({ situacao: 'revisar' })), true);
  assert.equal(L.passaFiltro(Q({ ultima_acertou: true }), F({ situacao: 'revisar' })), false);
  assert.equal(L.passaFiltro(Q({ ultima_acertou: null }), F({ situacao: 'revisar' })), false);
});

test('passaFiltro: busca no enunciado ignora acento e caixa', () => {
  const q = Q({ enunciado: 'A não cumulatividade do ICMS' });
  assert.equal(L.passaFiltro(q, F({ busca: 'NAO CUMULATIV' })), true);
  assert.equal(L.passaFiltro(q, F({ busca: 'IPI' })), false);
});

test('passaFiltro: "ignorar" desliga só aquele filtro', () => {
  assert.equal(L.passaFiltro(Q(), F({ banca: 'FGV' }), 'banca'), true);
  assert.equal(L.passaFiltro(Q(), F({ banca: 'FGV', assunto: 'X' }), 'banca'), false);
});

test('filtrar: devolve só as que passam, na mesma ordem', () => {
  const lista = [Q({ id: 1 }), Q({ id: 2, banca: 'FGV' }), Q({ id: 3 })];
  assert.deepEqual(L.filtrar(lista, F({ banca: 'FCC' })).map(q => q.id), [1, 3]);
});

// ── opções com contagem ────────────────────────────────────────────────────
const LISTA = [
  Q({ id: 1, materia_nome: 'Dir. Financeiro', assunto: 'Restos a pagar', banca: 'FCC' }),
  Q({ id: 2, materia_nome: 'Dir. Financeiro', assunto: 'Créditos adicionais', banca: 'FGV' }),
  Q({ id: 3, materia_nome: 'Contabilidade', assunto: 'Depreciação', banca: 'FCC', tipo: 'CE', alternativas: [], gabarito: 'C' }),
  Q({ id: 4, materia_nome: 'Contabilidade', assunto: '', banca: '' }),
];

test('opcoesDoFiltro: lista os valores com a contagem, em ordem alfabética', () => {
  const o = L.opcoesDoFiltro(LISTA, F(), 'banca');
  assert.deepEqual(o.opcoes.map(x => [x.rotulo, x.n]), [['FCC', 2], ['FGV', 1]]);
  assert.equal(o.total, 4);
});

test('opcoesDoFiltro: assunto e banca vazios não viram opção', () => {
  const o = L.opcoesDoFiltro(LISTA, F(), 'assunto');
  assert.equal(o.opcoes.length, 3);
  assert.ok(o.opcoes.every(x => x.rotulo));
});

test('opcoesDoFiltro: a matéria é identificada pelo nome', () => {
  const o = L.opcoesDoFiltro(LISTA, F(), 'materia');
  assert.deepEqual(o.opcoes.map(x => [x.valor, x.rotulo, x.n]), [['Contabilidade', 'Contabilidade', 2], ['Dir. Financeiro', 'Dir. Financeiro', 2]]);
});

test('opcoesDoFiltro: as contagens respeitam os OUTROS filtros (nunca leva a tela vazia)', () => {
  const o = L.opcoesDoFiltro(LISTA, F({ materia: 'Dir. Financeiro' }), 'assunto');
  assert.deepEqual(o.opcoes.map(x => x.rotulo), ['Créditos adicionais', 'Restos a pagar']);
});

test('opcoesDoFiltro: o filtro escolhido continua na lista mesmo com 0 resultados', () => {
  const o = L.opcoesDoFiltro(LISTA, F({ materia: 'Dir. Financeiro', assunto: 'Depreciação' }), 'assunto');
  assert.ok(o.opcoes.some(x => x.rotulo === 'Depreciação' && x.n === 0));
});

test('sanearFiltros: zera o assunto que não existe na matéria recém escolhida', () => {
  const r = L.sanearFiltros(LISTA, F({ materia: 'Dir. Financeiro', assunto: 'Depreciação' }));
  assert.equal(r.assunto, '');
  assert.equal(r.materia, 'Dir. Financeiro');
});

test('sanearFiltros: mantém filtros que ainda têm resultado', () => {
  const f = F({ materia: 'Dir. Financeiro', assunto: 'Restos a pagar', banca: 'FCC' });
  assert.deepEqual(L.sanearFiltros(LISTA, f), f);
});

test('sanearFiltros: não muda o objeto original', () => {
  const f = F({ materia: 'Dir. Financeiro', assunto: 'Depreciação' });
  L.sanearFiltros(LISTA, f);
  assert.equal(f.assunto, 'Depreciação');
});

test('contarPorTipo: respeita os demais filtros', () => {
  assert.deepEqual(L.contarPorTipo(LISTA, F()), { todos: 4, ME: 3, CE: 1 });
  assert.deepEqual(L.contarPorTipo(LISTA, F({ materia: 'Dir. Financeiro' })), { todos: 2, ME: 2, CE: 0 });
});

test('temFiltroAtivo', () => {
  assert.equal(L.temFiltroAtivo(F()), false);
  assert.equal(L.temFiltroAtivo(F({ situacao: 'revisar' })), true);
  assert.equal(L.temFiltroAtivo(F({ busca: 'x' })), true);
  assert.equal(L.temFiltroAtivo(F({ tipo: 'CE' })), true);
});

// ── resumo, status e utilidades ────────────────────────────────────────────
test('resumoDesempenho: soma tentativas e acertos e calcula o percentual', () => {
  const r = L.resumoDesempenho([Q({ tentativas: 3, acertos: 1 }), Q({ tentativas: 1, acertos: 1 })]);
  assert.deepEqual(r, { tentativas: 4, acertos: 2, percentual: 50 });
});

test('resumoDesempenho: sem tentativas não inventa percentual', () => {
  assert.deepEqual(L.resumoDesempenho([Q()]), { tentativas: 0, acertos: 0, percentual: null });
});

test('textoStatus: três situações', () => {
  assert.equal(L.textoStatus(Q()), 'Ainda não refeita');
  assert.equal(L.textoStatus(Q({ tentativas: 1, ultima_acertou: true })), 'Acertou na última · 1 tentativa');
  assert.equal(L.textoStatus(Q({ tentativas: 3, ultima_acertou: false })), 'Errou na última · 3 tentativas');
});

test('rotuloTipo', () => {
  assert.equal(L.rotuloTipo('ME'), 'Múltipla escolha');
  assert.equal(L.rotuloTipo('CE'), 'Certo ou errado');
});

test('embaralhar: não muda a lista original e mantém os mesmos elementos', () => {
  const original = [1, 2, 3, 4, 5];
  const r = L.embaralhar(original, () => 0.3);
  assert.deepEqual(original, [1, 2, 3, 4, 5]);
  assert.deepEqual([...r].sort(), [1, 2, 3, 4, 5]);
});

test('embaralhar: com o mesmo sorteio dá sempre a mesma ordem', () => {
  const a = L.embaralhar([1, 2, 3, 4, 5], () => 0.7);
  const b = L.embaralhar([1, 2, 3, 4, 5], () => 0.7);
  assert.deepEqual(a, b);
});

// ── formulário ─────────────────────────────────────────────────────────────
const FORM = (o = {}) => ({ materia_nome: 'Dir. Financeiro', materia_cor: '#d4537e', tipo: 'ME', enunciado: 'Texto', alternativas: ['a', 'b', 'c', '', ''], gabarito: 'B', assunto: '', banca: '', justificativa: '', ...o });

test('validarFormulario: formulário completo é válido', () => {
  assert.deepEqual(L.validarFormulario(FORM()), { ok: true, erros: {} });
});

test('validarFormulario: matéria e enunciado são obrigatórios', () => {
  const r = L.validarFormulario(FORM({ materia_nome: '  ', enunciado: '   ' }));
  assert.equal(r.ok, false);
  assert.ok(r.erros.materia && r.erros.enunciado);
});

test('validarFormulario: múltipla escolha precisa de 2 alternativas, sem pular letra', () => {
  assert.ok(L.validarFormulario(FORM({ alternativas: ['a', '', '', '', ''] })).erros.alternativas);
  assert.match(L.validarFormulario(FORM({ alternativas: ['a', '', 'c', '', ''] })).erros.alternativas, /em ordem/);
});

test('validarFormulario: múltipla escolha exige gabarito dentro das alternativas preenchidas', () => {
  assert.ok(L.validarFormulario(FORM({ gabarito: '' })).erros.gabarito);
  assert.ok(L.validarFormulario(FORM({ gabarito: 'D' })).erros.gabarito);
});

test('validarFormulario: certo ou errado não olha as alternativas e exige C ou E', () => {
  assert.equal(L.validarFormulario(FORM({ tipo: 'CE', alternativas: ['', '', '', '', ''], gabarito: 'C' })).ok, true);
  assert.ok(L.validarFormulario(FORM({ tipo: 'CE', gabarito: 'B' })).erros.gabarito);
});

test('validarFormulario: assunto e banca têm limite de 100 caracteres', () => {
  const r = L.validarFormulario(FORM({ assunto: 'x'.repeat(101), banca: 'y'.repeat(101) }));
  assert.ok(r.erros.assunto && r.erros.banca);
});

test('montarPayload: tira vazias do fim, apara espaços e zera alternativas no certo/errado', () => {
  const p = L.montarPayload(FORM({ alternativas: [' a ', 'b', 'c', '', ''], assunto: ' Restos ', banca: ' fcc ', justificativa: ' j ' }));
  assert.deepEqual(p.alternativas, ['a', 'b', 'c']);
  assert.equal(p.assunto, 'Restos'); assert.equal(p.banca, 'fcc'); assert.equal(p.justificativa, 'j');
  assert.deepEqual(L.montarPayload(FORM({ tipo: 'CE', gabarito: 'C' })).alternativas, []);
});

// ── mecânica do modo refazer (tesoura, marcar, responder) ──────────────────
const FILA = [Q({ id: 10 }), Q({ id: 11, tipo: 'CE', alternativas: [], gabarito: 'C' })];

test('estadoInicialRefazer: começa na primeira questão, sem corte e sem marcação', () => {
  const e = L.estadoInicialRefazer(FILA);
  assert.equal(e.indice, 0);
  assert.deepEqual(e.cortadas, []);
  assert.equal(e.marcada, null);
  assert.equal(e.respondida, false);
  assert.deepEqual([e.acertos, e.erros], [0, 0]);
});

test('alternarCorte: risca e restaura', () => {
  let e = L.estadoInicialRefazer(FILA);
  e = L.alternarCorte(e, 2);
  assert.deepEqual(e.cortadas, [2]);
  e = L.alternarCorte(e, 2);
  assert.deepEqual(e.cortadas, []);
});

test('alternarCorte: riscar a alternativa marcada tira a marcação', () => {
  let e = L.marcarAlternativa(L.estadoInicialRefazer(FILA), 1);
  e = L.alternarCorte(e, 1);
  assert.equal(e.marcada, null);
});

test('alternarCorte: não corta depois de responder, nem em certo/errado', () => {
  const respondida = { ...L.estadoInicialRefazer(FILA), respondida: true };
  assert.deepEqual(L.alternarCorte(respondida, 0).cortadas, []);
  const ce = { ...L.estadoInicialRefazer(FILA), indice: 1 };
  assert.deepEqual(L.alternarCorte(ce, 0).cortadas, []);
});

test('marcarAlternativa: alternativa riscada não pode ser marcada', () => {
  let e = L.alternarCorte(L.estadoInicialRefazer(FILA), 0);
  e = L.marcarAlternativa(e, 0);
  assert.equal(e.marcada, null);
});

test('marcarAlternativa: não troca a marcação depois de responder', () => {
  const e = { ...L.marcarAlternativa(L.estadoInicialRefazer(FILA), 1), respondida: true };
  assert.equal(L.marcarAlternativa(e, 2).marcada, 1);
});

test('respostaMarcada: devolve a letra (ME) ou C/E (certo ou errado)', () => {
  let e = L.marcarAlternativa(L.estadoInicialRefazer(FILA), 2);
  assert.equal(L.respostaMarcada(e), 'C');
  e = L.marcarAlternativa({ ...L.estadoInicialRefazer(FILA), indice: 1 }, 1);
  assert.equal(L.respostaMarcada(e), 'E');
  assert.equal(L.respostaMarcada(L.estadoInicialRefazer(FILA)), null);
});

test('pedirResposta: sem marcação, mostra o aviso e não responde', () => {
  const r = L.pedirResposta(L.estadoInicialRefazer(FILA));
  assert.equal(r.pode, false);
  assert.match(r.estado.erro, /Escolha uma alternativa/);
});

test('pedirResposta: com marcação, libera e limpa o aviso', () => {
  const r = L.pedirResposta(L.marcarAlternativa(L.estadoInicialRefazer(FILA), 1));
  assert.equal(r.pode, true);
  assert.equal(r.estado.erro, '');
});

test('aplicarResultado: contabiliza acerto ou erro e trava a questão', () => {
  const base = L.marcarAlternativa(L.estadoInicialRefazer(FILA), 1);
  const ok = L.aplicarResultado(base, { acertou: true, gabarito: 'B', justificativa: 'j' });
  assert.deepEqual([ok.respondida, ok.acertos, ok.erros], [true, 1, 0]);
  const ruim = L.aplicarResultado(base, { acertou: false, gabarito: 'B', justificativa: 'j' });
  assert.deepEqual([ruim.acertos, ruim.erros], [0, 1]);
});

test('aplicarResultado: guarda se a alternativa certa tinha sido riscada', () => {
  let e = L.alternarCorte(L.estadoInicialRefazer(FILA), 1);   // risca a B (gabarito)
  e = L.marcarAlternativa(e, 0);
  const r = L.aplicarResultado(e, { acertou: false, gabarito: 'B', justificativa: '' });
  assert.equal(r.riscouAGabarito, true);
});

test('proxima: avança, limpa cortes/marcação e mantém o placar', () => {
  let e = L.aplicarResultado(L.alternarCorte(L.marcarAlternativa(L.estadoInicialRefazer(FILA), 1), 2), { acertou: true, gabarito: 'B', justificativa: '' });
  e = L.proxima(e);
  assert.equal(e.indice, 1);
  assert.deepEqual(e.cortadas, []);
  assert.equal(e.marcada, null);
  assert.equal(e.respondida, false);
  assert.equal(e.acertos, 1);
});

test('proxima: depois da última questão, marca o fim', () => {
  const e = L.proxima({ ...L.estadoInicialRefazer(FILA), indice: 1 });
  assert.equal(e.fim, true);
});

test('refazerEsta: limpa a questão atual mas mantém o placar', () => {
  const base = L.aplicarResultado(L.marcarAlternativa(L.estadoInicialRefazer(FILA), 1), { acertou: true, gabarito: 'B', justificativa: '' });
  const e = L.refazerEsta(base);
  assert.equal(e.respondida, false); assert.equal(e.marcada, null); assert.equal(e.indice, 0);
  assert.equal(e.acertos, 1);
});

test('questaoAtual: devolve a questão do índice', () => {
  assert.equal(L.questaoAtual({ ...L.estadoInicialRefazer(FILA), indice: 1 }).id, 11);
});

test('aplicarResultado: guarda o id das questões erradas na rodada', () => {
  const base = L.marcarAlternativa(L.estadoInicialRefazer(FILA), 0);
  const e = L.aplicarResultado(base, { acertou: false, gabarito: 'B', justificativa: '' });
  assert.deepEqual(e.errouIds, [10]);
});

test('aplicarResultado: acertar depois tira a questão da lista de erradas', () => {
  const base = L.marcarAlternativa(L.estadoInicialRefazer(FILA), 0);
  let e = L.aplicarResultado(base, { acertou: false, gabarito: 'B', justificativa: '' });
  e = L.marcarAlternativa(L.refazerEsta(e), 1);
  e = L.aplicarResultado(e, { acertou: true, gabarito: 'B', justificativa: '' });
  assert.deepEqual(e.errouIds, []);
});

test('filaDasErradas: só as questões que ficaram erradas, na mesma ordem', () => {
  const e = { ...L.estadoInicialRefazer(FILA), errouIds: [11] };
  assert.deepEqual(L.filaDasErradas(e).map(q => q.id), [11]);
});

test('sugestoes: assuntos distintos, sem vazios, em ordem; filtrados pela matéria', () => {
  const lista = [
    Q({ id: 1, materia_nome: 'Dir. Financeiro', materia_cor: '#d4537e', assunto: 'Restos a pagar' }), Q({ id: 2, materia_nome: 'Dir. Financeiro', materia_cor: '#d4537e', assunto: 'Restos a pagar' }),
    Q({ id: 3, materia_nome: 'Dir. Financeiro', materia_cor: '#d4537e', assunto: 'Créditos adicionais' }), Q({ id: 4, materia_nome: 'Contabilidade', assunto: 'Depreciação' }),
    Q({ id: 5, materia_nome: 'Dir. Financeiro', materia_cor: '#d4537e', assunto: '' }),
  ];
  assert.deepEqual(L.sugestoes(lista, 'assunto', 'Dir. Financeiro'), ['Créditos adicionais', 'Restos a pagar']);
  assert.deepEqual(L.sugestoes(lista, 'assunto', null), ['Créditos adicionais', 'Depreciação', 'Restos a pagar']);
});

test('sugestoes: bancas de todas as matérias', () => {
  const lista = [Q({ banca: 'FGV' }), Q({ id: 2, banca: 'FCC' }), Q({ id: 3, banca: 'FCC' })];
  assert.deepEqual(L.sugestoes(lista, 'banca', 'Dir. Financeiro'), ['FCC', 'FGV']);
});

test('validarFormulario: a cor da matéria não é obrigatória, mas o nome tem limite', () => {
  assert.equal(L.validarFormulario(FORM({ materia_cor: '' })).ok, true);
  assert.ok(L.validarFormulario(FORM({ materia_nome: 'x'.repeat(101) })).erros.materia);
});

test('montarPayload: leva o nome e a cor da matéria', () => {
  const p = L.montarPayload(FORM({ materia_nome: '  Contabilidade ', materia_cor: '#1d9e75' }));
  assert.equal(p.materia_nome, 'Contabilidade'); assert.equal(p.materia_cor, '#1d9e75');
  assert.equal('categoria_id' in p, false);
});

// ── matérias do formulário: as do app + as que já existem no caderno ───────
const CAT = (id, name, color) => ({ id, name, color });

test('opcoesDeMateria: as matérias do app vêm primeiro, com os próprios ids', () => {
  const o = L.opcoesDeMateria([CAT(3, 'Auditoria', '#a78bfa'), CAT(1, 'Contabilidade', '#2dd4bf')], []);
  assert.deepEqual(o.map(x => [x.id, x.name, x.color]), [[3, 'Auditoria', '#a78bfa'], [1, 'Contabilidade', '#2dd4bf']]);
});

test('opcoesDeMateria: junta as matérias que só existem no caderno, sem repetir', () => {
  const qs = [Q({ materia_nome: 'Contabilidade', materia_cor: '#000000' }), Q({ id: 2, materia_nome: 'Português', materia_cor: '#fb923c' }),
              Q({ id: 3, materia_nome: 'Português', materia_cor: '#fb923c' }), Q({ id: 4, materia_nome: 'Direito', materia_cor: '#e879f9' })];
  const o = L.opcoesDeMateria([CAT(1, 'Contabilidade', '#2dd4bf')], qs);
  assert.deepEqual(o.map(x => x.name), ['Contabilidade', 'Direito', 'Português']);
  assert.equal(o[0].color, '#2dd4bf', 'a cor atual do app vence a cor guardada na questão');
  assert.equal(o[2].color, '#fb923c');
});

test('opcoesDeMateria: com o app sem nenhuma matéria (depois de um novo ciclo), o caderno ainda oferece as suas', () => {
  const o = L.opcoesDeMateria([], [Q({ materia_nome: 'Direito', materia_cor: '#e879f9' })]);
  assert.deepEqual(o.map(x => x.name), ['Direito']);
});

test('opcoesDeMateria: os ids são únicos e não colidem com os do app', () => {
  const o = L.opcoesDeMateria([CAT(1, 'A', '#111111'), CAT(2, 'B', '#222222')], [Q({ materia_nome: 'C' }), Q({ id: 2, materia_nome: 'D' })]);
  assert.equal(new Set(o.map(x => x.id)).size, 4);
  assert.ok(o.slice(2).every(x => x.id >= 100000));
});

test('opcoesDeMateria: ignora o nome em maiúsculas/minúsculas ao detectar repetição', () => {
  const o = L.opcoesDeMateria([CAT(1, 'Contabilidade', '#2dd4bf')], [Q({ materia_nome: 'contabilidade' })]);
  assert.equal(o.length, 1);
});

// ── painel de desempenho ───────────────────────────────────────────────────
test('FILTRO_VAZIO: a situação começa vazia', () => { assert.equal(L.FILTRO_VAZIO.situacao, ''); });

test('situacaoDe: dominada, para revisar ou ainda não refeita', () => {
  assert.equal(L.situacaoDe(Q({ ultima_acertou: true })), 'dominadas');
  assert.equal(L.situacaoDe(Q({ ultima_acertou: false })), 'revisar');
  assert.equal(L.situacaoDe(Q({ ultima_acertou: null })), 'novas');
});

test('passaFiltro: situação dominadas e novas', () => {
  assert.equal(L.passaFiltro(Q({ ultima_acertou: true }), F({ situacao: 'dominadas' })), true);
  assert.equal(L.passaFiltro(Q({ ultima_acertou: false }), F({ situacao: 'dominadas' })), false);
  assert.equal(L.passaFiltro(Q({ ultima_acertou: null }), F({ situacao: 'novas' })), true);
  assert.equal(L.passaFiltro(Q({ ultima_acertou: true }), F({ situacao: 'novas' })), false);
});

const OITO = [
  Q({ id: 1, tentativas: 3, acertos: 1, ultima_acertou: false }), Q({ id: 2, tentativas: 1, acertos: 1, ultima_acertou: true }),
  Q({ id: 3 }), Q({ id: 4, tentativas: 2, acertos: 0, ultima_acertou: false }), Q({ id: 5, tentativas: 2, acertos: 2, ultima_acertou: true }),
  Q({ id: 6, tentativas: 1, acertos: 1, ultima_acertou: true }), Q({ id: 7 }), Q({ id: 8 }),
];

test('resumoGeral: conta o caderno inteiro', () => {
  assert.deepEqual(L.resumoGeral(OITO), {
    total: 8, dominadas: 3, revisar: 2, novas: 3, tentativas: 9, acertos: 5, erros: 4, taxaAcerto: 56, pctDominadas: 38,
  });
});

test('resumoGeral: caderno vazio não inventa porcentagem', () => {
  assert.deepEqual(L.resumoGeral([]), { total: 0, dominadas: 0, revisar: 0, novas: 0, tentativas: 0, acertos: 0, erros: 0, taxaAcerto: null, pctDominadas: 0 });
});

test('resumoGeral: as três situações sempre somam o total', () => {
  const r = L.resumoGeral(OITO);
  assert.equal(r.dominadas + r.revisar + r.novas, r.total);
});
