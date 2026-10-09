import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../src/js/questoes-visual.js';
import * as L from '../src/js/questoes-logica.js';

const Q = (o = {}) => ({
  id: 5, materia_nome: 'Dir. Financeiro', materia_cor: '#d4537e', assunto: 'Restos a pagar', banca: 'FCC',
  tipo: 'ME', enunciado: 'Qual alternativa está correta?', alternativas: ['primeira', 'segunda', 'terceira'], gabarito: 'B',
  justificativa: 'Porque o art. 36 diz isso.', tentativas: 0, acertos: 0, ultima_acertou: null, ...o,
});
const CE = (o = {}) => Q({ tipo: 'CE', alternativas: [], gabarito: 'C', enunciado: 'Julgue o item.', ...o });
const rodada = (qs = [Q(), CE({ id: 6 })]) => L.estadoInicialRefazer(qs);

// ── lista ──────────────────────────────────────────────────────────────────
test('htmlLinha: mostra matéria, assunto, banca, tipo e enunciado', () => {
  const h = V.htmlLinha(Q());
  for (const t of ['Dir. Financeiro', 'Restos a pagar', 'FCC', 'Múltipla escolha', 'Qual alternativa está correta?']) assert.ok(h.includes(t), t);
});

test('htmlLinha: texto colado com HTML é escapado (não executa)', () => {
  const h = V.htmlLinha(Q({ enunciado: '<img src=x onerror=alert(1)>', assunto: '"><script>x</script>' }));
  assert.ok(!h.includes('<img src=x'));
  assert.ok(!h.includes('<script>'));
  assert.ok(h.includes('&lt;img'));
});

test('htmlLinha: ícone de status conforme a última tentativa', () => {
  assert.match(V.htmlLinha(Q()), /q-st-nd/);
  assert.match(V.htmlLinha(Q({ tentativas: 1, ultima_acertou: true })), /q-st-ok/);
  assert.match(V.htmlLinha(Q({ tentativas: 2, ultima_acertou: false })), /q-st-err/);
});

test('htmlLinha: mostra o texto de status', () => {
  assert.match(V.htmlLinha(Q({ tentativas: 3, ultima_acertou: false })), /Errou na última · 3 tentativas/);
});

test('htmlLinha: sem assunto e sem banca não deixa lacunas', () => {
  const h = V.htmlLinha(Q({ assunto: '', banca: '' }));
  assert.ok(!h.includes('q-assunto'));
  assert.ok(!h.includes('>FCC<'));
});

test('htmlLinha: questão sem matéria aparece como "Sem matéria"', () => {
  assert.match(V.htmlLinha(Q({ materia_nome: '' })), /Sem matéria/);
});

test('htmlLinha: abrir pela linha, e botões de editar/excluir com rótulo acessível', () => {
  const h = V.htmlLinha(Q());
  assert.match(h, /onclick="Questoes\.abrir\(5\)"/);
  assert.match(h, /aria-label="Editar questão"/);
  assert.match(h, /aria-label="Excluir questão"/);
  assert.match(h, /event\.stopPropagation\(\); Questoes\.excluir\(5\)/);
});

test('htmlOpcoes: primeira opção é "todas" com o total, e a selecionada fica marcada', () => {
  const h = V.htmlOpcoes({ total: 4, opcoes: [{ valor: '1', rotulo: 'Penal', n: 3 }, { valor: '2', rotulo: 'Civil', n: 1 }] }, 'Todas as matérias', '2');
  assert.match(h, /<option value="">Todas as matérias \(4\)<\/option>/);
  assert.match(h, /<option value="1">Penal \(3\)<\/option>/);
  assert.match(h, /<option value="2" selected>Civil \(1\)<\/option>/);
});

test('htmlOpcoes: nomes com aspas e HTML são escapados', () => {
  const h = V.htmlOpcoes({ total: 1, opcoes: [{ valor: 'a"b', rotulo: '<b>x</b>', n: 1 }] }, 'Todos', '');
  assert.ok(!h.includes('<b>x</b>'));
  assert.ok(h.includes('value="a&quot;b"'));
});

test('htmlSegTipo: três botões com contagem; o ativo fica pressionado', () => {
  const h = V.htmlSegTipo({ todos: 4, ME: 3, CE: 1 }, 'CE');
  assert.match(h, /Todos \(4\)/);
  assert.match(h, /Múltipla escolha \(3\)/);
  assert.match(h, /Certo ou errado \(1\)/);
  assert.match(h, /aria-pressed="true"[^>]*>Certo ou errado/);
});

