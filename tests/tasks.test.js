import test from 'node:test';
import assert from 'node:assert/strict';

function fakeEl() {
  return {
    innerHTML: '', textContent: '', style: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){},
  };
}

const elMap = new Map();
global.document = {
  getElementById: (id) => {
    if (!elMap.has(id)) elMap.set(id, fakeEl());
    return elMap.get(id);
  },
  addEventListener(){},
  querySelector(){ return fakeEl(); },
  querySelectorAll(){ return []; },
  createElement(){ return fakeEl(); },
  body: fakeEl(),
};
global.window = { addEventListener(){} };

const TAREFA = { id: 1, titulo: 'Estudar Penal', categoria_id: 5, categoria_nome: 'Direito Penal', categoria_cor: '#e879f9', nota: '' };
const completeCalls = [];
const deleteCalls   = [];

function mockFetch(tarefas) {
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/tasks') && (!options || !options.method)) {
      return { ok: true, json: async () => tarefas.map(t => ({ ...t })) };
    }
    if (url.endsWith('/tasks/complete') && options && options.method === 'POST') {
      completeCalls.push(JSON.parse(options.body).id);
      return { ok: true, json: async () => ({ ...TAREFA, status: 'done' }) };
    }
    if (options && options.method === 'DELETE') {
      deleteCalls.push(url);
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => ({}) };
  };
}

const tasksMod = await import('../src/js/tasks.js');

test('completar uma tarefa faz o card aparecer DE VERDADE na coluna Concluído (não só desaparecer da tela)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  mockFetch([TAREFA]);

  await tasksMod.loadTasks();
  tasksMod.onDragStart({ target: fakeEl(), dataTransfer: {} }, 1);
  tasksMod.onDrop({ preventDefault(){} }, 'done');

  const doneHtml = document.getElementById('done-cards').innerHTML;
  assert.match(doneHtml, /Estudar Penal/, 'o card deveria aparecer no HTML da coluna Concluído imediatamente após arrastar');
  assert.match(doneHtml, /undoComplete\(1\)/, 'o botão de desfazer daquela tarefa específica deveria estar no HTML');

  t.mock.timers.reset();
});

test('completar uma tarefa NÃO marca como concluída na hora — só agenda pra daqui a 4s', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  completeCalls.length = 0;
  mockFetch([TAREFA]);

  await tasksMod.loadTasks();
  tasksMod.onDragStart({ target: fakeEl(), dataTransfer: {} }, 1);
  tasksMod.onDrop({ preventDefault(){} }, 'done');

  assert.equal(completeCalls.length, 0, 'não deveria ter chamado a API de completar ainda');
  t.mock.timers.reset();
});

test('depois de 4s sem desfazer, a tarefa é marcada como concluída (NÃO é apagada)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  completeCalls.length = 0;
  deleteCalls.length = 0;
  mockFetch([TAREFA]);

  await tasksMod.loadTasks();
  tasksMod.onDragStart({ target: fakeEl(), dataTransfer: {} }, 1);
  tasksMod.onDrop({ preventDefault(){} }, 'done');

  t.mock.timers.tick(4000);
  await new Promise(r => setImmediate(r));

  assert.equal(completeCalls.length, 1, 'deveria ter chamado a API de completar depois dos 4s');
  assert.equal(completeCalls[0], 1);
  assert.equal(deleteCalls.length, 0, 'NÃO deveria ter chamado DELETE em nenhum momento — a tarefa não é apagada mais');
  t.mock.timers.reset();
});

test('clicar em Desfazer dentro da janela de 4s CANCELA a conclusão', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  completeCalls.length = 0;
  mockFetch([TAREFA]);

  await tasksMod.loadTasks();
  tasksMod.onDragStart({ target: fakeEl(), dataTransfer: {} }, 1);
  tasksMod.onDrop({ preventDefault(){} }, 'done');

  tasksMod.undoComplete(1);        // desiste de completar antes do tempo acabar
  t.mock.timers.tick(4000);        // avança o tempo mesmo assim
  await new Promise(r => setImmediate(r));

  assert.equal(completeCalls.length, 0, 'NÃO deveria ter chamado a API de completar — foi desfeito');
  t.mock.timers.reset();
});

test('desfazer duas tarefas completadas ao mesmo tempo não interfere uma na outra', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  completeCalls.length = 0;
  mockFetch([{ ...TAREFA, id: 1 }, { ...TAREFA, id: 2, titulo: 'Outra tarefa' }]);

  await tasksMod.loadTasks();
  tasksMod.onDragStart({ target: fakeEl(), dataTransfer: {} }, 1);
  tasksMod.onDrop({ preventDefault(){} }, 'done');
  tasksMod.onDragStart({ target: fakeEl(), dataTransfer: {} }, 2);
  tasksMod.onDrop({ preventDefault(){} }, 'done');

  tasksMod.undoComplete(1);   // só desfaz a primeira

  t.mock.timers.tick(4000);
  await new Promise(r => setImmediate(r));

  assert.equal(completeCalls.length, 1, 'só a tarefa 2 deveria ter sido marcada como concluída');
  assert.equal(completeCalls[0], 2);
  t.mock.timers.reset();
});

test('reopenTask chama a API de reabrir e recarrega a lista de tarefas', async (t) => {
  mockFetch([TAREFA]);
  const reopenCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/tasks/reopen')) {
      reopenCalls.push(JSON.parse(options.body).id);
      return { ok: true, json: async () => ({ ...TAREFA, status: 'todo' }) };
    }
    return originalFetch(url, options);
  };

  await tasksMod.reopenTask(1);
  assert.equal(reopenCalls.length, 1);
  assert.equal(reopenCalls[0], 1);
});

test('concluirTarefa: botão de concluir (alternativa ao arrastar) leva o card pra coluna Concluído', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  mockFetch([TAREFA]);
  await tasksMod.loadTasks();
  tasksMod.concluirTarefa(1);
  assert.match(document.getElementById('done-cards').innerHTML, /Estudar Penal/);
  assert.doesNotMatch(document.getElementById('todo-cards').innerHTML, /Estudar Penal/);
  t.mock.timers.reset();
});

test('card da tarefa tem botão de concluir acessível, sem depender de arrastar', async () => {
  mockFetch([TAREFA]);
  await tasksMod.loadTasks();
  const html = document.getElementById('todo-cards').innerHTML;
  assert.match(html, /aria-label="Concluir tarefa"/);
  assert.match(html, /aria-label="Editar tarefa"/);
  assert.match(html, /aria-label="Excluir tarefa"/);
});
