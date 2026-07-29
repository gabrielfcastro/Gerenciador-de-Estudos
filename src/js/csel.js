// ── Componente de "custom select" de matéria ──────────────────────────────────
// Vários lugares da UI (timer, nova tarefa, editar sessão, cronograma) usam o
// mesmo dropdown estilizado para escolher uma matéria. Em vez de cada tela
// reimplementar o próprio dropdown (ou o app.js original, que tinha um
// if/else fixo checando o id do elemento dentro de pickCsel), cada tela só
// se registra aqui uma vez dizendo "quando alguém escolher algo neste
// dropdown, faça X" — este módulo cuida do resto.

import { esc } from './utils.js';

const handlers = {}; // cselId -> { onSelect(id), getCategories() }

/** Cada tela chama isso uma vez para dizer o que fazer quando o usuário escolhe uma opção. */
export function registerCsel(cselId, { onSelect, getCategories }) {
  handlers[cselId] = { onSelect, getCategories };
}

/** (Re)desenha as opções do menu para a lista de categorias e seleção atuais. */
export function buildCsel(cselId, categories, currentId) {
  const menu = document.getElementById(cselId + '-menu');
  if (!menu) return;

  const noneHtml = `<div class="csel-none ${!currentId ? 'active' : ''}"
    onclick="pickCsel('${cselId}', null, null, null)">
    — Escolha uma matéria —
  </div>`;

  const optsHtml = categories.map(c => `
    <div class="csel-option ${String(c.id) === String(currentId) ? 'active' : ''}"
      onclick="pickCsel('${cselId}', ${c.id}, '${esc(c.name)}', '${c.color}')">
      <div class="csel-option-dot" style="background:${c.color}"></div>
      ${esc(c.name)}
    </div>`).join('');

  menu.innerHTML = noneHtml + optsHtml;
}

export function toggleCsel(cselId) {
  const el = document.getElementById(cselId);
  const trigger = el.querySelector('.csel-trigger');
  if (trigger.disabled) return;
  document.querySelectorAll('.csel.open').forEach(c => { if (c.id !== cselId) c.classList.remove('open'); });
  el.classList.toggle('open');
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

  document.getElementById(cselId).classList.remove('open');

  const h = handlers[cselId];
  if (!h) return;
  h.onSelect(id);
  buildCsel(cselId, h.getCategories(), id);
}

/** Fecha qualquer dropdown aberto ao clicar fora dele. Chamar uma vez na inicialização. */
export function initCselGlobalClose() {
  document.addEventListener('click', e => {
    if (!e.target.closest('.csel')) {
      document.querySelectorAll('.csel.open').forEach(c => c.classList.remove('open'));
    }
  });
}