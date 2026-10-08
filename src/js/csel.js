// ── Componente de "custom select" de matéria ──────────────────────────────────
// Vários lugares da UI (timer, nova tarefa, editar sessão, cronograma) usam o
// mesmo dropdown estilizado para escolher uma matéria. Cada tela se registra
// aqui uma vez dizendo "quando alguém escolher algo neste dropdown, faça X" —
// este módulo cuida do resto: o desenho, o teclado (setas, Enter, Esc) e a
// semântica de acessibilidade (listbox / option / aria-expanded).

import { esc, escAttr } from './utils.js';

const handlers = {}; // cselId -> { onSelect(id), getCategories() }

/** Cada tela chama isso uma vez para dizer o que fazer quando o usuário escolhe uma opção. */
export function registerCsel(cselId, { onSelect, getCategories }) {
  handlers[cselId] = { onSelect, getCategories };
}

/** Pra onde vai o foco ao apertar uma tecla de navegação dentro da lista. */
export function proximoIndice(atual, total, tecla) {
  if (tecla === 'ArrowDown') return Math.min(atual + 1, total - 1);
  if (tecla === 'ArrowUp')   return Math.max(atual - 1, 0);
  if (tecla === 'Home')      return 0;
  if (tecla === 'End')       return total - 1;
  return atual;
}

function definirAberto(cselEl, aberto) {
  cselEl.classList.toggle('open', aberto);
  const gatilho = cselEl.querySelector('.csel-trigger');
  if (gatilho) gatilho.setAttribute('aria-expanded', String(aberto));
}

function focarOpcaoAtiva(cselEl) {
  const alvo = cselEl.querySelector('.csel-option.active, .csel-none.active')
            || cselEl.querySelector('.csel-option, .csel-none');
  if (alvo && alvo.focus) alvo.focus();
}

/** (Re)desenha as opções do menu para a lista de categorias e seleção atuais. */
export function buildCsel(cselId, categories, currentId) {
  const menu = document.getElementById(cselId + '-menu');
  if (!menu) return;
  menu.setAttribute('role', 'listbox');

  const semSelecao = !currentId;
  const noneHtml = `<div class="csel-none ${semSelecao ? 'active' : ''}" role="option" tabindex="-1" aria-selected="${semSelecao}"
    onclick="pickCsel('${cselId}', null, null, null)">
    — Escolha uma matéria —
  </div>`;

  const optsHtml = categories.map(c => {
    const ativa = String(c.id) === String(currentId);
    return `
    <div class="csel-option ${ativa ? 'active' : ''}" role="option" tabindex="-1" aria-selected="${ativa}"
      data-nome="${escAttr(c.name)}" data-cor="${escAttr(c.color)}"
      onclick="pickCsel('${cselId}', ${c.id}, this.dataset.nome, this.dataset.cor)">
      <div class="csel-option-dot" style="background:${c.color}"></div>
      ${esc(c.name)}
    </div>`;
  }).join('');

  menu.innerHTML = noneHtml + optsHtml;
}

export function toggleCsel(cselId) {
  const el = document.getElementById(cselId);
  const trigger = el.querySelector('.csel-trigger');
  if (trigger.disabled) return;
  document.querySelectorAll('.csel.open').forEach(c => { if (c.id !== cselId) definirAberto(c, false); });
  const abrir = !el.classList.contains('open');
  definirAberto(el, abrir);
  if (abrir) focarOpcaoAtiva(el);
}

/** Reseta a exibição do dropdown para o placeholder (usado ao abrir um modal "novo X"). */
export function resetCsel(cselId, placeholder = '— Escolha uma categoria —') {
  const dot  = document.getElementById(cselId + '-dot');
  const text = document.getElementById(cselId + '-text');
  dot.style.display = 'none';
  text.textContent  = placeholder;
  text.classList.add('placeholder');
}

/** Chamado pelo próprio menu (onclick inline) quando o usuário escolhe uma opção. */
export function pickCsel(cselId, id, name, color) {
  const dot  = document.getElementById(cselId + '-dot');
  const text = document.getElementById(cselId + '-text');

  if (id) {
    dot.style.display    = 'inline-block';
    dot.style.background = color;
    text.textContent     = name;
    text.classList.remove('placeholder');
  } else {
    dot.style.display = 'none';
    text.textContent  = '— Sem categoria —';
    text.classList.add('placeholder');
  }

  const el = document.getElementById(cselId);
  definirAberto(el, false);
  const gatilho = el.querySelector('.csel-trigger');
  if (gatilho && gatilho.focus) gatilho.focus();

  const h = handlers[cselId];
  if (!h) return;
  h.onSelect(id);
  buildCsel(cselId, h.getCategories(), id);
}

/** Fecha qualquer dropdown aberto ao clicar fora dele. Chamar uma vez na inicialização. */
export function initCselGlobalClose() {
  document.addEventListener('click', e => {
    if (!e.target.closest('.csel')) {
      document.querySelectorAll('.csel.open').forEach(c => definirAberto(c, false));
    }
  });
}

/** Navegação por teclado: setas/Home/End movem, Enter/Espaço escolhem, Esc fecha. */
export function initCselKeyboard() {
  document.addEventListener('keydown', (e) => {
    const alvo = e.target;
    const csel = alvo && alvo.closest && alvo.closest('.csel');
    if (!csel) return;

    const gatilho = csel.querySelector('.csel-trigger');
    if (alvo === gatilho) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!csel.classList.contains('open')) toggleCsel(csel.id);
      }
      return;
    }

    const opcoes = [...csel.querySelectorAll('.csel-none, .csel-option')];
    const idx = opcoes.indexOf(alvo);
    if (idx === -1) return;

    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      opcoes[proximoIndice(idx, opcoes.length, e.key)].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      alvo.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      definirAberto(csel, false);
      if (gatilho) gatilho.focus();
    } else if (e.key === 'Tab') {
      definirAberto(csel, false);
    }
  });
}
