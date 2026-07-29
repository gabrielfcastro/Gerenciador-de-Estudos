// ── Ponto de entrada da aplicação ─────────────────────────────────────────────
// Este é o único arquivo que "conhece" todos os módulos. Cada módulo (timer,
// categories, sessions, tasks, cronograma) só conhece o que precisa para
// funcionar sozinho — quem os conecta é este arquivo.
//
// Nota sobre window.*: o HTML usa atributos onclick/ondragstart inline
// (ex.: onclick="startTimer()"). Com ES modules essas funções não ficam
// automaticamente acessíveis global, então expomos aqui, de forma explícita,
// só o que o HTML realmente chama. É uma ponte pro HTML existente — o estado
// em si (as variáveis let que existiam soltas antes) continua todo
// encapsulado dentro de cada módulo.

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
  undoComplete, deleteTask, openAddTask, closeAddTask, saveTask, initTaskModals,
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
  undoComplete, deleteTask, openAddTask, closeAddTask, saveTask,
  openAddSchedule, closeAddSchedule, saveScheduleEntry, removeScheduleEntry,
  onCatChipDragStart, onCatChipDragEnd, onEntryDragStart, onEntryDragEnd,
  onDiaDragOver, onDiaDragLeave, onDiaDrop,
});