const API = 'http://localhost:8000/api';
const COLORS = [
  '#7c6ff7','#34d399','#f87171','#fbbf24','#60a5fa',
  '#f472b6','#a78bfa','#2dd4bf','#fb923c','#a3e635',
  '#e879f9','#38bdf8','#4ade80','#facc15','#f43f5e'
];

let categories    = [];
let currentPeriod = 'week';
let activeSession = null;
let isPaused      = false;
let timerInterval = null;
let alarmFired    = false;
let chart         = null;
let editCatId     = null;
let selColor      = COLORS[0];
let blockSeconds  = 4500;
let catHours      = {};
let selCatId      = null;
let editSelCatId  = null;
let taskSelCatId  = null;
let tasks         = [];
let draggedId     = null;
let undoTimer     = null;
let pendingDeleteId = null;
let scheduleEntries = [];
let schedDia      = null;
let schedCatId    = null;

window.addEventListener('DOMContentLoaded', async () => {
  buildSwatches();
  await checkConn();
  await loadSettings();
  await loadCategories();
  await loadChart();
  await loadStats();
  await loadSessions();
  await loadCatHours();
});

async function checkConn() {
  try { const r = await fetch(`${API}/categories`); setConn(r.ok); }
  catch { setConn(false); }
}
function setConn(ok) {
  document.getElementById('conn-dot').className = 'conn-dot' + (ok ? ' ok' : '');
  document.getElementById('conn-label').textContent = ok ? 'Conectado' : 'Servidor offline';
}

async function loadSettings() {
  try {
    const s = await (await fetch(`${API}/settings`)).json();
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
function openSettings() {
  document.getElementById('inp-block').value = fmtDuration(blockSeconds);
  document.getElementById('settings-modal').classList.add('open');
  setTimeout(() => document.getElementById('inp-block').focus(), 50);
}
function closeSettings() { document.getElementById('settings-modal').classList.remove('open'); }
async function saveSettings() {
  const secs = parseGoal(document.getElementById('inp-block').value.trim());
  if (!secs) { alert('Formato inválido. Use ex: 1h15m ou 45m'); return; }
  blockSeconds = secs;
  await fetch(`${API}/settings`, {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ block_duration: secs })
  });
  renderBlockStatus();
  closeSettings();
}
document.getElementById('settings-modal').addEventListener('click', function(e){ if(e.target===this) closeSettings(); });
document.getElementById('inp-block').addEventListener('keydown', e => { if(e.key==='Enter') saveSettings(); });

async function loadCategories() {
  try { categories = await (await fetch(`${API}/categories`)).json(); renderCatList(); renderCatSelect(); }
  catch {}
}

