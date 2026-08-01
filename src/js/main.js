import { initCselGlobalClose, toggleCsel, pickCsel } from './csel.js';
import {
  loadCategories, openCatModal, closeCatModal, saveCategory, deleteCat,
  pickColor, initCategoryModals,
} from './categories.js';
import {
  loadSettings, openSettings, closeSettings, saveSettings,
  startTimer, togglePause, askStop, closeConfirm, confirmStop, dismissAlarm,
  initTimerModals,
} from './timer.js';
import {
  loadChart, loadStats, loadSessions, setPeriod, toggleGroup, deleteSess,
  openEditSess, closeEditSess, saveEditSess, initSessionModals,
} from './sessions.js';
import {
  loadTasks, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  undoComplete, deleteTask, openAddTask, openEditTask, closeAddTask, saveTask, initTaskModals,
} from './tasks.js';
import {
  loadCronograma, openAddSchedule, closeAddSchedule, saveScheduleEntry, removeScheduleEntry,
  onCatChipDragStart, onCatChipDragEnd, onEntryDragStart, onEntryDragEnd,
  onDiaDragOver, onDiaDragLeave, onDiaDrop, initCronogramaModals,
} from './cronograma.js';

const API = 'http://localhost:8000/api';

async function checkConn() {
  try { const r = await fetch(`${API}/categories`); setConn(r.ok); }
  catch { setConn(false); }
}
function setConn(ok) {
  document.getElementById('conn-dot').className = 'conn-dot' + (ok ? ' ok' : '');
  document.getElementById('conn-label').textContent = ok ? 'Conectado' : 'Servidor offline';
}

function switchView(view, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  btn.classList.add('active');
  if (view === 'kanban')     loadTasks();
  if (view === 'cronograma') loadCronograma();
}

window.addEventListener('DOMContentLoaded', async () => {
  initCselGlobalClose();
  initCategoryModals();
  initTimerModals();
  initSessionModals();
  initTaskModals();
  initCronogramaModals();

  await checkConn();
  await loadSettings();
  await loadCategories();
  await loadChart();
  await loadStats();
  await loadSessions();
});

// ── Ponte para os atributos onclick/ondrag* do HTML ──
Object.assign(window, {
  switchView,
  toggleCsel, pickCsel,
  openCatModal, closeCatModal, saveCategory, deleteCat, pickColor,
  openSettings, closeSettings, saveSettings,
  startTimer, togglePause, askStop, closeConfirm, confirmStop, dismissAlarm,
  setPeriod, toggleGroup, deleteSess, openEditSess, closeEditSess, saveEditSess,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  undoComplete, deleteTask, openAddTask, openEditTask, closeAddTask, saveTask,
  openAddSchedule, closeAddSchedule, saveScheduleEntry, removeScheduleEntry,
  onCatChipDragStart, onCatChipDragEnd, onEntryDragStart, onEntryDragEnd,
  onDiaDragOver, onDiaDragLeave, onDiaDrop,
});