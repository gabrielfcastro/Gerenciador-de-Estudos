import { loadHeatmap } from './heatmap.js';
import { atualizarIndicadorConexao } from './conn.js';
import { ico } from './icons.js';
import { initCselGlobalClose, initCselKeyboard, toggleCsel, pickCsel } from './csel.js';
import {
  loadCategories, openCatModal, closeCatModal, saveCategory, deleteCat,
  pickColor, initCategoryModals,
} from './categories.js';
import {
  loadSettings, openSettings, closeSettings, saveSettings,
  startTimer, togglePause, askStop, closeConfirm, confirmStop, discardStop, dismissAlarm,
  initTimerModals, reaplicarCorDeFundo,
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
  openDoneTasks, closeDoneTasks, reopenTask, concluirTarefa,
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
  if (btn) {
    const rotulo = tema === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
    btn.innerHTML = ico(tema === 'dark' ? 'sun' : 'moon');
    btn.setAttribute('aria-label', rotulo);
    btn.setAttribute('title', rotulo);
  }
}

function toggleTheme() {
  const atual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const novo = atual === 'dark' ? 'light' : 'dark';
  localStorage.setItem(TEMA_CHAVE, novo);
  aplicarTema(novo);
  reaplicarCorDeFundo();
  loadChart();
}

aplicarTema(localStorage.getItem(TEMA_CHAVE) || 'light');

async function checkConn() {
  try { const r = await fetch(`${API}/categories`); atualizarIndicadorConexao(r.ok); }
  catch { atualizarIndicadorConexao(false); }
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
  initCselKeyboard();
  initCategoryModals();
  initTimerModals();
  initSessionModals();
  initTaskModals();
  initCronogramaModals();

  await checkConn();
  setInterval(checkConn, 20000);   // avisa se o servidor cair no meio do uso
  await loadSettings();
  await loadCategories();
  await loadChart();
  await loadStats();
  await loadSessions();
  await loadHeatmap();
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
  openDoneTasks, closeDoneTasks, reopenTask, concluirTarefa,
  openAddSchedule, closeAddSchedule, saveScheduleEntry, removeScheduleEntry,
  onCatChipDragStart, onCatChipDragEnd, onEntryDragStart, onEntryDragEnd,
  onDiaDragOver, onDiaDragLeave, onDiaDrop,
});
