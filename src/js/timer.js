// ── Módulo do timer (bloco de estudo) ─────────────────────────────────────────
// Dono de tudo que antes era global e só fazia sentido aqui: activeSession,
// isPaused, timerInterval, alarmFired, blockSeconds, selCatId.

import { Api } from './api.js';
import { fmtClock, fmtDuration, parseGoal } from './utils.js';
import { buildCsel, registerCsel } from './csel.js';
import { getCategories, onCategoriesChange } from './categories.js';
import { refreshAll as refreshSessions } from './sessions.js';

let activeSession = null;
let isPaused      = false;
let timerInterval = null;
let alarmFired    = false;
let blockSeconds  = 4500;
let selCatId      = null;

registerCsel('cat-csel', {
  onSelect: (id) => { selCatId = id; },
  getCategories,
});

// Mantém o dropdown de matéria do timer sincronizado sempre que a lista muda.
onCategoriesChange((categories) => buildCsel('cat-csel', categories, selCatId));

export async function loadSettings() {
  try {
    const s = await Api.getSettings();
    if (s.block_duration) { blockSeconds = parseInt(s.block_duration); renderBlockStatus(); }
  } catch {}
}

function renderBlockStatus() {
  const el = document.getElementById('block-status');
  if (blockSeconds > 0) {
    el.style.display = 'flex';
    document.getElementById('block-label').textContent = fmtDuration(blockSeconds);
  } else {
    el.style.display = 'none';
  }
}

export function openSettings() {
  document.getElementById('inp-block').value = fmtDuration(blockSeconds);
  document.getElementById('settings-modal').classList.add('open');
  setTimeout(() => document.getElementById('inp-block').focus(), 50);
}
export function closeSettings() { document.getElementById('settings-modal').classList.remove('open'); }

export async function saveSettings() {
  const secs = parseGoal(document.getElementById('inp-block').value.trim());
  if (!secs) { alert('Formato inválido. Use ex: 1h15m ou 45m'); return; }
  blockSeconds = secs;
  await Api.saveSettings(secs);
  renderBlockStatus();
  closeSettings();
}

function elapsedSecs() {
  if (!activeSession) return 0;
  if (isPaused) return activeSession.pausedTotal || 0;
  const acumuladoAnterior = activeSession.pausedTotal || 0;
  const novosSegundos = Math.floor((Date.now() - activeSession.startedAt) / 1000);
  return acumuladoAnterior + novosSegundos;
}

export async function startTimer() {
  const catId = selCatId;
  if (!catId) {
    alert('Selecione uma matéria antes de iniciar o bloco de estudos!');
    return;
  }
  const note = document.getElementById('inp-note').value.trim();
  const sess = await Api.startSession(parseInt(catId), note);

  activeSession = { id: sess.id, startedAt: Date.now(), pausedTotal: 0 };
  isPaused   = false;
  alarmFired = false;

  const cat   = getCategories().find(c => String(c.id) === String(catId));
  const color = cat ? cat.color : 'var(--accent)';

  if (cat) {
    document.getElementById('badge-dot').style.background = cat.color;
    document.getElementById('badge-name').textContent = cat.name;
    document.getElementById('active-badge').style.display = 'flex';
  } else {
    document.getElementById('active-badge').style.display = 'none';
  }
  document.getElementById('clock').style.color = color;
  document.getElementById('clock').classList.add('running');
  document.getElementById('progress-fill').style.background = color;
  if (blockSeconds > 0) document.getElementById('progress-wrap').style.display = 'block';

  const timerCard = document.querySelector('.timer-card');
  timerCard.style.setProperty('--timer-color', color);
  timerCard.classList.add('timer-running');

  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  document.getElementById('btn-stop').disabled  = false;
  document.getElementById('inp-note').disabled  = true;
  document.querySelector('#cat-csel .csel-trigger').disabled = true;

  timerInterval = setInterval(tick, 1000);
}

