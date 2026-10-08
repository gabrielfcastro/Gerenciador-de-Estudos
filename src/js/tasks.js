// ── Módulo de tarefas (kanban) ────────────────────────────────────────────────

import { Api } from './api.js';
import { esc } from './utils.js';
import { buildCsel, registerCsel, resetCsel } from './csel.js';
import { getCategories } from './categories.js';
import { ico } from './icons.js';
import { toast } from './ui.js';

let tasks           = [];
let draggedId        = null;
let taskSelCatId    = null;
let editTaskId      = null;

// Tarefas que foram arrastadas pra "Concluído" mas ainda estão na janela de
// desfazer (a barrinha de contagem regressiva fica em cima do próprio card).
// Map<id, { task, timeoutId, deleteTimeoutId }>
const completando = new Map();
const DURACAO_DESFAZER_MS = 4000;

registerCsel('task-csel', {
  onSelect: (id) => { taskSelCatId = id; },
  getCategories,
});

export async function loadTasks() {
  try {
    tasks = await Api.getTasks();
    renderTasks();
  } catch {}
}

function renderTasks() {
  const todoEl  = document.getElementById('todo-cards');
  const countEl = document.getElementById('todo-count');
  countEl.textContent = tasks.length;

  if (!tasks.length) {
    todoEl.innerHTML = '<div style="color:var(--text3);font-size:0.875rem;text-align:center;padding:32px 16px">Nenhuma tarefa ainda</div>';
  } else {
    todoEl.innerHTML = tasks.map(t => cardHtml(t)).join('');
  }

  renderDoneColumn();
}

// Estilo do card na cor da matéria: barra lateral sólida + fundo levemente
// tingido, na mesma cor da bolinha da categoria.
function corDoCard(categoriaId) {
  const cat = categoriaId ? getCategories().find(c => String(c.id) === String(categoriaId)) : null;
  if (!cat) return { cat: null, style: '' };
  return {
    cat,
    style: `border-left:4px solid ${cat.color};background:linear-gradient(155deg, ${cat.color}3d, var(--surface) 75%)`,
  };
}

function cardHtml(t) {
  const { cat, style } = corDoCard(t.categoria_id);
  const catHtml = cat
    ? `<div class="kanban-card-cat">
         <div class="kanban-card-cat-dot" style="background:${cat.color}"></div>
         ${esc(cat.name)}
       </div>` : '';
  const nota = t.nota || t.note || '';
  const notaHtml = nota ? `<div class="kanban-card-note">${esc(nota)}</div>` : '';
  return `<div class="kanban-card" draggable="true" data-id="${t.id}" style="${style}"
    tabindex="0" onkeydown="if(event.key==='Enter'&&event.target===this)openTaskView(${t.id})"
    onclick="openTaskView(${t.id})"
    ondragstart="onDragStart(event,${t.id})"
    ondragend="onDragEnd(event)">
    <div class="kanban-card-top">
      <div class="kanban-card-title">${esc(t.titulo)}</div>
      <div class="kanban-card-acts">
        <button class="icon-btn kanban-card-done" onclick="event.stopPropagation(); concluirTarefa(${t.id})" title="Concluir tarefa" aria-label="Concluir tarefa">${ico('check')}</button>
        <button class="icon-btn kanban-card-edit" onclick="event.stopPropagation(); openEditTask(${t.id})" title="Editar tarefa" aria-label="Editar tarefa">${ico('edit')}</button>
        <button class="icon-btn kanban-card-del" onclick="event.stopPropagation(); deleteTask(${t.id})" title="Excluir tarefa" aria-label="Excluir tarefa">${ico('x')}</button>
      </div>
    </div>
    ${catHtml}
    ${notaHtml}
  </div>`;
}

