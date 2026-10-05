import { initCselGlobalClose, toggleCsel, pickCsel } from './csel.js';
import {
  loadCategories, openCatModal, closeCatModal, saveCategory, deleteCat,
  pickColor, initCategoryModals,
} from './categories.js';
import {
  loadSettings, openSettings, closeSettings, saveSettings,
  startTimer, togglePause, askStop, closeConfirm, confirmStop, discardStop, dismissAlarm,
  initTimerModals,
} from './timer.js';
import {
  loadChart, loadStats, loadSessions, setPeriod, toggleGroup, deleteSess,
  openEditSess, closeEditSess, saveEditSess, initSessionModals,
  prevPeriod, nextPeriod,
  openManualSess, closeManualSess, saveManualSess,
} from './sessions.js';
import {
  loadTasks, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  undoComplete, deleteTask, openAddTask, openEditTask, closeAddTask, saveTask, initTaskModals,
  openTaskView, closeViewTask, editFromView,
  openDoneTasks, closeDoneTasks, reopenTask,
} from './tasks.js';
import {
  loadCronograma, openAddSchedule, closeAddSchedule, saveScheduleEntry, removeScheduleEntry,
  onCatChipDragStart, onCatChipDragEnd, onEntryDragStart, onEntryDragEnd,
  onDiaDragOver, onDiaDragLeave, onDiaDrop, initCronogramaModals,
} from './cronograma.js';

const API = 'http://localhost:8000/api';

// ── Tema (claro/escuro) ──────────────────────────────────────────────────
// Aplicado logo na carga do módulo (antes do DOMContentLoaded) pra evitar
// o "flash" do tema claro antes de trocar pro escuro.
const TEMA_CHAVE = 'gerenciador-tema';

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = tema === 'dark' ? '☀' : '🌙';
}

function toggleTheme() {
  const atual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const novo = atual === 'dark' ? 'light' : 'dark';
  localStorage.setItem(TEMA_CHAVE, novo);
  aplicarTema(novo);
}

aplicarTema(localStorage.getItem(TEMA_CHAVE) || 'light');

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

Object.assign(window, {
  switchView,
  toggleTheme,
  toggleCsel, pickCsel,
  openCatModal, closeCatModal, saveCategory, deleteCat, pickColor,
  openSettings, closeSettings, saveSettings,
  startTimer, togglePause, askStop, closeConfirm, confirmStop, discardStop, dismissAlarm,
  setPeriod, toggleGroup, deleteSess, openEditSess, closeEditSess, saveEditSess,
  prevPeriod, nextPeriod,
  openManualSess, closeManualSess, saveManualSess,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  undoComplete, deleteTask, openAddTask, openEditTask, closeAddTask, saveTask,
  openTaskView, closeViewTask, editFromView,
  openDoneTasks, closeDoneTasks, reopenTask,
  openAddSchedule, closeAddSchedule, saveScheduleEntry, removeScheduleEntry,
  onCatChipDragStart, onCatChipDragEnd, onEntryDragStart, onEntryDragEnd,
  onDiaDragOver, onDiaDragLeave, onDiaDrop,
});
