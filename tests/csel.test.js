import test from 'node:test';
import assert from 'node:assert/strict';

const els = new Map();
const el = () => ({ innerHTML: '', textContent: '', style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } } });
globalThis.document = { getElementById: (id) => { if (!els.has(id)) els.set(id, el()); return els.get(id); }, addEventListener(){}, querySelectorAll: () => [] };

const { proximoIndice, buildCsel } = await import('../src/js/csel.js');

test('proximoIndice: seta pra baixo avança e para no último', () => {
  assert.equal(proximoIndice(0, 4, 'ArrowDown'), 1);
  assert.equal(proximoIndice(3, 4, 'ArrowDown'), 3);
});
test('proximoIndice: seta pra cima volta e para no primeiro', () => {
  assert.equal(proximoIndice(2, 4, 'ArrowUp'), 1);
  assert.equal(proximoIndice(0, 4, 'ArrowUp'), 0);
});
test('proximoIndice: Home e End', () => {
  assert.equal(proximoIndice(2, 5, 'Home'), 0);
  assert.equal(proximoIndice(2, 5, 'End'), 4);
});
test('proximoIndice: sem foco ainda, seta pra baixo vai pro primeiro', () => {
  assert.equal(proximoIndice(-1, 3, 'ArrowDown'), 0);
});
test('proximoIndice: tecla desconhecida mantém', () => {
  assert.equal(proximoIndice(1, 3, 'a'), 1);
});

test('buildCsel: opções têm semântica de lista (role, aria-selected, tabindex)', () => {
  buildCsel('x-csel', [{ id: 1, name: 'Penal', color: '#aaaaaa' }, { id: 2, name: 'Civil', color: '#bbbbbb' }], 2);
  const html = document.getElementById('x-csel-menu').innerHTML;
  assert.equal((html.match(/role="option"/g) || []).length, 3, '2 matérias + a opção "nenhuma"');
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-selected="false"/);
  assert.match(html, /tabindex="-1"/);
});

test('buildCsel: nome com apóstrofo e aspas não quebra o atributo onclick', () => {
  buildCsel('y-csel', [{ id: 1, name: `D'Água "teste"`, color: '#aaaaaa' }], null);
  const html = document.getElementById('y-csel-menu').innerHTML;
  assert.ok(html.includes('data-nome="D&#39;Água &quot;teste&quot;"'), 'o nome vai num atributo data-, escapado');
  assert.ok(!/onclick="[^"]*D'Água/.test(html), 'o nome não pode entrar cru dentro do JavaScript do onclick');
  assert.match(html, /onclick="pickCsel\('y-csel', 1, this\.dataset\.nome, this\.dataset\.cor\)"/);
});
