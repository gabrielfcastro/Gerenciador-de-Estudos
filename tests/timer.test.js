import test from 'node:test';
import assert from 'node:assert/strict';

function fakeEl() {
  return {
    innerHTML: '', textContent: '', value: '', style: { setProperty(){}, removeProperty(){} }, disabled: false,
    classList: { add(){}, remove(){}, toggle(){}, replace(){}, contains(){ return false; } },
    addEventListener(){}, appendChild(){}, setAttribute(){}, remove(){}, focus(){},
    querySelector() { return fakeEl(); }, closest() { return null; },
  };
}
const els = new Map();
const body = { style: { backgroundColor: '' }, appendChild(){} };
globalThis.document = {
  getElementById: (id) => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); },
  querySelector: () => fakeEl(), querySelectorAll: () => [], createElement: () => fakeEl(),
  addEventListener(){}, body, documentElement: {}, title: '',
};
globalThis.window = { addEventListener(){} };

// Simula o tema: o valor de --bg muda quando o usuário alterna claro/escuro.
let bgDoTema = '#c4c9d8'; // claro
let surfaceDoTema = '#f8f9fc';
globalThis.getComputedStyle = () => ({ getPropertyValue: (nome) => (nome === '--surface' ? surfaceDoTema : bgDoTema) });

globalThis.fetch = async (url, opts) => {
  if (url.endsWith('/categories')) return { ok: true, json: async () => [{ id: 1, name: 'Dir. Penal', color: '#ff0000' }, { id: 2, name: 'Contabilidade', color: '#a3e635' }] };
  if (url.endsWith('/sessions/start')) return { ok: true, json: async () => ({ id: 5 }) };
  return { ok: true, json: async () => ({}) };
};

const cats = await import('../src/js/categories.js');
const csel = await import('../src/js/csel.js');
const timer = await import('../src/js/timer.js');
const U = await import('../src/js/utils.js');

test('sem sessão em andamento, reaplicarCorDeFundo não pinta nada', () => {
  body.style.backgroundColor = '';
  timer.reaplicarCorDeFundo();
  assert.equal(body.style.backgroundColor, '');
});

test('trocar de tema com o timer rodando recalcula o fundo com a nova cor base (bug do fundo preso no claro)', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  await cats.loadCategories();
  csel.pickCsel('cat-csel', 1, 'Dir. Penal', '#ff0000');
  await timer.startTimer();

  const noClaro = body.style.backgroundColor;
  assert.notEqual(noClaro, '', 'iniciar o timer deveria tingir o fundo');

  bgDoTema = '#07080c'; // usuário troca pro escuro
  timer.reaplicarCorDeFundo();
  const noEscuro = body.style.backgroundColor;

  assert.notEqual(noEscuro, noClaro, 'o fundo deveria ser recalculado com a base escura');
  const [r, g, b] = noEscuro.match(/\d+/g).map(Number);
  assert.ok(r + g + b < 150, `no escuro o fundo deveria ser bem escuro, mas veio ${noEscuro}`);

  await timer.discardStop();
  assert.equal(body.style.backgroundColor, '', 'descartar deveria limpar a cor de fundo');
  t.mock.timers.reset();
});

test('iniciar sem escolher matéria avisa com toast (sem alert nativo) e não inicia', async () => {
  globalThis.alert = () => { throw new Error('alert nativo não pode ser usado'); };
  csel.pickCsel('cat-csel', null, null, null);
  await timer.startTimer();
  assert.equal(document.getElementById('btn-start').disabled, false, 'não deveria ter iniciado');
});

test('ao iniciar, o anel de progresso e o relógio ganham a cor da matéria', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  await cats.loadCategories();
  csel.pickCsel('cat-csel', 1, 'Dir. Penal', '#ff0000');
  await timer.startTimer();
  assert.equal(els.get('ring-fill').style.stroke, '#ff0000');
  assert.equal(els.get('clock').style.color, '#ff0000', 'vermelho já tem contraste suficiente: fica a cor pura');
  await timer.discardStop();
  t.mock.timers.reset();
});

test('o relógio usa a cor da matéria, ajustada só o necessário pra ter contraste com o cartão', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  await cats.loadCategories();
  surfaceDoTema = '#f8f9fc'; bgDoTema = '#eef0f6';
  csel.pickCsel('cat-csel', 2, 'Contabilidade', '#a3e635');
  await timer.startTimer();
  const noClaro = els.get('clock').style.color;
  assert.notEqual(noClaro, '#a3e635', 'lima puro quase não aparece sobre o cartão claro');
  assert.ok(U.contrasteEntre(noClaro, surfaceDoTema) >= 3);

  surfaceDoTema = '#10121a'; bgDoTema = '#07080c';   // o usuário troca pro tema escuro
  timer.reaplicarCorDeFundo();
  assert.equal(els.get('clock').style.color, '#a3e635', 'no escuro o lima já tem contraste: fica a cor pura');

  await timer.discardStop();
  t.mock.timers.reset();
  surfaceDoTema = '#f8f9fc'; bgDoTema = '#c4c9d8';
});

test('escolher a matéria (antes de iniciar) já pinta o relógio com a cor dela', async () => {
  await cats.loadCategories();
  surfaceDoTema = '#f8f9fc';
  csel.pickCsel('cat-csel', 1, 'Dir. Penal', '#ff0000');
  assert.equal(els.get('clock').style.color, '#ff0000');
  csel.pickCsel('cat-csel', null, null, null);
  assert.equal(els.get('clock').style.color, '');
});

test('o título da aba mostra só o contador, sem texto extra', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  await cats.loadCategories();
  csel.pickCsel('cat-csel', 1, 'Dir. Penal', '#ff0000');
  await timer.startTimer();
  t.mock.timers.tick(1000);
  assert.match(document.title, /^\d{2}:\d{2}:\d{2}$/);
  await timer.discardStop();
  t.mock.timers.reset();
});