async function loadCatHours() {
  try {
    const data = await (await fetch(`${API}/chart?period=${currentPeriod}`)).json();
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
  if (!categories.length) {
    el.innerHTML = '<div style="color:var(--text2);font-size:.82rem;padding:8px 4px">Nenhuma matéria ainda.</div>';
    return;
  }
  el.innerHTML = categories.map(c => {
    return `<div class="cat-item" style="border-left:3px solid ${c.color};background:${c.color}18">
      <span class="cat-name">${esc(c.name)}</span>
      <div class="cat-acts">
        <button onclick="openCatModal(${c.id})" title="Editar">✏</button>
        <button onclick="deleteCat(${c.id})" title="Excluir">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderCatSelect() {
  buildCsel('cat-csel', selCatId, (id) => { selCatId = id; });
}

function buildCsel(cselId, currentId, onSelect) {
  const menu = document.getElementById(cselId + '-menu');
  if (!menu) return;

  const noneHtml = `<div class="csel-none ${!currentId ? 'active' : ''}"
    onclick="pickCsel('${cselId}', null, null, null)">
    — Escolha uma matéria —
  </div>`;

  const optsHtml = categories.map(c => `
    <div class="csel-option ${String(c.id) === String(currentId) ? 'active' : ''}"
      onclick="pickCsel('${cselId}', ${c.id}, '${esc(c.name)}', '${c.color}')">
      <div class="csel-option-dot" style="background:${c.color}"></div>
      ${esc(c.name)}
    </div>`).join('');

  menu.innerHTML = noneHtml + optsHtml;
}

function toggleCsel(cselId) {
  const el = document.getElementById(cselId);
  const trigger = el.querySelector('.csel-trigger');
  if (trigger.disabled) return;
  document.querySelectorAll('.csel.open').forEach(c => { if (c.id !== cselId) c.classList.remove('open'); });
  el.classList.toggle('open');
}

function pickCsel(cselId, id, name, color) {
  const dot  = document.getElementById(cselId + '-dot');
  const text = document.getElementById(cselId + '-text');

  if (id) {
    dot.style.display  = 'inline-block';
    dot.style.background = color;
    text.textContent   = name;
    text.classList.remove('placeholder');
  } else {
    dot.style.display  = 'none';
    text.textContent   = '— Sem categoria —';
    text.classList.add('placeholder');
  }

  if (cselId === 'cat-csel')  selCatId     = id;
  if (cselId === 'edit-csel') editSelCatId = id;
  if (cselId === 'task-csel') taskSelCatId = id;
  if (cselId === 'sched-csel') schedCatId  = id;

  document.getElementById(cselId).classList.remove('open');

  buildCsel(cselId, id, null);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.csel')) {
    document.querySelectorAll('.csel.open').forEach(c => c.classList.remove('open'));
  }
});

async function deleteCat(id) {
  if (!confirm('Excluir matéria? Sessões existentes ficam sem categoria.')) return;
  await fetch(`${API}/categories/${id}`, {method:'DELETE'});
  await loadCategories(); await loadChart(); await loadCatHours();
}

function buildSwatches(usedColors = []) {
  document.getElementById('color-opts').innerHTML = COLORS.map(c => {
    const inUse = usedColors.includes(c);
    return `<div class="swatch ${c===selColor?'sel':''} ${inUse?'used':''}"
      style="background:${c}" data-color="${c}"
      onclick="pickColor('${c}')"
      title="${inUse ? 'Já em uso' : ''}"></div>`;
  }).join('');
}
function pickColor(c) {
  const swatch = document.querySelector(`.swatch[data-color="${c}"]`);
  if (swatch?.classList.contains('used')) return;
  selColor = c;
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('sel', s.dataset.color === c));
}
function openCatModal(id=null) {
  editCatId = id;
  const cat = id ? categories.find(c=>c.id===id) : null;
  const usedColors = categories.filter(c => c.id !== id).map(c => c.color);
  const defaultColor = cat ? cat.color : (COLORS.find(c => !usedColors.includes(c)) || COLORS[0]);
  document.getElementById('cat-modal-title').textContent = id ? 'Editar matéria' : 'Nova matéria';
  document.getElementById('inp-cat-name').value = cat ? cat.name : '';
  selColor = defaultColor;
  buildSwatches(usedColors);
  document.getElementById('cat-modal').classList.add('open');
  setTimeout(() => document.getElementById('inp-cat-name').focus(), 50);
}
function closeCatModal() { document.getElementById('cat-modal').classList.remove('open'); editCatId = null; }
async function saveCategory() {
  const name = document.getElementById('inp-cat-name').value.trim();
  if (!name) return;
  const payload = {name, color: selColor};
  if (editCatId) {
    await fetch(`${API}/categories/${editCatId}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  } else {
    await fetch(`${API}/categories`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  }
  closeCatModal();
  await loadCategories(); await loadCatHours();
}
document.getElementById('cat-modal').addEventListener('click', function(e){ if(e.target===this) closeCatModal(); });
document.getElementById('inp-cat-name').addEventListener('keydown', e => { if(e.key==='Enter') saveCategory(); });

function parseGoal(str) {
  if (!str) return null;
  str = str.trim().toLowerCase();
  let t = 0;
  const h = str.match(/(\d+)\s*h/); if(h) t += parseInt(h[1])*3600;
  const m = str.match(/(\d+)\s*m/); if(m) t += parseInt(m[1])*60;
  const s = str.match(/(\d+)\s*s/); if(s) t += parseInt(s[1]);
  if(!h&&!m&&!s){ if(/^\d+$/.test(str)) t=parseInt(str)*60; }
  return t > 0 ? t : null;
}
function fmtClock(secs) {
  const h=Math.floor(secs/3600), m=Math.floor((secs%3600)/60), s=secs%60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function fmtDuration(secs) {
  const h=Math.floor(secs/3600), m=Math.floor((secs%3600)/60), s=secs%60;
  if(h>0&&m>0) return `${h}h ${pad(m)}m`;
  if(h>0)      return `${h}h`;
  if(m>0&&s>0) return `${m}m ${pad(s)}s`;
  if(m>0)      return `${m}m`;
  return `${s}s`;
}
function pad(n){ return String(n).padStart(2,'0'); }

function elapsedSecs() {
  if (!activeSession) return 0;
  if (isPaused) return activeSession.pausedTotal || 0;

  const acumuladoAnterior = activeSession.pausedTotal || 0;
  const novosSegundos = Math.floor((Date.now() - activeSession.startedAt) / 1000);
  return acumuladoAnterior + novosSegundos;
}

async function startTimer() {
  const catId = selCatId;
  if (!catId) {
    alert('Selecione uma matéria antes de iniciar o bloco de estudos!');
    return;
  }
  const note  = document.getElementById('inp-note').value.trim();
  const r = await fetch(`${API}/sessions/start`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ category_id: parseInt(catId), note })
  });
  const sess = await r.json();

  activeSession = { id: sess.id, startedAt: Date.now(), pausedTotal: 0 };
  isPaused   = false;
  alarmFired = false;

  const cat   = categories.find(c=>String(c.id)===String(catId));
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

function togglePause() {
  if (!activeSession) return;
  const btn = document.getElementById('btn-pause');
  const clockEl = document.getElementById('clock');
  const pausedTag = document.getElementById('paused-tag');

  if (!isPaused) {
    activeSession.pausedTotal = elapsedSecs();
    isPaused = true;
    btn.textContent = '▶ Retomar';
    btn.classList.replace('btn-pause','btn-primary');
    clockEl.classList.add('paused');
    pausedTag.style.display = 'flex';
  } else {
    activeSession.startedAt = Date.now();
    isPaused = false;
    btn.innerHTML = '⏸ Pausar';
    btn.classList.replace('btn-primary','btn-pause');
    clockEl.classList.remove('paused');
    pausedTag.style.display = 'none';
  }
  tick();
}

function askStop() {
  document.getElementById('confirm-modal').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirm-modal').classList.remove('open');
}
async function confirmStop() {
  closeConfirm();
  await stopTimer();
}
document.getElementById('confirm-modal').addEventListener('click', function(e){ if(e.target===this) closeConfirm(); });

async function stopTimer() {
  clearInterval(timerInterval);
  if (!activeSession) return;
  await fetch(`${API}/sessions/stop`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      session_id: activeSession.id,
      duration_seconds: elapsedSecs()
    })
  });
  activeSession = null;
  isPaused      = false;

  document.getElementById('clock').textContent    = '00:00:00';
  document.getElementById('clock').style.color    = '';
  document.getElementById('clock').classList.remove('paused');
  document.getElementById('clock').classList.remove('running');
  document.getElementById('paused-tag').style.display = 'none';
  document.getElementById('btn-start').disabled   = false;
  document.getElementById('btn-pause').disabled   = true;
  document.getElementById('btn-stop').disabled    = true;
  document.getElementById('btn-pause').textContent = '⏸ Pausar';
  document.getElementById('btn-pause').classList.replace('btn-primary','btn-pause');
  document.getElementById('progress-wrap').style.display = 'none';
  document.getElementById('progress-fill').style.width   = '0%';
  document.getElementById('active-badge').style.display  = 'none';
  document.getElementById('inp-note').disabled  = false;
  document.querySelector('#cat-csel .csel-trigger').disabled = false;
  document.getElementById('inp-note').value     = '';
  document.title = 'Gerenciador·de·Estudos';

  await Promise.all([loadSessions(), loadStats(), loadChart(), loadCatHours()]);
}

