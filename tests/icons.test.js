import test from 'node:test';
import assert from 'node:assert/strict';
import { ico, NOMES_ICONES } from '../src/js/icons.js';

test('ico: gera um svg decorativo que aponta pro símbolo do sprite', () => {
  const html = ico('edit');
  assert.match(html, /<svg class="ico"/);
  assert.match(html, /href="#i-edit"/);
  assert.match(html, /aria-hidden="true"/);
});

test('ico: aceita classe extra', () => {
  assert.match(ico('x', 'pequeno'), /class="ico pequeno"/);
});

test('ico: nome desconhecido lança erro (pega erro de digitação cedo)', () => {
  assert.throws(() => ico('nao-existe'), /ícone desconhecido/i);
});

test('NOMES_ICONES: tem os ícones que o app usa', () => {
  for (const n of ['timer', 'edit', 'x', 'plus', 'check', 'undo', 'play', 'pause', 'stop', 'moon', 'sun', 'settings'])
    assert.ok(NOMES_ICONES.includes(n), `falta o ícone ${n}`);
});
