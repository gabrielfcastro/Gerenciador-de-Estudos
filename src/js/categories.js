// ── Módulo de matérias (categorias) ───────────────────────────────────────────
// Dono da lista de categorias e das horas estudadas por categoria. Nenhum
// outro módulo guarda a própria cópia dessa lista — quem precisa dela chama
// getCategories(), e quem precisa ser avisado de mudanças usa onCategoriesChange
// / onCategoryDeleted. Isso evita ter que importar módulos "de lado"
// (ex.: sessions.js não precisa saber nada sobre como uma categoria é criada).

import { Api } from './api.js';
import { esc } from './utils.js';

const COLORS = [
  '#7c6ff7','#34d399','#f87171','#fbbf24','#60a5fa',
  '#f472b6','#a78bfa','#2dd4bf','#fb923c','#a3e635',
  '#e879f9','#38bdf8','#4ade80','#facc15','#f43f5e'
];

let categories = [];
let catHours   = {};
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

function renderCatList() {
  const el = document.getElementById('cat-list');
  if (!el) return;
  if (!categories.length) {
    el.innerHTML = '<div style="color:var(--text2);font-size:.82rem;padding:8px 4px">Nenhuma matéria ainda.</div>';
    return;
  }
  el.innerHTML = categories.map(c => `<div class="cat-item" style="border-left:3px solid ${c.color};background:${c.color}18">
      <span class="cat-name">${esc(c.name)}</span>
      <div class="cat-acts">
        <button onclick="openCatModal(${c.id})" title="Editar">✏</button>
        <button onclick="deleteCat(${c.id})" title="Excluir">✕</button>
      </div>
    </div>`).join('');
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
  if (!confirm('Excluir matéria? Sessões existentes ficam sem categoria.')) return;
  await Api.deleteCategory(id);
  await loadCategories();
  deleteSubscribers.forEach(cb => cb());
}

export function initCategoryModals() {
  document.getElementById('cat-modal').addEventListener('click', function (e) { if (e.target === this) closeCatModal(); });
  document.getElementById('inp-cat-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveCategory(); });
}