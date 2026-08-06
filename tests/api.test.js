import test from 'node:test';
import assert from 'node:assert/strict';

const chamadas = [];
globalThis.fetch = async (url, options) => {
  chamadas.push({ url, options });
  return { ok: true, json: async () => ({}) };
};

const { Api } = await import('../src/js/api.js');

test.beforeEach(() => { chamadas.length = 0; });

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