function renderDoneColumn() {
  const doneEl  = document.getElementById('done-cards');
  const countEl = document.getElementById('done-count');
  countEl.textContent = completando.size;

  if (!completando.size) {
    doneEl.innerHTML = '<div class="kanban-done-hint" id="done-hint">Arraste aqui para concluir</div>';
    return;
  }

  doneEl.innerHTML = [...completando.values()].map(({ task }) => {
    const { cat, style } = corDoCard(task.categoria_id);
    const catHtml = cat
      ? `<div class="kanban-card-cat">
           <div class="kanban-card-cat-dot" style="background:${cat.color}"></div>
           ${esc(cat.name)}
         </div>` : '';
    return `<div class="kanban-card completing" data-id="${task.id}" style="${style}">
      <div class="kanban-card-progress" style="animation-duration:${DURACAO_DESFAZER_MS}ms"></div>
      <div class="kanban-card-top">
        <div class="kanban-card-title">${esc(task.titulo)}</div>
      </div>
      ${catHtml}
      <button class="kanban-undo-btn" onclick="undoComplete(${task.id})">${ico('undo')} Desfazer</button>
    </div>`;
  }).join('');
}

let viewTaskId = null;

export function openTaskView(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  viewTaskId = id;

  document.getElementById('view-task-title').textContent = task.titulo;

  const cat = task.categoria_id ? getCategories().find(c => String(c.id) === String(task.categoria_id)) : null;
  const catEl = document.getElementById('view-task-cat');
  catEl.innerHTML = cat
    ? `<div class="dot" style="background:${cat.color}"></div>${esc(cat.name)}`
    : '';

  document.getElementById('view-task-note').textContent = task.nota || task.note || '';

  document.getElementById('view-task-modal').classList.add('open');
}

export function closeViewTask() {
  document.getElementById('view-task-modal').classList.remove('open');
  viewTaskId = null;
}

export function editFromView() {
  const id = viewTaskId;
  closeViewTask();
  openEditTask(id);
}

export function onDragStart(event, id) {
  draggedId = id;
  setTimeout(() => { const el = event.target; if (el) el.classList.add('dragging'); }, 0);
  event.dataTransfer.effectAllowed = 'move';
}
export function onDragEnd(event) { event.target.classList.remove('dragging'); }
export function onDragOver(event, col) {
  event.preventDefault();
  document.getElementById(col + '-cards').classList.add('drag-over');
}
export function onDragLeave(event, col) {
  if (!event.currentTarget.contains(event.relatedTarget))
    document.getElementById(col + '-cards').classList.remove('drag-over');
}
export function onDrop(event, col) {
  event.preventDefault();
  document.getElementById(col + '-cards').classList.remove('drag-over');
  if (!draggedId || col !== 'done') return;
  completeTask(draggedId);
  draggedId = null;
}

function completeTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  tasks = tasks.filter(t => t.id !== taskId);

  const timeoutId = setTimeout(() => finalizarConclusao(taskId), DURACAO_DESFAZER_MS);
  completando.set(taskId, { task, timeoutId });

  renderTasks();
}

async function finalizarConclusao(taskId) {
  const entry = completando.get(taskId);
  if (!entry) return;
  completando.delete(taskId);
  renderDoneColumn();
  await Api.completeTask(taskId);
}

// Alternativa ao arrastar: concluir por botão (funciona só com teclado).
export function concluirTarefa(id) { completeTask(id); }

export function undoComplete(taskId) {
  const entry = completando.get(taskId);
  if (!entry) return;
  clearTimeout(entry.timeoutId);
  completando.delete(taskId);

  tasks.push(entry.task);
  renderTasks();
}

export async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  renderTasks();
  await Api.deleteTask(id);
}

export function openAddTask() {
  editTaskId   = null;
  taskSelCatId = null;
  document.getElementById('task-modal-title').textContent = 'Nova tarefa';
  document.getElementById('inp-task-title').value = '';
  document.getElementById('inp-task-note').value  = '';
  buildCsel('task-csel', getCategories(), null);
  resetCsel('task-csel');
  document.getElementById('add-task-modal').classList.add('open');
  setTimeout(() => document.getElementById('inp-task-title').focus(), 50);
}

