import test from 'node:test';
import assert from 'node:assert/strict';

// Captura a configuração que o app entrega ao Chart.js, sem desenhar de verdade.
let config = null;
globalThis.Chart = class { constructor(ctx, cfg) { config = cfg; } destroy() {} };
const canvas = { getContext: () => ({}), parentElement: { className: 'chart-wrap', innerHTML: '' } };
const generico = () => ({ innerHTML: '', textContent: '', style: {}, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){} });
globalThis.document = { getElementById: (id) => (id === 'chart' ? canvas : generico()), querySelectorAll: () => [], addEventListener(){}, documentElement: {} };
globalThis.window = { addEventListener(){} };
globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => ({ '--text': '#111111', '--text2': '#444444', '--border': '#dddddd', '--surface': '#ffffff' }[n] || '') });

// 1 sessão de 1h 21min 56s: o cartão "Total estudado" mostra 1h 21m
const SESSAO = { period_key: '2026-10-05', category_name: 'Dir. Tributário', category_color: '#e879f9', total_seconds: 4916 };
globalThis.fetch = async () => ({ ok: true, json: async () => [SESSAO] });

const S = await import('../src/js/sessions.js');
await S.loadChart();
const plugin = config && config.plugins.find(p => p.id === 'totaisNoTopo');

function desenhar() {
  const chamadas = [];
  const ctx = { font: '', save(){}, restore(){}, fillText(texto, x, y) { chamadas.push({ texto, x, y, fonte: this.font }); } };
  plugin.afterDatasetsDraw({
    ctx, data: config.data,
    scales: { x: { getPixelForValue: (i) => 100 + i * 50 }, y: { getPixelForValue: () => 80 } },
  });
  return chamadas;
}

test('o gráfico foi montado', () => {
  assert.ok(config, 'Chart não foi chamado');
  assert.ok(plugin, 'plugin dos totais não encontrado');
});

test('o eixo vertical reserva folga acima da barra mais alta (o total não bate na legenda)', () => {
  const grace = config.options.scales.y.grace;
  assert.match(String(grace), /^\d+%$/);
  assert.ok(parseInt(grace) >= 15, `folga de ${grace} é pouca`);
});

test('a legenda tem espaçamento próprio', () => {
  assert.ok(config.options.plugins.legend.labels.padding >= 12);
});

test('o total no topo da barra é maior que 14px e em negrito', () => {
  const [c] = desenhar();
  const px = Number(/(\d+)px/.exec(c.fonte)[1]);
  assert.ok(px >= 15, `fonte de ${px}px`);
  assert.match(c.fonte, /^(600|700)/);
});

test('o total no topo usa os segundos exatos: bate com o cartão Total estudado (1h 21m, não 1h 22m)', () => {
  assert.deepEqual(config.data.datasets[0].segundos, [4916]);
  const [c] = desenhar();
  assert.equal(c.texto, '1h 21m');
});

test('o total é escrito acima da barra, com respiro', () => {
  const [c] = desenhar();
  assert.ok(c.y < 80, 'deveria ficar acima do topo da barra');
});

test('a dica ao passar o mouse também mostra os segundos exatos', () => {
  const rotulo = config.options.plugins.tooltip.callbacks.label({ dataset: config.data.datasets[0], dataIndex: 0 });
  assert.match(rotulo, /Dir\. Tributário: 1h 21m/);
});
