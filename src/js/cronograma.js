// ── Módulo de cronograma (planejamento semanal) ───────────────────────────────

import { Api } from './api.js';
import { esc } from './utils.js';
import { buildCsel, registerCsel, resetCsel } from './csel.js';
import { getCategories } from './categories.js';

const DIAS_CONFIG = [
  { key: 'segunda',  label: 'Segunda' },
  { key: 'terca',    label: 'Terça'   },
  { key: 'quarta',   label: 'Quarta'  },
  { key: 'quinta',   label: 'Quinta'  },
  { key: 'sexta',    label: 'Sexta'   },
  { key: 'sabado',   label: 'Sábado'  },
  { key: 'domingo',  label: 'Domingo' },
];

let scheduleEntries  = [];
let schedDia         = null;
let schedCatId       = null;
let draggedCatId     = null;
let draggedEntryId   = null;

registerCsel('sched-csel', {
  onSelect: (id) => { schedCatId = id; },
  getCategories,
});

export async function loadCronograma() {
  try {
    scheduleEntries = await Api.getSchedule();
    renderCronogramaCats();
    renderCronograma();
  } catch {}
}

function renderCronogramaCats() {
  const el = document.getElementById('cronograma-cats');
  if (!el) return;
  const categories = getCategories();
  if (!categories.length) {
    el.innerHTML = '<span style="color:var(--text3);font-size:.78rem">Crie uma matéria primeiro</span>';
    return;
  }
  el.innerHTML = categories.map(c => `
    <div class="cronograma-cat-chip" draggable="true"
      style="background:${c.color}18;border-color:${c.color}55;color:${c.color}"
      ondragstart="onCatChipDragStart(event, ${c.id})"
      ondragend="onCatChipDragEnd(event)">
      <div class="cronograma-cat-chip-dot" style="background:${c.color}"></div>
      ${esc(c.name)}
    </div>`).join('');
}

function renderCronograma() {
  const grid = document.getElementById('cronograma-grid');
  grid.innerHTML = DIAS_CONFIG.map(({ key, label }) => {
    const entries = scheduleEntries.filter(e => e.dia_semana === key);
    const pillsHtml = entries.length
      ? entries.map(e => {
          const color = e.category_color || '#8b90a8';
          const name  = e.category_name  || 'Sem nome';
          const bg    = color + '22';
          return `<div class="dia-pill" draggable="true" style="background:${bg};border-color:${color}55"
            ondragstart="onEntryDragStart(event, ${e.id})"
            ondragend="onEntryDragEnd(event)">
            <div class="pill-dot" style="background:${color}"></div>
            <span class="pill-nome" style="color:${color}">${esc(name)}</span>
            <button class="pill-del" style="color:${color}" onclick="removeScheduleEntry(${e.id})" title="Remover">✕</button>
          </div>`;
        }).join('')
      : `<div class="cronograma-empty">Arraste uma matéria aqui</div>`;

    return `<div class="dia-col">
      <div class="dia-header"><span class="dia-nome">${label}</span></div>
      <div class="dia-pills" id="dia-pills-${key}"
        ondragover="onDiaDragOver(event,'${key}')"
        ondragleave="onDiaDragLeave(event,'${key}')"
        ondrop="onDiaDrop(event,'${key}')">${pillsHtml}</div>
      <button class="dia-add" onclick="openAddSchedule('${key}','${label}')">＋ Matéria</button>
    </div>`;
  }).join('');
}

export function onCatChipDragStart(event, catId) {
  draggedCatId   = catId;
  draggedEntryId = null;
  setTimeout(() => { if (event.target) event.target.classList.add('dragging'); }, 0);
  event.dataTransfer.effectAllowed = 'copy';
}
export function onCatChipDragEnd(event) {
  event.target.classList.remove('dragging');
  draggedCatId = null;
}

export function onEntryDragStart(event, entryId) {
  draggedEntryId = entryId;
  draggedCatId   = null;
  setTimeout(() => { if (event.target) event.target.classList.add('dragging'); }, 0);
  event.dataTransfer.effectAllowed = 'move';
}
export function onEntryDragEnd(event) {
  event.target.classList.remove('dragging');
  draggedEntryId = null;
}

export function onDiaDragOver(event, dia) {
  event.preventDefault();
  document.getElementById('dia-pills-' + dia).classList.add('drag-over');
}
export function onDiaDragLeave(event, dia) {
  if (!event.currentTarget.contains(event.relatedTarget))
    document.getElementById('dia-pills-' + dia).classList.remove('drag-over');
}
export async function onDiaDrop(event, dia) {
  event.preventDefault();
  document.getElementById('dia-pills-' + dia).classList.remove('drag-over');

  if (draggedEntryId) {
    const entryId = draggedEntryId;
    draggedEntryId = null;
    await moveScheduleEntry(entryId, dia);
  } else if (draggedCatId) {
    const catId = draggedCatId;
    draggedCatId = null;
    await addScheduleEntryDirect(dia, catId);
  }
}

async function moveScheduleEntry(entryId, novoDia) {
  const entry = scheduleEntries.find(e => e.id === entryId);
  if (entry && entry.dia_semana === novoDia) return;
  const res = await Api.moveScheduleEntry(entryId, novoDia);
  if (res.ok) {
    const atualizado = await res.json();
    scheduleEntries = scheduleEntries.map(e => e.id === entryId ? atualizado : e);
    renderCronograma();
  }
}

async function addScheduleEntryDirect(dia, catId) {
  const res = await Api.createScheduleEntry(dia, parseInt(catId));
  if (res.ok) {
    const entry = await res.json();
    scheduleEntries.push(entry);
    renderCronograma();
  }
}

export function openAddSchedule(dia, label) {
  schedDia   = dia;
  schedCatId = null;
  buildCsel('sched-csel', getCategories(), null);
  resetCsel('sched-csel');
  document.getElementById('add-schedule-title').textContent = `Adicionar em ${label}`;
  document.getElementById('add-schedule-modal').classList.add('open');
}

export function closeAddSchedule() {
  document.getElementById('add-schedule-modal').classList.remove('open');
  schedDia = null;
}

export async function saveScheduleEntry() {
  if (!schedDia || !schedCatId) return;
  const res = await Api.createScheduleEntry(schedDia, parseInt(schedCatId));
  if (res.ok) {
    const entry = await res.json();
    scheduleEntries.push(entry);
    renderCronograma();
  }
  closeAddSchedule();
}

export async function removeScheduleEntry(id) {
  await Api.deleteScheduleEntry(id);
  scheduleEntries = scheduleEntries.filter(e => e.id !== id);
  renderCronograma();
}

export function initCronogramaModals() {
  document.getElementById('add-schedule-modal').addEventListener('click', function (e) {
    if (e.target === this) closeAddSchedule();
  });
}