export function openEditTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editTaskId   = id;
  taskSelCatId = task.categoria_id || null;

  document.getElementById('task-modal-title').textContent = 'Editar tarefa';
  document.getElementById('inp-task-title').value = task.titulo;
  document.getElementById('inp-task-note').value  = task.nota || task.note || '';

  buildCsel('task-csel', getCategories(), taskSelCatId);

  const cat  = taskSelCatId ? getCategories().find(c => String(c.id) === String(taskSelCatId)) : null;
  const dot  = document.getElementById('task-csel-dot');
  const text = document.getElementById('task-csel-text');
  if (cat) {
    dot.style.display    = 'inline-block';
    dot.style.background = cat.color;
    text.textContent     = cat.name;
    text.classList.remove('placeholder');
  } else {
    resetCsel('task-csel');
  }

  document.getElementById('add-task-modal').classList.add('open');
  setTimeout(() => document.getElementById('inp-task-title').focus(), 50);
}

export function closeAddTask() {
  document.getElementById('add-task-modal').classList.remove('open');
  editTaskId = null;
}

export async function saveTask() {
  const titulo = document.getElementById('inp-task-title').value.trim();
  const nota   = document.getElementById('inp-task-note').value.trim();
  if (!titulo) return;
  if (!taskSelCatId) { toast('Escolha uma matéria para a tarefa.', 'erro'); return; }

  if (editTaskId) {
    await Api.updateTask(editTaskId, titulo, parseInt(taskSelCatId), nota);
  } else {
    await Api.createTask(titulo, parseInt(taskSelCatId), nota);
  }
  closeAddTask();
  await loadTasks();
}

export function initTaskModals() {
  document.getElementById('add-task-modal').addEventListener('click', function (e) { if (e.target === this) closeAddTask(); });
  document.getElementById('inp-task-title').addEventListener('keydown', e => { if (e.key === 'Enter') saveTask(); });
  document.getElementById('view-task-modal').addEventListener('click', function (e) { if (e.target === this) closeViewTask(); });
  document.getElementById('done-tasks-modal').addEventListener('click', function (e) { if (e.target === this) closeDoneTasks(); });
}

export async function openDoneTasks() {
  document.getElementById('done-tasks-modal').classList.add('open');
  await refreshDoneTasksList();
}

export function closeDoneTasks() {
  document.getElementById('done-tasks-modal').classList.remove('open');
}

async function refreshDoneTasksList() {
  const el = document.getElementById('done-tasks-list');
  el.innerHTML = '<div style="color:var(--text3);font-size:0.875rem;text-align:center;padding:24px">Carregando…</div>';

  let done = [];
  try { done = await Api.getDoneTasks(); } catch { done = []; }

  if (!done.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:0.875rem;text-align:center;padding:32px 16px">Nenhuma tarefa concluída ainda.</div>';
    return;
  }

  el.innerHTML = done.map(t => {
    const { style } = corDoCard(t.categoria_id);
    const catHtml = t.category_name
      ? `<div class="kanban-card-cat"><div class="kanban-card-cat-dot" style="background:${t.category_color}"></div>${esc(t.category_name)}</div>`
      : '';
    const quando = t.concluida_em ? new Date(t.concluida_em.replace(' ', 'T')).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="done-task-row" style="${style}">
      <div class="done-task-info">
        <div class="kanban-card-title">${esc(t.titulo)}</div>
        ${catHtml}
        <span class="done-task-when">Concluída em ${quando}</span>
      </div>
      <button class="kanban-undo-btn" onclick="reopenTask(${t.id})">${ico('undo')} Reabrir</button>
    </div>`;
  }).join('');
}

export async function reopenTask(id) {
  await Api.reopenTask(id);
  await refreshDoneTasksList();
  await loadTasks();
}