test('htmlTopoAcoes: o botão de resolver só aparece com questões e informa a quantidade', () => {
  assert.match(V.htmlTopoAcoes(12), /aria-label="Resolver 12 questões"/);
  assert.match(V.htmlTopoAcoes(1), /aria-label="Resolver 1 questão"/);
  assert.ok(!V.htmlTopoAcoes(0).includes('iniciarRefazer'));
  assert.match(V.htmlTopoAcoes(0), /Nova questão/);
});

test('estados vazios: caderno vazio convida a cadastrar; sem resultado oferece limpar', () => {
  assert.match(V.htmlVazioCaderno(), /Seu caderno está vazio/);
  assert.match(V.htmlVazioCaderno(), /Questoes\.abrirNovo\(\)/);
  assert.match(V.htmlSemResultados(), /Nenhuma questão com esses filtros/);
  assert.match(V.htmlSemResultados(), /Questoes\.limpar\(\)/);
});

// ── modo refazer ───────────────────────────────────────────────────────────
test('htmlCartaoRefazer: progresso, placar e identificação da questão', () => {
  const h = V.htmlCartaoRefazer(rodada());
  assert.match(h, /Questão 1 de 2/);
  assert.match(h, /0 acertos · 0 erros/);
  for (const t of ['Dir. Financeiro', 'Restos a pagar', 'FCC', 'Múltipla escolha']) assert.ok(h.includes(t), t);
});

test('htmlCartaoRefazer: múltipla escolha tem uma tesoura por alternativa, com rótulo acessível', () => {
  const h = V.htmlCartaoRefazer(rodada());
  assert.equal((h.match(/class="q-tesoura"/g) || []).length, 3);
  assert.match(h, /aria-label="Riscar alternativa A"/);
  assert.match(h, /aria-pressed="false"/);
  assert.match(h, /onclick="Questoes\.cortar\(0\)"/);
});

test('htmlCartaoRefazer: alternativa riscada fica tachada, não marcável, e a tesoura vira "restaurar"', () => {
  const h = V.htmlCartaoRefazer(L.alternarCorte(rodada(), 1));
  assert.match(h, /q-alt cortada/);
  assert.match(h, /aria-label="Restaurar alternativa B"/);
  assert.match(h, /aria-pressed="true"/);
  assert.match(h, /href="#i-undo"/);
  assert.match(h, /aria-disabled="true"[^>]*onclick="Questoes\.marcar\(1\)"/);
});

test('htmlCartaoRefazer: alternativa marcada fica destacada', () => {
  const h = V.htmlCartaoRefazer(L.marcarAlternativa(rodada(), 2));
  assert.match(h, /q-alt marcada/);
  assert.match(h, /aria-checked="true"/);
});

test('htmlCartaoRefazer: certo ou errado não tem tesoura e usa C e E', () => {
  const h = V.htmlCartaoRefazer({ ...rodada(), indice: 1 });
  assert.ok(!h.includes('q-tesoura'));
  assert.match(h, /Certo/); assert.match(h, /Errado/);
  assert.match(h, /<span class="q-letra">C<\/span>/);
  assert.ok(!h.includes('riscar uma alternativa'));
});

test('htmlCartaoRefazer: antes de responder mostra o botão e o aviso de erro, sem gabarito nem justificativa', () => {
  const pedido = L.pedirResposta(rodada()).estado;
  const h = V.htmlCartaoRefazer(pedido);
  assert.match(h, /Questoes\.responder\(\)/);
  assert.match(h, /Escolha uma alternativa antes de responder/);
  assert.ok(!h.includes('Porque o art. 36'));
  assert.ok(!h.includes('Você acertou'));
});

test('htmlCartaoRefazer: acerto mostra o resultado, a justificativa e destaca a certa', () => {
  let e = L.marcarAlternativa(rodada(), 1);
  e = L.aplicarResultado(e, { acertou: true, gabarito: 'B', justificativa: 'Porque o art. 36 diz isso.' });
  const h = V.htmlCartaoRefazer(e);
  assert.match(h, /Você acertou/);
  assert.match(h, /q-alt certa/);
  assert.match(h, /Porque o art\. 36 diz isso\./);
  assert.match(h, /Próxima questão/);
  assert.match(h, /Refazer esta/);
  assert.ok(!h.includes('Questoes.responder()'));
});

