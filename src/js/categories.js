// ── Módulo de matérias (categorias) ───────────────────────────────────────────
// Dono da lista de categorias e das horas estudadas por categoria. Nenhum
// outro módulo guarda a própria cópia dessa lista — quem precisa dela chama
// getCategories(), e quem precisa ser avisado de mudanças usa onCategoriesChange
// / onCategoryDeleted. Isso evita ter que importar módulos "de lado"
// (ex.: sessions.js não precisa saber nada sobre como uma categoria é criada).

import { Api } from './api.js';
import { esc, fmtDuration } from './utils.js';
import { ico } from './icons.js';
import { confirmar } from './ui.js';

// Paleta das matérias. Vermelho, verde e azul ficam de fora de propósito: são as
// cores dos estados do sistema (erro, sucesso, informação) e se confundiriam
// com uma matéria.
const COLORS = [
  '#7c6ff7','#a78bfa','#c084fc','#e879f9','#f472b6','#fb923c',
  '#fbbf24','#a3e635','#2dd4bf','#22d3ee','#d4a373','#94a3b8'
];

let categories = [];
let catHours   = {};
let catPeriod  = 'week';
let editCatId  = null;
let selColor   = COLORS[0];

const changeSubscribers  = [];
const deleteSubscribers  = [];

/** Chamado sempre que a lista de categorias é recarregada (criar/editar/remover). */
export function onCategoriesChange(cb) { changeSubscribers.push(cb); }
/** Chamado especificamente quando uma categoria é removida (ex.: para recarregar o gráfico). */
export function onCategoryDeleted(cb) { deleteSubscribers.push(cb); }

export function getCategories() { return categories; }

export async function loadCategories() {
  try {
    categories = await Api.getCategories();
    renderCatList();
    changeSubscribers.forEach(cb => cb(categories));
  } catch {}
}

export async function refreshHours(period) {
  catPeriod = period;
  try {
    const data = await Api.getChart(period);
    catHours = {};
    data.forEach(d => {
      if (!d.category_name) return;
      const cat = categories.find(c => c.name === d.category_name);
      if (cat) catHours[cat.id] = (catHours[cat.id] || 0) + d.total_seconds;
    });
    renderCatList();
  } catch {}
}

const ROTULO_PERIODO = {
  today: 'hoje', week: 'esta semana', month: 'este mês',
  '6months': 'últimos 6 meses', year: 'último ano', all: 'no total',
};

function renderCatList() {
  const periodo = document.getElementById('cat-period');
  if (periodo) periodo.textContent = ROTULO_PERIODO[catPeriod] || '';

  const el = document.getElementById('cat-list');
  if (!el) return;
  if (!categories.length) {
    el.innerHTML = '<div class="cat-empty">Nenhuma matéria ainda.</div>';
    return;
  }
  const maximo = Math.max(0, ...categories.map(c => catHours[c.id] || 0));
  el.innerHTML = categories.map(c => {
    const seg  = catHours[c.id] || 0;
    const pct  = maximo ? Math.round((seg / maximo) * 100) : 0;
    const nome = esc(c.name);
    return `<div class="cat-item">
      <div class="cat-main">
        <span class="cat-dot" style="background:${c.color}"></span>
        <span class="cat-name">${nome}</span>
        <span class="cat-hours">${seg >= 60 ? fmtDuration(seg) : '—'}</span>
        <div class="cat-acts">
          <button class="icon-btn" onclick="openCatModal(${c.id})" title="Editar matéria" aria-label="Editar matéria ${nome}">${ico('edit')}</button>
          <button class="icon-btn" onclick="deleteCat(${c.id})" title="Excluir matéria" aria-label="Excluir matéria ${nome}">${ico('x')}</button>
        </div>
      </div>
      <div class="cat-bar"><div class="cat-bar-fill" style="width:${pct}%;background:${c.color}"></div></div>
    </div>`;
  }).join('');
}

export function buildSwatches(usedColors = []) {
  document.getElementById('color-opts').innerHTML = COLORS.map(c => {
    const inUse = usedColors.includes(c);
    return `<div class="swatch ${c===selColor?'sel':''} ${inUse?'used':''}"
      style="background:${c}" data-color="${c}"
      onclick="pickColor('${c}')"
      title="${inUse ? 'Já em uso' : ''}"></div>`;
  }).join('');
}

export function pickColor(c) {
  const swatch = document.querySelector(`.swatch[data-color="${c}"]`);
  if (swatch?.classList.contains('used')) return;
  selColor = c;
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('sel', s.dataset.color === c));
}

export function openCatModal(id = null) {
  editCatId = id;
  const cat = id ? categories.find(c => c.id === id) : null;
  const usedColors = categories.filter(c => c.id !== id).map(c => c.color);
  const defaultColor = cat ? cat.color : (COLORS.find(c => !usedColors.includes(c)) || COLORS[0]);
  document.getElementById('cat-modal-title').textContent = id ? 'Editar matéria' : 'Nova matéria';
  document.getElementById('inp-cat-name').value = cat ? cat.name : '';
  selColor = defaultColor;
  buildSwatches(usedColors);
  document.getElementById('cat-modal').classList.add('open');
  setTimeout(() => document.getElementById('inp-cat-name').focus(), 50);
}

export function closeCatModal() {
  document.getElementById('cat-modal').classList.remove('open');
  editCatId = null;
}

export async function saveCategory() {
  const name = document.getElementById('inp-cat-name').value.trim();
  if (!name) return;
  if (editCatId) {
    await Api.updateCategory(editCatId, name, selColor);
  } else {
    await Api.createCategory(name, selColor);
  }
  closeCatModal();
  await loadCategories();
}

export async function deleteCat(id) {
  const ok = await confirmar('As sessões já registradas dessa matéria ficam sem categoria.', { titulo: 'Excluir matéria?', confirmar: 'Excluir', perigo: true });
  if (!ok) return;
  await Api.deleteCategory(id);
  await loadCategories();
  deleteSubscribers.forEach(cb => cb());
}

export function initCategoryModals() {
  document.getElementById('cat-modal').addEventListener('click', function (e) { if (e.target === this) closeCatModal(); });
  document.getElementById('inp-cat-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveCategory(); });
}