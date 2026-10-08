import test from 'node:test';
import assert from 'node:assert/strict';

const els = new Map();
const mk = () => ({ hidden: false, textContent: '', className: '' });
globalThis.document = { getElementById: (id) => { if (!els.has(id)) els.set(id, mk()); return els.get(id); } };
const { atualizarIndicadorConexao } = await import('../src/js/conn.js');

test('conectado: o indicador some (não ocupa o cabeçalho à toa)', () => {
  atualizarIndicadorConexao(true);
  assert.equal(document.getElementById('conn').hidden, true);
});
test('offline: aparece com aviso em vermelho', () => {
  atualizarIndicadorConexao(false);
  assert.equal(document.getElementById('conn').hidden, false);
  assert.match(document.getElementById('conn-label').textContent, /offline/i);
  assert.equal(document.getElementById('conn-dot').className, 'conn-dot');
});