test('htmlCartaoRefazer: erro mostra o gabarito, marca a errada e a certa', () => {
  let e = L.marcarAlternativa(rodada(), 0);
  e = L.aplicarResultado(e, { acertou: false, gabarito: 'B', justificativa: '' });
  const h = V.htmlCartaoRefazer(e);
  assert.match(h, /Você errou\. O gabarito é B\./);
  assert.match(h, /q-alt errada/);
  assert.match(h, /q-alt certa/);
});

test('htmlCartaoRefazer: sem justificativa, não mostra o bloco', () => {
  let e = L.marcarAlternativa(rodada([Q({ justificativa: '' })]), 1);
  e = L.aplicarResultado(e, { acertou: true, gabarito: 'B', justificativa: '' });
  assert.ok(!V.htmlCartaoRefazer(e).includes('Justificativa'));
});

test('htmlCartaoRefazer: avisa quando a alternativa certa tinha sido riscada', () => {
  let e = L.alternarCorte(rodada(), 1);
  e = L.marcarAlternativa(e, 0);
  e = L.aplicarResultado(e, { acertou: false, gabarito: 'B', justificativa: '' });
  assert.match(V.htmlCartaoRefazer(e), /Você tinha riscado a alternativa B, que era a correta\./);
});

test('htmlCartaoRefazer: depois de responder, as tesouras ficam travadas', () => {
  let e = L.marcarAlternativa(rodada(), 1);
  e = L.aplicarResultado(e, { acertou: true, gabarito: 'B', justificativa: '' });
  assert.equal((V.htmlCartaoRefazer(e).match(/class="q-tesoura"[^>]*disabled/g) || []).length, 3);
});

test('htmlCartaoRefazer: na última questão o botão vira "Ver resultado"', () => {
  let e = L.marcarAlternativa(rodada([Q()]), 1);
  e = L.aplicarResultado(e, { acertou: true, gabarito: 'B', justificativa: '' });
  assert.match(V.htmlCartaoRefazer(e), /Ver resultado/);
});

test('htmlCartaoRefazer: enunciado e alternativas com HTML colado são escapados', () => {
  const h = V.htmlCartaoRefazer(rodada([Q({ enunciado: '<b onclick=x>oi</b>', alternativas: ['<i>a</i>', 'b'] })]));
  assert.ok(!h.includes('<b onclick'));
  assert.ok(!h.includes('<i>a</i>'));
});

test('htmlFim: resumo da rodada e botão pras erradas só quando houve erro', () => {
  const base = { ...rodada(), fim: true, acertos: 3, erros: 1, errouIds: [5] };
  const h = V.htmlFim(base);
  assert.match(h, /75%/);
  assert.match(h, /Refazer as erradas \(1\)/);
  assert.match(h, /Voltar ao caderno/);
  assert.ok(!V.htmlFim({ ...base, erros: 0, acertos: 4, errouIds: [] }).includes('Refazer as erradas'));
});

// ── formulário ─────────────────────────────────────────────────────────────
test('htmlAlternativasForm: 5 linhas com letra, marcador de gabarito e texto escapado', () => {
  const h = V.htmlAlternativasForm(['a "x"', 'b', '', '', ''], 'B');
  assert.equal((h.match(/class="q-edit-alt"/g) || []).length, 5);
  assert.match(h, /aria-label="Marcar a alternativa B como correta"[^>]*aria-checked="true"|aria-checked="true"[^>]*aria-label="Marcar a alternativa B como correta"/);
  assert.ok(h.includes('a &quot;x&quot;'));
  assert.match(h, /id="qm-alt-0"/);
  assert.match(h, /<label[^>]*for="qm-alt-0"/);
});

test('htmlCartaoRefazer: depois de responder, a alternativa correta aparece limpa mesmo se tinha sido riscada', () => {
  let e = L.alternarCorte(rodada(), 1);            // risca a B (o gabarito)
  e = L.marcarAlternativa(e, 0);
  e = L.aplicarResultado(e, { acertou: false, gabarito: 'B', justificativa: '' });
  const h = V.htmlCartaoRefazer(e);
  assert.match(h, /q-alt certa/);
  assert.ok(!h.includes('q-alt cortada'), 'a correta não pode ficar tachada e esmaecida');
  assert.match(h, /Você tinha riscado a alternativa B/);
});

