import test from 'node:test';
import assert from 'node:assert/strict';

function fakeEl() {
  return { innerHTML: '', textContent: '', style: { vars: {}, setProperty(k, v) { this.vars[k] = v; } }, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){} };
}
const els = new Map();
globalThis.document = {
  getElementById: (id) => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); },
  addEventListener(){}, querySelector: () => fakeEl(), querySelectorAll: () => [], createElement: () => fakeEl(), body: fakeEl(),
};
globalThis.window = { addEventListener(){} };

const H = await import('../src/js/heatmap.js');
const dia = (data, segundos, futuro = false) => ({ data, segundos, futuro });

test('nivelDoDia: 0 pra dia sem estudo ou com menos de 1 minuto', () => {
  assert.equal(H.nivelDoDia(0), 0);
  assert.equal(H.nivelDoDia(59), 0);
});

test('nivelDoDia: limites dos 4 níveis (1h, 2h e 3h30)', () => {
  assert.equal(H.nivelDoDia(60), 1);
  assert.equal(H.nivelDoDia(59 * 60), 1);
  assert.equal(H.nivelDoDia(60 * 60), 2);
  assert.equal(H.nivelDoDia(119 * 60), 2);
  assert.equal(H.nivelDoDia(120 * 60), 3);
  assert.equal(H.nivelDoDia(209 * 60), 3);
  assert.equal(H.nivelDoDia(210 * 60), 4);
});