function fireAlarm() {
  document.getElementById('alarm').classList.add('show');
  beep();
}
function dismissAlarm() { document.getElementById('alarm').classList.remove('show'); }
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880,0,.15],[1046,.2,.15],[1318,.42,.32]].forEach(([freq,when,dur]) => {
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value=freq; o.type='sine';
      g.gain.setValueAtTime(.4, ctx.currentTime+when);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime+when+dur);
      o.start(ctx.currentTime+when); o.stop(ctx.currentTime+when+dur+.05);
    });
  } catch{}
}

// ── Formatação de labels do gráfico ───────────────────────
const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function formatarLabels(periods, period) {
  if (period === 'week') {
    return periods.map(p => { const d = new Date(p + 'T12:00:00'); return DIAS_SEMANA[d.getDay()]; });
  }
  if (period === 'month') {
    return periods.map((_, i) => `Semana ${i + 1}`);
  }
  if (period === '6months' || period === 'year') {
    return periods.map(p => { const [, mes] = p.split('-'); return MESES_NOMES[parseInt(mes) - 1]; });
  }
  if (period === 'all') {
    return periods.map(p => { const [ano, mes] = p.split('-'); return `${MESES_NOMES[parseInt(mes) - 1]} ${ano}`; });
  }
  return periods;
}

