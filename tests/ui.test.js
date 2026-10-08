import test from 'node:test';
import assert from 'node:assert/strict';

function criar(tag) {
  const el = {
    tag, children: [], attrs: {}, listeners: {}, className: '', textContent: '', parent: null, removed: false,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { c.parent = this; this.children.push(c); return c; },
    remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); },
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter(f => f !== fn); },
    dispatch(t, ev = {}) { (this.listeners[t] || []).slice().forEach(fn => fn(ev)); },
    click() { this.dispatch('click', {}); },
    focus() { globalThis.document.activeElement = this; },
    querySelector(sel) { return buscar(this, sel); },
  };
  return el;
}
function buscar(raiz, sel) {
  const alvo = sel.replace(/^\./, '');
  for (const c of raiz.children) {
    if ((c.className || '').split(/\s+/).includes(alvo) || c.attrs['data-acao'] === alvo.replace(/^\[data-acao="|"\]$/g, '')) return c;
    const r = buscar(c, sel); if (r) return r;
  }
  return null;
}
const body = criar('body');
const docListeners = {};
globalThis.document = {
  body, activeElement: null,
  createElement: criar,
  getElementById: (id) => { const f = (n) => n.attrs.id === id ? n : n.children.map(f).find(Boolean); return body.children.map(f).find(Boolean) || null; },
  addEventListener(t, fn) { (docListeners[t] ||= []).push(fn); },
  removeEventListener(t, fn) { docListeners[t] = (docListeners[t] || []).filter(f => f !== fn); },
};
globalThis.window = {};

const { toast, confirmar } = await import('../src/js/ui.js');

test('toast: mostra a mensagem num container com aria-live', () => {
  toast('Preencha início e fim.', 'erro');
  const raiz = document.getElementById('toast-root');
  assert.ok(raiz, 'deveria criar o container de toasts');
  assert.equal(raiz.attrs['aria-live'], 'polite');
  assert.equal(raiz.children.length, 1);
  assert.match(raiz.children[0].textContent, /Preencha início e fim\./);
  assert.ok(raiz.children[0].className.includes('toast-erro'));
});

test('toast: some sozinho depois do tempo', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const raiz = document.getElementById('toast-root');
  raiz.children.length = 0;
  toast('Salvo', 'ok', 1000);
  assert.equal(raiz.children.length, 1);
  t.mock.timers.tick(1500);
  assert.equal(raiz.children.length, 0);
  t.mock.timers.reset();
});

test('toast: erros usam role=alert pra leitores de tela', () => {
  const raiz = document.getElementById('toast-root'); raiz.children.length = 0;
  toast('Deu ruim', 'erro');
  assert.equal(raiz.children[0].attrs.role, 'alert');
});

test('confirmar: resolve true ao clicar em confirmar', async () => {
  const p = confirmar('Excluir essa sessão?', { confirmar: 'Excluir', perigo: true });
  const modal = body.children[body.children.length - 1];
  assert.match(JSON.stringify(modal, (k, v) => (k === 'parent' || k === 'listeners' || k === 'classList' ? undefined : v)), /Excluir essa sessão\?/);
  const botao = buscar(modal, 'btn-confirmar');
  assert.ok(botao, 'botão de confirmar');
  assert.equal(botao.textContent, 'Excluir');
  assert.ok(botao.className.includes('btn-danger-solid'), 'ação perigosa usa o botão vermelho');
  botao.click();
  assert.equal(await p, true);
  assert.ok(modal.removed, 'o modal deve sair da tela');
});

test('confirmar: resolve false ao clicar em cancelar', async () => {
  const p = confirmar('Excluir matéria?');
  const modal = body.children[body.children.length - 1];
  buscar(modal, 'btn-cancelar').click();
  assert.equal(await p, false);
});

test('confirmar: Escape cancela', async () => {
  const p = confirmar('Excluir?');
  (docListeners.keydown || []).slice().forEach(fn => fn({ key: 'Escape', preventDefault() {} }));
  assert.equal(await p, false);
});
