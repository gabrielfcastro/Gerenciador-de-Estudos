// ── Camada de acesso à API ────────────────────────────────────────────────────
// Nenhum outro módulo deve chamar fetch() diretamente — tudo passa por aqui.
// Isso centraliza a URL base e deixa os módulos de UI livres de detalhes HTTP.

const API_BASE = 'http://localhost:8000/api';

function request(path, options) {
  return fetch(`${API_BASE}${path}`, options);
}

function withJson(payload) {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

export const Api = {
  // ── configurações ──
  getSettings:  () => request('/settings').then(r => r.json()),
  saveSettings: (blockDuration) => request('/settings', {
    method: 'PUT', ...withJson({ block_duration: blockDuration }),
  }),

  // ── categorias ──
  getCategories:   () => request('/categories').then(r => r.json()),
  createCategory:  (name, color) => request('/categories', { method: 'POST', ...withJson({ name, color }) }),
  updateCategory:  (id, name, color) => request(`/categories/${id}`, { method: 'PUT', ...withJson({ name, color }) }),
  deleteCategory:  (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // ── sessões ──
  getSessions:   (period) => request(`/sessions?period=${period}`).then(r => r.json()),
  startSession:  (categoryId, note) => request('/sessions/start', {
    method: 'POST', ...withJson({ category_id: categoryId, note }),
  }).then(r => r.json()),
  stopSession:   (sessionId, durationSeconds) => request('/sessions/stop', {
    method: 'POST', ...withJson({ session_id: sessionId, duration_seconds: durationSeconds }),
  }),
  updateSession: (id, payload) => request(`/sessions/${id}`, { method: 'PUT', ...withJson(payload) }),
  deleteSession: (id) => request(`/sessions/${id}`, { method: 'DELETE' }),
  getChart:      (period) => request(`/chart?period=${period}`).then(r => r.json()),
  getStats:      (period) => request(`/stats?period=${period}`).then(r => r.json()),

  // ── tarefas ──
  getTasks:     () => request('/tasks').then(r => r.json()),
  createTask:   (titulo, categoriaId, nota = '') => request('/tasks', {
    method: 'POST', ...withJson({ titulo, categoria_id: categoriaId, nota }),
  }),
  updateTask:   (id, titulo, categoriaId, nota = '') => request(`/tasks/${id}`, {
    method: 'PUT', ...withJson({ titulo, categoria_id: categoriaId, nota }),
  }),
  deleteTask:   (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // ── cronograma ──
  getSchedule:         () => request('/schedule').then(r => r.json()),
  createScheduleEntry: (diaSemana, categoriaId) => request('/schedule', {
    method: 'POST', ...withJson({ dia_semana: diaSemana, categoria_id: categoriaId }),
  }),
  moveScheduleEntry:   (id, diaSemana) => request(`/schedule/${id}`, {
    method: 'PUT', ...withJson({ dia_semana: diaSemana }),
  }),
  deleteScheduleEntry: (id) => request(`/schedule/${id}`, { method: 'DELETE' }),
};