async function loadChart() {
  try { renderChart(await (await fetch(`${API}/chart?period=${currentPeriod}`)).json()); }
  catch {}
}

function renderChart(data) {
  const ctx = document.getElementById('chart').getContext('2d');
  if (chart) chart.destroy();

  if (currentPeriod === 'all' || currentPeriod === 'today') {
    const bycat = {};
    data.forEach(d => {
      const key   = d.category_name || 'Sem categoria';
      const color = d.category_color || '#8b90a8';
      if (!bycat[key]) bycat[key] = { secs: 0, color };
      bycat[key].secs += d.total_seconds;
    });
    const labels = Object.keys(bycat);
    const values = labels.map(k => +(bycat[k].secs / 3600).toFixed(2));
    const colors = labels.map(k => bycat[k].color);

    const wrap = document.getElementById('chart').parentElement;
    wrap.className = 'chart-wrap-pie';
    wrap.innerHTML = `<canvas id="chart"></canvas><div class="pie-legend" id="pie-legend"></div>`;
    const ctx2 = document.getElementById('chart').getContext('2d');

    chart = new Chart(ctx2, {
      type: 'doughnut',
      data: { labels, datasets:[{ data: values, backgroundColor: colors.map(c=>c+'cc'), borderColor: colors, borderWidth: 2 }] },
      options: {
        responsive: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed.toFixed(1)}h` } } },
        cutout: '60%',
      }
    });

    const totalH = values.reduce((a,b)=>a+b,0);
    document.getElementById('pie-legend').innerHTML = labels.map((l,i) => `
      <div class="pie-legend-item">
        <div class="pie-legend-dot" style="background:${colors[i]}"></div>
        <span class="pie-legend-name">${esc(l)}</span>
        <span class="pie-legend-val">${values[i].toFixed(1)}h</span>
      </div>`).join('');
    return;
  }

  const wrap = document.getElementById('chart') ? document.getElementById('chart').parentElement : null;
  if (wrap && wrap.className !== 'chart-wrap') {
    wrap.className = 'chart-wrap';
    wrap.innerHTML = `<canvas id="chart"></canvas>`;
  }
  const ctxBar = document.getElementById('chart').getContext('2d');

  const periods  = [...new Set(data.map(d=>d.period_key))];
  const labels   = formatarLabels(periods, currentPeriod);
  const catNames = [...new Set(data.filter(d=>d.category_name).map(d=>d.category_name))];
  const datasets = catNames.map(name => {
    const color = data.find(d=>d.category_name===name)?.category_color || '#7c6ff7';
    return {
      label: name,
      data: periods.map(p => { const r=data.find(d=>d.period_key===p&&d.category_name===name); return r?+(r.total_seconds/3600).toFixed(2):0; }),
      backgroundColor:color+'cc', borderColor:color, borderWidth:1, borderRadius:6,
    };
  });
  const uncatData = periods.map(p => { const r=data.find(d=>d.period_key===p&&!d.category_name); return r?+(r.total_seconds/3600).toFixed(2):0; });
  if (uncatData.some(v=>v>0)) datasets.push({ label:'Sem categoria', data:uncatData, backgroundColor:'#8b90a8cc', borderColor:'#8b90a8', borderWidth:1, borderRadius:6 });

  chart = new Chart(ctxBar, {
    type:'bar', data:{ labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ labels:{ color:'#4e5370', font:{size:12}, boxWidth:10, borderRadius:4 }},
        tooltip:{ callbacks:{ label:c=>` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}h` }}
      },
      scales:{
        x:{ stacked:true, ticks:{color:'#4e5370',font:{size:11}}, grid:{color:'#a8adc0'} },
        y:{ stacked:true, ticks:{color:'#4e5370',font:{size:11},callback:v=>v+'h'}, grid:{color:'#a8adc0'} }
      }
    }
  });
}
function setPeriod(p, btn) {
  currentPeriod = p;
  document.querySelectorAll('.ptab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  loadChart(); loadStats(); loadSessions(); loadCatHours();
}

async function loadStats() {
  try {
    const d = await (await fetch(`${API}/stats?period=${currentPeriod}`)).json();
    const {total_seconds:t, session_count:c} = d;
    document.getElementById('stat-total').textContent = t ? fmtDuration(t) : '—';
    document.getElementById('stat-count').textContent = c || '—';
    document.getElementById('stat-avg').textContent   = c ? fmtDuration(Math.round(t/c)) : '—';
  } catch {}
}

// ── Sessões agrupadas por matéria ──────────────────────────
let openGroups = new Set();

async function loadSessions() {
  try {
    const all = await (await fetch(`${API}/sessions?period=${currentPeriod}`)).json();
    renderSessions(all);
  } catch {}
}

function groupSessions(list) {
  const map = new Map();
  for (const s of list) {
    const key = s.category_id ?? s.categoria_id ?? 'sem-cat';
    if (!map.has(key)) {
      map.set(key, {
        category_id:    s.category_id ?? s.categoria_id,
        category_name:  s.category_name  || 'Sem categoria',
        category_color: s.category_color || '#8b90a8',
        total_seconds:  0,
        sessions:       [],
      });
    }
    const g = map.get(key);
    g.total_seconds += s.duration_seconds || 0;
    g.sessions.push(s);
  }
  return [...map.values()].sort((a, b) => b.total_seconds - a.total_seconds);
}

function renderSessions(list) {
  const el = document.getElementById('sess-list');
  if (!list.length) { el.innerHTML='<div class="empty">📚 Nenhuma sessão neste período.</div>'; return; }
  const groups = groupSessions(list);
  el.innerHTML = groups.map(g => {
    const isOpen     = openGroups.has(g.category_id);
    const count      = g.sessions.length;
    const total      = fmtDuration(g.total_seconds);
    const labelCount = count === 1 ? '1 sessão' : `${count} sessões`;
    const children   = g.sessions.map(s => {
      const dur  = s.duration_seconds ? fmtDuration(s.duration_seconds) : '—';
      const raw  = s.started_at || s.inicio || '';
      const dt   = raw ? new Date(raw.replace(' ','T')).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
      const note = s.note ? `<span class="sess-child-note">📝 ${esc(s.note)}</span>` : '';
      return `<div class="sess-child">
        <div class="sess-child-left">
          <span class="sess-child-time">${dt}</span>${note}
        </div>
        <span class="sess-child-dur">${dur}</span>
        <button class="sess-edit" onclick="openEditSess(${s.id})" title="Editar">✏</button>
        <button class="sess-del"  onclick="deleteSess(${s.id})"   title="Excluir">✕</button>
      </div>`;
    }).join('');
    return `<div class="sess-group">
      <div class="sess-group-header" onclick="toggleGroup(${JSON.stringify(g.category_id)})">
        <div class="sess-group-dot" style="background:${g.category_color}"></div>
        <span class="sess-group-name">${esc(g.category_name)}</span>
        <span class="sess-group-meta">${labelCount}</span>
        <span class="sess-group-total">${total}</span>
        <span class="sess-group-arrow ${isOpen?'open':''}">▶</span>
      </div>
      <div class="sess-group-children" style="display:${isOpen?'block':'none'}">${children}</div>
    </div>`;
  }).join('');
}

function toggleGroup(categoryId) {
  if (openGroups.has(categoryId)) openGroups.delete(categoryId);
  else openGroups.add(categoryId);
  loadSessions();
}

async function deleteSess(id) {
  if (!confirm('Excluir essa sessão de estudo permanentemente?')) return;
  await fetch(`${API}/sessions/${id}`, { method: 'DELETE' });
  await Promise.all([loadSessions(), loadStats(), loadChart(), loadCatHours()]);
}

let editSessId = null;

function toLocalDatetimeValue(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T'));
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toUTCIso(localStr) {
  return new Date(localStr).toISOString();
}

async function openEditSess(id) {
  const all = await (await fetch(`${API}/sessions?period=all`)).json();
  const s = all.find(x => x.id === id);
  if (!s) return;

  editSessId = id;
  editSelCatId = s.category_id || s.categoria_id || null;

  buildCsel('edit-csel', editSelCatId, null);

  const cat = editSelCatId ? categories.find(c => String(c.id) === String(editSelCatId)) : null;
  const dot  = document.getElementById('edit-csel-dot');
  const text = document.getElementById('edit-csel-text');
  if (cat) {
    dot.style.display    = 'inline-block';
    dot.style.background = cat.color;
    text.textContent     = cat.name;
    text.classList.remove('placeholder');
  } else {
    dot.style.display = 'none';
    text.textContent  = '— sem categoria —';
    text.classList.add('placeholder');
  }

  const inicioStr = s.started_at || s.inicio || '';
  const fimStr    = s.fim || s.ended_at || '';
  document.getElementById('edit-start').value = toLocalDatetimeValue(inicioStr);
  document.getElementById('edit-end').value   = toLocalDatetimeValue(fimStr);
  document.getElementById('edit-note').value  = s.note || s.nota || '';

  document.getElementById('edit-sess-modal').classList.add('open');
}

function closeEditSess() {
  document.getElementById('edit-sess-modal').classList.remove('open');
  editSessId = null;
}

async function saveEditSess() {
  const startLocal = document.getElementById('edit-start').value;
  const endLocal   = document.getElementById('edit-end').value;
  if (!startLocal || !endLocal) { alert('Preencha início e fim.'); return; }

  const startUTC = toUTCIso(startLocal);
  const endUTC   = toUTCIso(endLocal);
  if (new Date(endUTC) <= new Date(startUTC)) {
    alert('O fim deve ser depois do início.'); return;
  }

  const catId = editSelCatId || null;
  const note  = document.getElementById('edit-note').value.trim();

  await fetch(`${API}/sessions/${editSessId}`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      category_id: catId ? parseInt(catId) : null,
      started_at:  startUTC,
      ended_at:    endUTC,
      note
    })
  });

  closeEditSess();
  await Promise.all([loadSessions(), loadStats(), loadChart(), loadCatHours()]);
}

document.getElementById('edit-sess-modal').addEventListener('click', function(e){
  if (e.target === this) closeEditSess();
});

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function switchView(view, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  btn.classList.add('active');
  if (view === 'kanban') loadTasks();
  if (view === 'cronograma') loadCronograma();
}

async function loadTasks() {
  try {
    tasks = await (await fetch(`${API}/tasks`)).json();
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
    const cat = t.categoria_id ? categories.find(c => String(c.id) === String(t.categoria_id)) : null;
    const catHtml = cat
      ? `<div class="kanban-card-cat">
           <div class="kanban-card-cat-dot" style="background:${cat.color}"></div>
           ${esc(cat.name)}
         </div>` : '';
    return `<div class="kanban-card" draggable="true" data-id="${t.id}"
      ondragstart="onDragStart(event,${t.id})"
      ondragend="onDragEnd(event)">
      <div class="kanban-card-top">
        <div class="kanban-card-title">${esc(t.titulo)}</div>
        <button class="kanban-card-del" onclick="deleteTask(${t.id})" title="Remover">✕</button>
      </div>
      ${catHtml}
    </div>`;
  }).join('');
}

function onDragStart(event, id) {
  draggedId = id;
  setTimeout(() => { const el = event.target; if(el) el.classList.add('dragging'); }, 0);
  event.dataTransfer.effectAllowed = 'move';
}
function onDragEnd(event) { event.target.classList.remove('dragging'); }
function onDragOver(event, col) {
  event.preventDefault();
  document.getElementById(col + '-cards').classList.add('drag-over');
}
function onDragLeave(event, col) {
  if (!event.currentTarget.contains(event.relatedTarget))
    document.getElementById(col + '-cards').classList.remove('drag-over');
}
function onDrop(event, col) {
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
  await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
}

function undoComplete() {
  clearTimeout(undoTimer);
  undoTimer = null;
  document.getElementById('undo-banner').classList.remove('show');
  pendingDeleteId = null;
  loadTasks();
}

async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  renderTasks();
  await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
}

function openAddTask() {
  taskSelCatId = null;
  document.getElementById('inp-task-title').value = '';
  buildCsel('task-csel', null, null);
  const dot = document.getElementById('task-csel-dot');
  const txt = document.getElementById('task-csel-text');
  dot.style.display = 'none';
  txt.textContent = '— Escolha uma categoria —';
  txt.classList.add('placeholder');
  document.getElementById('add-task-modal').classList.add('open');
  setTimeout(() => document.getElementById('inp-task-title').focus(), 50);
}

function closeAddTask() {
  document.getElementById('add-task-modal').classList.remove('open');
}

async function saveTask() {
  const titulo = document.getElementById('inp-task-title').value.trim();
  if (!titulo) return;
  await fetch(`${API}/tasks`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ titulo, categoria_id: taskSelCatId ? parseInt(taskSelCatId) : null })
  });
  closeAddTask();
  await loadTasks();
}

document.getElementById('add-task-modal').addEventListener('click', function(e) { if(e.target===this) closeAddTask(); });
document.getElementById('inp-task-title').addEventListener('keydown', e => { if(e.key==='Enter') saveTask(); });

const DIAS_CONFIG = [
  { key: 'segunda',  label: 'Segunda' },
  { key: 'terca',    label: 'Terça'   },
  { key: 'quarta',   label: 'Quarta'  },
  { key: 'quinta',   label: 'Quinta'  },
  { key: 'sexta',    label: 'Sexta'   },
  { key: 'sabado',   label: 'Sábado'  },
  { key: 'domingo',  label: 'Domingo' },
];

async function loadCronograma() {
  try {
    scheduleEntries = await (await fetch(`${API}/schedule`)).json();
    renderCronograma();
  } catch {}
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
          return `<div class="dia-pill" style="background:${bg};border-color:${color}55">
            <div class="pill-dot" style="background:${color}"></div>
            <span class="pill-nome" style="color:${color}">${esc(name)}</span>
            <button class="pill-del" style="color:${color}" onclick="removeScheduleEntry(${e.id})" title="Remover">✕</button>
          </div>`;
        }).join('')
      : `<div class="cronograma-empty">Vazio</div>`;

    return `<div class="dia-col">
      <div class="dia-header"><span class="dia-nome">${label}</span></div>
      <div class="dia-pills">${pillsHtml}</div>
      <button class="dia-add" onclick="openAddSchedule('${key}','${label}')">＋ Matéria</button>
    </div>`;
  }).join('');
}

function openAddSchedule(dia, label) {
  schedDia   = dia;
  schedCatId = null;
  buildCsel('sched-csel', null, null);
  const dot = document.getElementById('sched-csel-dot');
  const txt = document.getElementById('sched-csel-text');
  dot.style.display = 'none';
  txt.textContent   = '— Escolha uma categoria —';
  txt.classList.add('placeholder');
  document.getElementById('add-schedule-title').textContent = `Adicionar em ${label}`;
  document.getElementById('add-schedule-modal').classList.add('open');
}

function closeAddSchedule() {
  document.getElementById('add-schedule-modal').classList.remove('open');
  schedDia = null;
}

async function saveScheduleEntry() {
  if (!schedDia || !schedCatId) return;
  const res = await fetch(`${API}/schedule`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ dia_semana: schedDia, categoria_id: parseInt(schedCatId) })
  });
  if (res.ok) {
    const entry = await res.json();
    scheduleEntries.push(entry);
    renderCronograma();
  }
  closeAddSchedule();
}

async function removeScheduleEntry(id) {
  await fetch(`${API}/schedule/${id}`, { method: 'DELETE' });
  scheduleEntries = scheduleEntries.filter(e => e.id !== id);
  renderCronograma();
}

document.getElementById('add-schedule-modal').addEventListener('click', function(e) {
  if (e.target === this) closeAddSchedule();
});