function tick() {
  if (!activeSession) return;

  const elapsed = elapsedSecs();
  const clockEl = document.getElementById('clock');
  clockEl.textContent = fmtClock(elapsed);
  document.title = `⏱ ${fmtClock(elapsed)}`;

  if (blockSeconds > 0) {
    const pct = Math.min(100, Math.round((elapsed / blockSeconds) * 100));
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('pct-label').textContent = pct + '%';
    document.getElementById('progress-fill').classList.toggle('over', pct >= 100);
    if (elapsed >= blockSeconds && !alarmFired) { alarmFired = true; fireAlarm(); }
  }
}

export function togglePause() {
  if (!activeSession) return;
  const btn = document.getElementById('btn-pause');
  const clockEl = document.getElementById('clock');
  const pausedTag = document.getElementById('paused-tag');

  if (!isPaused) {
    activeSession.pausedTotal = elapsedSecs();
    isPaused = true;
    btn.textContent = '▶ Retomar';
    btn.classList.replace('btn-pause', 'btn-primary');
    clockEl.classList.add('paused');
    pausedTag.style.display = 'flex';
    document.querySelector('.timer-card').classList.replace('timer-running', 'timer-paused');
  } else {
    activeSession.startedAt = Date.now();
    isPaused = false;
    btn.innerHTML = '⏸ Pausar';
    btn.classList.replace('btn-primary', 'btn-pause');
    clockEl.classList.remove('paused');
    pausedTag.style.display = 'none';
    document.querySelector('.timer-card').classList.replace('timer-paused', 'timer-running');
  }
  tick();
}

export function askStop() {
  document.getElementById('confirm-modal').classList.add('open');
}
export function closeConfirm() {
  document.getElementById('confirm-modal').classList.remove('open');
}
export async function confirmStop() {
  closeConfirm();
  await stopTimer();
}

async function stopTimer() {
  clearInterval(timerInterval);
  if (!activeSession) return;
  await Api.stopSession(activeSession.id, elapsedSecs());
  activeSession = null;
  isPaused      = false;

  document.getElementById('clock').textContent    = '00:00:00';
  document.getElementById('clock').style.color    = '';
  document.getElementById('clock').classList.remove('paused');
  document.getElementById('clock').classList.remove('running');
  const timerCard = document.querySelector('.timer-card');
  timerCard.classList.remove('timer-running', 'timer-paused');
  timerCard.style.removeProperty('--timer-color');
  document.getElementById('paused-tag').style.display = 'none';
  document.getElementById('btn-start').disabled   = false;
  document.getElementById('btn-pause').disabled   = true;
  document.getElementById('btn-stop').disabled    = true;
  document.getElementById('btn-pause').textContent = '⏸ Pausar';
  document.getElementById('btn-pause').classList.replace('btn-primary', 'btn-pause');
  document.getElementById('progress-wrap').style.display = 'none';
  document.getElementById('progress-fill').style.width   = '0%';
  document.getElementById('active-badge').style.display  = 'none';
  document.getElementById('inp-note').disabled  = false;
  document.querySelector('#cat-csel .csel-trigger').disabled = false;
  document.getElementById('inp-note').value     = '';
  document.title = 'Gerenciador·de·Estudos';

  await refreshSessions();
}

function fireAlarm() {
  document.getElementById('alarm').classList.add('show');
  beep();
}
export function dismissAlarm() { document.getElementById('alarm').classList.remove('show'); }
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0, .15], [1046, .2, .15], [1318, .42, .32]].forEach(([freq, when, dur]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = 'sine';
      g.gain.setValueAtTime(.4, ctx.currentTime + when);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + when + dur);
      o.start(ctx.currentTime + when); o.stop(ctx.currentTime + when + dur + .05);
    });
  } catch {}
}

export function initTimerModals() {
  document.getElementById('settings-modal').addEventListener('click', function (e) { if (e.target === this) closeSettings(); });
  document.getElementById('inp-block').addEventListener('keydown', e => { if (e.key === 'Enter') saveSettings(); });
  document.getElementById('confirm-modal').addEventListener('click', function (e) { if (e.target === this) closeConfirm(); });
}