test('hojeLocalISO: formata a data local como YYYY-MM-DD', () => {
  assert.equal(H.hojeLocalISO(new Date(2026, 9, 8, 23, 59)), '2026-10-08');
  assert.equal(H.hojeLocalISO(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('montarDias: gera semanas*7 dias consecutivos, atravessando a virada de mês', () => {
  const dias = H.montarDias('2026-09-28', 2, {}, '2026-10-08');
  assert.equal(dias.length, 14);
  assert.equal(dias[0].data, '2026-09-28');
  assert.equal(dias[3].data, '2026-10-01');
  assert.equal(dias[13].data, '2026-10-11');
});

test('montarDias: marca como futuro só os dias depois de hoje', () => {
  const dias = H.montarDias('2026-09-28', 2, {}, '2026-10-08');
  assert.equal(dias[10].data, '2026-10-08');
  assert.equal(dias[10].futuro, false);
  assert.equal(dias[11].futuro, true);
});

test('montarDias: preenche os segundos de cada dia (0 quando não há registro)', () => {
  const dias = H.montarDias('2026-09-28', 1, { '2026-09-29': 3600 }, '2026-10-08');
  assert.equal(dias[0].segundos, 0);
  assert.equal(dias[1].segundos, 3600);
});

test('calcularSequencias: sem dados, tudo zero', () => {
  assert.deepEqual(H.calcularSequencias([]), { atual: 0, melhor: 0, estudados: 0, total: 0 });
});

test('calcularSequencias: sequência atual conta dias seguidos até hoje', () => {
  const r = H.calcularSequencias([dia('a', 0), dia('b', 3600), dia('c', 3600), dia('d', 3600)]);
  assert.equal(r.atual, 3);
  assert.equal(r.melhor, 3);
});

test('calcularSequencias: se hoje ainda não estudou, a sequência de ontem não quebra', () => {
  const r = H.calcularSequencias([dia('a', 3600), dia('b', 3600), dia('c', 0)]);
  assert.equal(r.atual, 2);
});

test('calcularSequencias: um dia sem estudo no meio zera a corrente e preserva o recorde', () => {
  const r = H.calcularSequencias([dia('a', 3600), dia('b', 3600), dia('c', 3600), dia('d', 0), dia('e', 3600), dia('f', 3600)]);
  assert.equal(r.melhor, 3);
  assert.equal(r.atual, 2);
  assert.equal(r.estudados, 5);
  assert.equal(r.total, 6);
});

test('calcularSequencias: dias futuros são ignorados', () => {
  const r = H.calcularSequencias([dia('a', 3600), dia('b', 0, true), dia('c', 0, true)]);
  assert.equal(r.atual, 1);
  assert.equal(r.total, 1);
});

test('calcularSequencias: menos de 1 minuto não conta como dia estudado', () => {
  const r = H.calcularSequencias([dia('a', 30), dia('b', 30)]);
  assert.equal(r.estudados, 0);
  assert.equal(r.atual, 0);
});

test('desenharHeatmap: desenha todas as células, o nível certo e os números', () => {
  const dados = { inicio: '2026-09-28', semanas: 2, dias: { '2026-10-06': 9000, '2026-10-07': 3600, '2026-10-08': 3600 } };
  H.desenharHeatmap(dados, '2026-10-08');

  const grid = document.getElementById('hm-grid').innerHTML;
  assert.equal((grid.match(/hm-cell/g) || []).length, 14, 'deveria ter 14 células');
  assert.match(grid, /hm-l3/, '2h30 deveria ser nível 3');
  assert.match(grid, /hm-l2/, '1h deveria ser nível 2');
  assert.match(grid, /hm-future/, 'dias depois de hoje deveriam ficar como futuro');
  assert.match(grid, /2h 30m/, 'o texto do dia deveria mostrar o tempo');

  assert.equal(document.getElementById('hm-atual').textContent, '3 dias');
  assert.equal(document.getElementById('hm-melhor').textContent, '3 dias');
  assert.equal(document.getElementById('hm-dias').textContent, '3 de 3');
});

test('desenharHeatmap: singular quando a sequência é de 1 dia', () => {
  H.desenharHeatmap({ inicio: '2026-09-28', semanas: 1, dias: { '2026-10-01': 3600 } }, '2026-10-01');
  assert.equal(document.getElementById('hm-atual').textContent, '1 dia');
});

test('desenharHeatmap: rótulo de mês só na semana que contém o início do mês', () => {
  H.desenharHeatmap({ inicio: '2026-09-28', semanas: 2, dias: {} }, '2026-10-08');
  const grid = document.getElementById('hm-grid').innerHTML;
  assert.match(grid, /<div class="hm-month">out<\/div>/);
  assert.doesNotMatch(grid, /hm-month">set</, 'a semana de 28/09 não contém o dia 1 de setembro');
});

test('desenharHeatmap: rótulos dos dias da semana e número de semanas na grade', () => {
  H.desenharHeatmap({ inicio: '2026-09-28', semanas: 2, dias: {} }, '2026-10-08');
  const grid = document.getElementById('hm-grid');
  assert.match(grid.innerHTML, /hm-daylabel">Seg</);
  assert.match(grid.innerHTML, /hm-daylabel">Qua</);
  assert.match(grid.innerHTML, /hm-daylabel">Sex</);
  assert.equal(document.getElementById('hm-left').style.vars['--hm-n'], '2');
});

test('desenharHeatmap: sem nenhum estudo mostra traço no lugar de "0 de 0"', () => {
  H.desenharHeatmap({ inicio: '2026-09-28', semanas: 2, dias: {} }, '2026-10-08');
  assert.equal(document.getElementById('hm-dias').textContent, '—');
});

test('desenharHeatmap: corta semanas vazias antigas, mas as sequências usam o histórico todo', () => {
  // 30 semanas; só estudou nas 3 últimas
  const dias = { '2026-10-06': 3600, '2026-10-07': 3600, '2026-10-08': 3600 };
  H.desenharHeatmap({ inicio: '2026-03-16', semanas: 30, dias }, '2026-10-08');
  const grid = document.getElementById('hm-grid');
  assert.equal(document.getElementById('hm-left').style.vars['--hm-n'], '16', 'deveria mostrar só 16 semanas, não as 30');
  assert.equal((grid.innerHTML.match(/hm-cell/g) || []).length, 16 * 7);
  assert.equal(document.getElementById('hm-atual').textContent, '3 dias');
});

const seq = (...segs) => segs.map((s, i) => dia(String(i), s));

test('calcularSequencias: total conta a partir do primeiro dia estudado', () => {
  const r = H.calcularSequencias(seq(0, 0, 3600, 0));
  assert.equal(r.total, 2);
  assert.equal(r.estudados, 1);
});

test('recortarDias: sem nenhum estudo, mostra só as últimas N semanas', () => {
  const dias = seq(...Array(70).fill(0));
  assert.equal(H.recortarDias(dias, 4).length, 4 * 7);
  assert.equal(H.recortarDias(dias, 4)[0].data, '42');
});

test('recortarDias: começa uma semana antes do primeiro estudo', () => {
  const dias = seq(...Array(70).fill(0).map((_, i) => (i === 40 ? 3600 : 0)));
  const r = H.recortarDias(dias, 4);   // dia 40 está na semana 5; começa na semana 4 (dia 28)
  assert.equal(r[0].data, '28');
  assert.equal(r.length, 42);
});

test('recortarDias: respeita o mínimo de semanas mesmo com estudo bem recente', () => {
  const dias = seq(...Array(70).fill(0).map((_, i) => (i === 69 ? 3600 : 0)));
  assert.equal(H.recortarDias(dias, 6).length, 6 * 7);
});

test('recortarDias: estudo desde a primeira semana mantém tudo', () => {
  const dias = seq(...Array(70).fill(3600));
  assert.equal(H.recortarDias(dias, 4).length, 70);
});

test('recortarDias: janela menor que o mínimo não corta nada', () => {
  const dias = seq(...Array(14).fill(0));
  assert.equal(H.recortarDias(dias, 12).length, 14);
});