test('htmlCartaoRefazer: depois de responder, as outras riscadas continuam riscadas', () => {
  let e = L.alternarCorte(rodada(), 2);            // risca a C (errada)
  e = L.marcarAlternativa(e, 1);
  e = L.aplicarResultado(e, { acertou: true, gabarito: 'B', justificativa: '' });
  assert.match(V.htmlCartaoRefazer(e), /q-alt cortada/);
});

test('htmlAlternativasForm: editar uma alternativa limpa o aviso de erro das alternativas', () => {
  assert.match(V.htmlAlternativasForm(['a', 'b'], ''), /oninput="Questoes\.editou\('alternativas'\)"/);
});

// ── painel de desempenho ───────────────────────────────────────────────────
const OITO = [
  Q({ id: 1, tentativas: 3, acertos: 1, ultima_acertou: false }), Q({ id: 2, tentativas: 1, acertos: 1, ultima_acertou: true }),
  Q({ id: 3 }), Q({ id: 4, tentativas: 2, acertos: 0, ultima_acertou: false }), Q({ id: 5, tentativas: 2, acertos: 2, ultima_acertou: true }),
  Q({ id: 6, tentativas: 1, acertos: 1, ultima_acertou: true }), Q({ id: 7 }), Q({ id: 8 }),
];

test('htmlPainel: mostra a taxa de acerto, os erros e as tentativas', () => {
  const h = V.htmlPainel(L.resumoGeral(OITO), '');
  assert.match(h, /Seu desempenho/);
  assert.match(h, /56%/); assert.match(h, /4 erros/); assert.match(h, /9 tentativas/);
});

test('htmlPainel: quatro cartões com os números certos', () => {
  const h = V.htmlPainel(L.resumoGeral(OITO), '');
  for (const t of ['No caderno', 'Dominadas', 'Para revisar', 'Ainda não refeitas']) assert.ok(h.includes(t), t);
  assert.match(h, /q-kpi-num">8</); assert.match(h, /q-kpi-num ok">3</); assert.match(h, /q-kpi-num err">2</); assert.match(h, /q-kpi-num nd">3</);
  assert.match(h, /38%/);
});

test('htmlPainel: cada cartão é um botão que aplica a situação', () => {
  const h = V.htmlPainel(L.resumoGeral(OITO), '');
  for (const s of ['todas', 'dominadas', 'revisar', 'novas']) assert.ok(h.includes(`onclick="Questoes.situacao('${s}')"`), s);
});

