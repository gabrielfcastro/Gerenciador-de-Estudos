// ── Módulo de tarefas (kanban) ────────────────────────────────────────────────

import { Api } from './api.js';
import { esc } from '../../gerenciador-de-estudos-atualizado/src/js/utils.js';
import { buildCsel, registerCsel, resetCsel } from '../../gerenciador-de-estudos-atualizado/src/js/csel.js';
import { getCategories } from '../../gerenciador-de-estudos-atualizado/src/js/categories.js';

let tasks           = [];
let draggedId       = null;
let undoTimer       = null;
let pendingDeleteId = null;
let taskSelCatId    = null;
let editTaskId      = null;

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
  const todoEl   = document.getElementById('todo-cards');
  const countEl  = document.getElementById('todo-count');
  const doneHint = document.getElementById('done-hint');
  countEl.textContent  = tasks.length;
  document.getElementById('done-count').textContent = '0';
  if (doneHint) doneHint.style.display = 'block';

  if (!tasks.length) {
    todoEl.innerHTML = '<div style="color:var(--text3);font-size:.82rem;text-align:center;padding:32px 16px">Nenhuma tarefa ainda</div>';
    return;
  }

  todoEl.innerHTML = tasks.map(t => {
    const cat = t.categoria_id ? getCategories().find(c => String(c.id) === String(t.categoria_id)) : null;
    const catHtml = cat
      ? `<div class="kanban-card-cat">
           <div class="kanban-card-cat-dot" style="background:${cat.color}"></div>
           ${esc(cat.name)}
         </div>` : '';
    const nota = t.nota || t.note || '';
    const notaHtml = nota ? `<div class="kanban-card-note"> ${esc(nota)}</div>` : '';
    return `<div class="kanban-card" draggable="true" data-id="${t.id}"
      ondragstart="onDragStart(event,${t.id})"
      ondragend="onDragEnd(event)">
      <div class="kanban-card-top">
        <div class="kanban-card-title">${esc(t.titulo)}</div>
        <div class="kanban-card-acts">
          <button class="kanban-card-edit" onclick="openEditTask(${t.id})" title="Editar">✏</button>
          <button class="kanban-card-del" onclick="deleteTask(${t.id})" title="Remover">✕</button>
        </div>
      </div>
      ${catHtml}
      ${notaHtml}
    </div>`;
  }).join('');
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
  renderTasks();

  if (undoTimer) { clearTimeout(undoTimer); deleteNow(pendingDeleteId); }
  pendingDeleteId = taskId;

  document.getElementById('undo-text').textContent = `"${task.titulo}" concluída`;
  document.getElementById('undo-banner').classList.add('show');

  const prog = document.getElementById('undo-progress');
  prog.style.transition = 'none';
  prog.style.width = '100%';
  requestAnimationFrame(() => {
    prog.style.transition = 'width 4s linear';
    prog.style.width = '0%';
  });

  undoTimer = setTimeout(() => {
    deleteNow(pendingDeleteId);
    pendingDeleteId = null;
    document.getElementById('undo-banner').classList.remove('show');
  }, 4000);
}

async function deleteNow(id) {
  if (!id) return;
  await Api.deleteTask(id);
}

export function undoComplete() {
  clearTimeout(undoTimer);
  undoTimer = null;
  document.getElementById('undo-banner').classList.remove('show');
  pendingDeleteId = null;
  loadTasks();
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
  if (!taskSelCatId) { alert('Selecione uma matéria para a tarefa!'); return; }

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
}
