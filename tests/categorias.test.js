import test from 'node:test';
import assert from 'node:assert/strict';

const els = new Map();
const fake = () => ({ innerHTML: '', textContent: '', style: {}, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){} });
globalThis.document = { getElementById: (id) => { if (!els.has(id)) els.set(id, fake()); return els.get(id); }, querySelectorAll: () => [], addEventListener(){} };
globalThis.window = { addEventListener(){} };
globalThis.fetch = async (url) => {
  if (url.endsWith('/categories')) return { ok: true, json: async () => [
    { id: 1, name: 'Penal', color: '#7c6ff7' }, { id: 2, name: 'Civil', color: '#fb923c' }, { id: 3, name: 'Sem horas', color: '#2dd4bf' }] };
  if (url.includes('/chart')) return { ok: true, json: async () => [
    { category_name: 'Penal', total_seconds: 9000 }, { category_name: 'Civil', total_seconds: 4500 }] };
  return { ok: true, json: async () => ({}) };
};
const C = await import('../src/js/categories.js');

test('barra lateral mostra as horas de cada matéria no período', async () => {
  await C.loadCategories();
  await C.refreshHours('week');
  const html = document.getElementById('cat-list').innerHTML;
  assert.match(html, /2h 30m/, 'Penal: 9000s');
  assert.match(html, /1h 15m/, 'Civil: 4500s');
});

test('barra lateral: a mini barra da matéria mais estudada ocupa 100% e as outras são proporcionais', async () => {
  await C.refreshHours('week');
  const larguras = [...document.getElementById('cat-list').innerHTML.matchAll(/cat-bar-fill" style="[^"]*width:(\d+)%/g)].map(m => Number(m[1]));
  assert.deepEqual(larguras.slice(0, 2), [100, 50]);
});

test('barra lateral: matéria sem estudo no período não mostra horas e tem barra vazia', async () => {
  await C.refreshHours('week');
  const html = document.getElementById('cat-list').innerHTML;
  const bloco = html.split('cat-item').find(b => b.includes('Sem horas'));
  assert.ok(bloco);
  assert.match(bloco, /width:0%/);
});

test('barra lateral: o título indica o período', async () => {
  await C.refreshHours('week');
  assert.match(document.getElementById('cat-period').textContent, /semana/);
  await C.refreshHours('today');
  assert.match(document.getElementById('cat-period').textContent, /hoje/);
});

test('botões de editar e excluir da matéria têm rótulo acessível', async () => {
  await C.refreshHours('week');
  const html = document.getElementById('cat-list').innerHTML;
  assert.match(html, /aria-label="Editar matéria Penal"/);
  assert.match(html, /aria-label="Excluir matéria Penal"/);
});
