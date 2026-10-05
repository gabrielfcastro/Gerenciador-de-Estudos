import test from 'node:test';
import assert from 'node:assert/strict';

function fakeEl() {
  return {
    innerHTML: '', textContent: '', value: '', style: { setProperty(){}, removeProperty(){} }, disabled: false,
    classList: { add(){}, remove(){}, toggle(){}, replace(){}, contains(){ return false; } },
    addEventListener(){},
  };
}
const els = new Map();
const body = { style: { backgroundColor: '' } };
globalThis.document = {
  getElementById: (id) => { if (!els.has(id)) els.set(id, fakeEl()); return els.get(id); },
  querySelector: () => fakeEl(), querySelectorAll: () => [], createElement: () => fakeEl(),
  addEventListener(){}, body, documentElement: {}, title: '',
};
globalThis.window = { addEventListener(){} };

// Simula o tema: o valor de --bg muda quando o usuário alterna claro/escuro.
let bgDoTema = '#c4c9d8'; // claro
globalThis.getComputedStyle = () => ({ getPropertyValue: () => bgDoTema });

globalThis.fetch = async (url, opts) => {
  if (url.endsWith('/categories')) return { ok: true, json: async () => [{ id: 1, name: 'Dir. Penal', color: '#ff0000' }] };
  if (url.endsWith('/sessions/start')) return { ok: true, json: async () => ({ id: 5 }) };
  return { ok: true, json: async () => ({}) };
};

const cats = await import('../src/js/categories.js');
const csel = await import('../src/js/csel.js');
const timer = await import('../src/js/timer.js');

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