test('htmlPainel: só o cartão ativo fica pressionado (sem filtro, é o "No caderno")', () => {
  const sem = V.htmlPainel(L.resumoGeral(OITO), '');
  assert.equal((sem.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(sem, /aria-pressed="true" onclick="Questoes\.situacao\('todas'\)"/);
  const rev = V.htmlPainel(L.resumoGeral(OITO), 'revisar');
  assert.equal((rev.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(rev, /aria-pressed="true" onclick="Questoes\.situacao\('revisar'\)"/);
});

test('htmlPainel: a barra mostra acertos e erros das tentativas (o mesmo número que está escrito ao lado)', () => {
  const h = V.htmlPainel(L.resumoGeral(OITO), '');                 // 5 acertos e 4 erros em 9 tentativas
  assert.match(h, /class="ok" style="flex:5 1 0"/);
  assert.match(h, /class="err" style="flex:4 1 0"/);
  assert.ok(!h.includes('class="nd"'));
});

test('htmlPainel: 4 acertos e 1 erro dão uma barra 80% verde e 20% vermelha', () => {
  const um = [Q({ id: 1, tentativas: 5, acertos: 4, ultima_acertou: true })];
  const h = V.htmlPainel(L.resumoGeral(um), '');
  assert.match(h, /class="ok" style="flex:4 1 0"/);
  assert.match(h, /class="err" style="flex:1 1 0"/);
  assert.match(h, /80%/);
});

test('htmlPainel: sem erros a barra é toda verde; sem tentativas ela fica vazia', () => {
  const sem = V.htmlPainel(L.resumoGeral([Q({ id: 1, tentativas: 2, acertos: 2, ultima_acertou: true })]), '');
  assert.match(sem, /class="ok"/); assert.ok(!sem.includes('class="err"'));
  const nada = V.htmlPainel(L.resumoGeral([Q({ id: 1 })]), '');
  assert.ok(!nada.includes('class="ok"') && !nada.includes('class="err"'));
});

test('htmlPainel: sem tentativas não mostra porcentagem', () => {
  const h = V.htmlPainel(L.resumoGeral([Q({ id: 1 }), Q({ id: 2 })]), '');
  assert.match(h, /Ainda sem tentativas/);
  assert.ok(!h.includes('% de acerto'));
});

test('htmlPainel: singular', () => {
  const h = V.htmlPainel(L.resumoGeral([Q({ tentativas: 1, acertos: 0, ultima_acertou: false })]), '');
  assert.match(h, /1 erro em 1 tentativa\b/);
});

test('htmlPainel: caderno vazio não desenha painel', () => {
  assert.equal(V.htmlPainel(L.resumoGeral([]), ''), '');
});

// ── revisão espaçada ───────────────────────────────────────────────────────
const HOJE = new Date(2026, 9, 8, 12, 0, 0);
const comHoje = (fn) => { const r = L.usarRelogio(() => HOJE); try { fn(); } finally { r(); } };
const diasAtras = (n) => { const d = new Date(HOJE); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 19).replace('T', ' '); };
const ACERTOU = (seguidos, dias, o = {}) => Q({ ultima_acertou: true, acertos_seguidos: seguidos, ultima_respondida_em: diasAtras(dias), tentativas: seguidos, acertos: seguidos, ...o });

test('htmlLinha: questão vencida tem ícone próprio e avisa que venceu', () => {
  comHoje(() => {
    const h = V.htmlLinha(ACERTOU(3, 10));
    assert.match(h, /q-st-venc/); assert.match(h, /href="#i-clock"/); assert.match(h, /venceu há 3 dias/);
  });
});

test('htmlLinha: questão em dia continua com o ✓ e diz quando revisar', () => {
  comHoje(() => {
    const h = V.htmlLinha(ACERTOU(2, 0));
    assert.match(h, /q-st-ok/); assert.match(h, /revisar em 3 dias/);
  });
});

test('htmlPainel: o cartão "Vencidas" mostra o número e aplica a situação', () => {
  comHoje(() => {
    const r = L.resumoGeral([ACERTOU(1, 0), ACERTOU(1, 1), ACERTOU(3, 10), Q({ ultima_acertou: false })]);
    const h = V.htmlPainel(r, '');
    assert.match(h, /Vencidas/); assert.match(h, /q-kpi-num venc">2</); assert.match(h, /Questoes\.situacao\('vencidas'\)/);
    assert.match(h, /q-kpi-num ok">1</);
  });
});

test('htmlPainel: o botão "Revisar hoje" soma o que errou e o que venceu', () => {
  comHoje(() => {
    const r = L.resumoGeral([ACERTOU(1, 1), ACERTOU(3, 10), Q({ ultima_acertou: false }), ACERTOU(1, 0)]);
    const h = V.htmlPainel(r, '');
    assert.match(h, /onclick="Questoes\.revisarHoje\(\)"/); assert.match(h, /Revisar hoje · 3/);
  });
});

test('htmlPainel: sem nada pendente, avisa que a revisão de hoje está em dia', () => {
  comHoje(() => {
    const h = V.htmlPainel(L.resumoGeral([ACERTOU(1, 0), ACERTOU(2, 0)]), '');
    assert.match(h, /Revisão de hoje em dia/); assert.ok(!h.includes('revisarHoje'));
  });
});

test('htmlPainel: com o caderno todo ainda por fazer, não diz que está "em dia"', () => {
  const h = V.htmlPainel(L.resumoGeral([Q({ id: 1 }), Q({ id: 2 })]), '');
  assert.ok(!h.includes('Revisão de hoje em dia') && !h.includes('revisarHoje'));
});

test('htmlCartaoRefazer: ao acertar, mostra quando será a próxima revisão', () => {
  let e = L.marcarAlternativa(rodada(), 1);
  e = L.aplicarResultado(e, { acertou: true, gabarito: 'B', justificativa: '', acertos_seguidos: 1 });
  assert.match(V.htmlCartaoRefazer(e), /Você acertou · próxima revisão amanhã/);
  e = L.aplicarResultado(L.refazerEsta(e), { acertou: true, gabarito: 'B', justificativa: '', acertos_seguidos: 3 });
  assert.match(V.htmlCartaoRefazer(e), /próxima revisão em 7 dias/);
});

test('htmlCartaoRefazer: ao errar, não promete data de revisão', () => {
  let e = L.marcarAlternativa(rodada(), 0);
  e = L.aplicarResultado(e, { acertou: false, gabarito: 'B', justificativa: '', acertos_seguidos: 0 });
  assert.ok(!V.htmlCartaoRefazer(e).includes('próxima revisão'));
});

test('htmlCartaoRefazer: depois de responder, o botão de avançar está marcado pra receber o foco do teclado', () => {
  let e = L.marcarAlternativa(rodada(), 1);
  e = L.aplicarResultado(e, { acertou: true, gabarito: 'B', justificativa: '' });
  assert.match(V.htmlCartaoRefazer(e), /data-foco="proxima"[^>]*onclick="Questoes\.proxima\(\)"|onclick="Questoes\.proxima\(\)"[^>]*data-foco="proxima"/);
});

// ── contagem só para leitor de tela (a linha visível foi removida) ──────────
test('htmlContagemOculta: avisa a quantidade, sem aparecer na tela', () => {
  assert.match(V.htmlContagemOculta(3), /class="sr-only" role="status">3 questões</);
  assert.match(V.htmlContagemOculta(1), />1 questão</);
});

// ── navegação entre as questões ───────────────────────────────────────────
const OK3 = { acertou: true, gabarito: 'B', justificativa: '' };
const tres = () => L.estadoInicialRefazer([Q({ id: 1 }), Q({ id: 2 }), Q({ id: 3 })]);

test('htmlCartaoRefazer: setas pra voltar e avançar, com rótulo acessível', () => {
  const h = V.htmlCartaoRefazer(L.seguinte(tres()));
  assert.match(h, /data-nav="anterior"[^>]*onclick="Questoes\.anterior\(\)"|onclick="Questoes\.anterior\(\)"[^>]*data-nav="anterior"/);
  assert.match(h, /data-nav="seguinte"[^>]*onclick="Questoes\.seguinte\(\)"|onclick="Questoes\.seguinte\(\)"[^>]*data-nav="seguinte"/);
  assert.match(h, /aria-label="Questão anterior"/); assert.match(h, /aria-label="Ir para a próxima questão"/);
});

test('htmlCartaoRefazer: na primeira questão não dá pra voltar; na última não dá pra avançar', () => {
  const primeira = V.htmlCartaoRefazer(tres());
  assert.match(primeira, /data-nav="anterior"[^>]*disabled/); assert.ok(!/data-nav="seguinte"[^>]*disabled/.test(primeira));
  const ultima = V.htmlCartaoRefazer(L.seguinte(L.seguinte(tres())));
  assert.match(ultima, /data-nav="seguinte"[^>]*disabled/); assert.ok(!/data-nav="anterior"[^>]*disabled/.test(ultima));
});

test('htmlCartaoRefazer: a barra de progresso conta as respondidas, não a posição', () => {
  const andou = V.htmlCartaoRefazer(L.seguinte(L.seguinte(tres())));
  assert.match(andou, /Questão 3 de 3/); assert.match(andou, /aria-valuenow="0"/);
  const respondeu = V.htmlCartaoRefazer(L.aplicarResultado(L.marcarAlternativa(L.seguinte(tres()), 1), OK3));
  assert.match(respondeu, /aria-valuenow="1"/);
});

test('htmlFim: avisa das questões puladas e oferece ir até elas', () => {
  let e = L.proxima(L.aplicarResultado(L.marcarAlternativa(tres(), 1), OK3));          // respondeu a 1ª
  e = L.seguinte(e); e = L.proxima(L.aplicarResultado(L.marcarAlternativa(e, 1), OK3)); // respondeu a 3ª (pulou a 2ª) → fim
  const h = V.htmlFim(e);
  assert.match(h, /pulou 1 questão/); assert.match(h, /Questoes\.irParaPulada\(\)/);
});

test('htmlFim: sem puladas, o aviso não aparece', () => {
  let e = L.estadoInicialRefazer([Q({ id: 1 })]);
  e = L.proxima(L.aplicarResultado(L.marcarAlternativa(e, 1), OK3));
  assert.ok(!V.htmlFim(e).includes('pulou'));
});