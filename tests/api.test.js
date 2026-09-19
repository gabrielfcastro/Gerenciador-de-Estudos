import test from 'node:test';
import assert from 'node:assert/strict';

const chamadas = [];
globalThis.fetch = async (url, options) => {
  chamadas.push({ url, options });
  return { ok: true, json: async () => ({}) };
};

const beaconChamadas = [];
Object.defineProperty(globalThis, 'navigator', {
  value: { sendBeacon: (url, blob) => { beaconChamadas.push({ url, blob }); return true; } },
  writable: true,
  configurable: true,
});

const { Api } = await import('../src/js/api.js');

test.beforeEach(() => { chamadas.length = 0; beaconChamadas.length = 0; });

test('createTask: envia titulo, categoria_id e nota no corpo da requisição', async () => {
  await Api.createTask('Ler capítulo 3', 7, 'Focar nos artigos 5 a 12');

  assert.equal(chamadas.length, 1);
  const { url, options } = chamadas[0];
  assert.equal(url, 'http://localhost:8000/api/tasks');
  assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(options.body), {
    titulo: 'Ler capítulo 3',
    categoria_id: 7,
    nota: 'Focar nos artigos 5 a 12',
  });
});

test('createTask: nota ausente ainda assim é enviada (mesmo vazia)', async () => {
  await Api.createTask('Sem nota', 3, '');
  const { options } = chamadas[0];
  assert.equal(JSON.parse(options.body).nota, '');
});

test('updateTask: chama PUT /api/tasks/:id com titulo, categoria_id e nota', async () => {
  await Api.updateTask(42, 'Título editado', 9, 'nota editada');

  assert.equal(chamadas.length, 1);
  const { url, options } = chamadas[0];
  assert.equal(url, 'http://localhost:8000/api/tasks/42');
  assert.equal(options.method, 'PUT');
  assert.deepEqual(JSON.parse(options.body), {
    titulo: 'Título editado',
    categoria_id: 9,
    nota: 'nota editada',
  });
});

test('getChart: inclui referencia na query string quando fornecida', async () => {
  await Api.getChart('week', null, '2026-07-20');
  assert.equal(chamadas[0].url, 'http://localhost:8000/api/chart?period=week&referencia=2026-07-20');
});

test('getChart: sem referencia, mantém o formato antigo (compatibilidade)', async () => {
  await Api.getChart('week');
  assert.equal(chamadas[0].url, 'http://localhost:8000/api/chart?period=week');
});

test('getStats: inclui referencia na query string quando fornecida', async () => {
  await Api.getStats('month', '2026-06-15');
  assert.equal(chamadas[0].url, 'http://localhost:8000/api/stats?period=month&referencia=2026-06-15');
});

test('getSessions: inclui referencia na query string quando fornecida', async () => {
  await Api.getSessions('today', null, '2026-07-10');
  assert.equal(chamadas[0].url, 'http://localhost:8000/api/sessions?period=today&referencia=2026-07-10');
});

test('createManualSession: envia category_id, started_at, ended_at e note no corpo', async () => {
  await Api.createManualSession(7, '2026-01-01T08:00:00.000Z', '2026-01-01T09:00:00.000Z', 'esqueci o timer');

  assert.equal(chamadas.length, 1);
  const { url, options } = chamadas[0];
  assert.equal(url, 'http://localhost:8000/api/sessions/manual');
  assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(options.body), {
    category_id: 7,
    started_at: '2026-01-01T08:00:00.000Z',
    ended_at:   '2026-01-01T09:00:00.000Z',
    note: 'esqueci o timer',
  });
});

test('createManualSession: categoria nula ainda assim é enviada', async () => {
  await Api.createManualSession(null, '2026-01-01T08:00:00.000Z', '2026-01-01T09:00:00.000Z', '');
  const { options } = chamadas[0];
  assert.equal(JSON.parse(options.body).category_id, null);
});

test('stopSessionBeacon: usa sendBeacon (não fetch) apontando pra /sessions/stop', async () => {
  Api.stopSessionBeacon(42, 1800);

  assert.equal(chamadas.length, 0, 'não deveria ter usado fetch');
  assert.equal(beaconChamadas.length, 1);
  assert.equal(beaconChamadas[0].url, 'http://localhost:8000/api/sessions/stop');
});

test('stopSessionBeacon: envia session_id e duration_seconds no corpo', async () => {
  Api.stopSessionBeacon(42, 1800);

  const blob = beaconChamadas[0].blob;
  const texto = await blob.text();
  assert.deepEqual(JSON.parse(texto), { session_id: 42, duration_seconds: 1800 });
});