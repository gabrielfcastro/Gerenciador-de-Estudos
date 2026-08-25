// ── Verificador do frontend ───────────────────────────────────────────────
// Simula o que o navegador faz ao carregar main.js: resolve todos os
// imports/exports entre os arquivos JS. Se algum arquivo pede uma função
// que outro não exporta (o erro clássico "doesn't provide an export named"),
// isso aparece aqui, no terminal, sem precisar abrir o navegador.
//
// COMO USAR:
//   1. Copie este arquivo pra dentro de src/js/ (junto com main.js, api.js, etc)
//   2. Sempre que substituir algum .js, rode ANTES de abrir o navegador:
//        node verificar_frontend.js
//   3. Se aparecer "✅ Tudo certo", pode abrir o navegador tranquilo.
//      Se aparecer "❌", ele já te diz exatamente qual arquivo e qual
//      função está causando o problema — geralmente é só substituir
//      esse arquivo específico de novo pela versão mais recente.

function elementoFalso() {
  const el = {
    style: {},
    classList: { add(){}, remove(){}, toggle(){}, replace(){}, contains(){ return false; } },
    dataset: {},
    disabled: false,
    addEventListener(){}, removeEventListener(){},
    appendChild(){}, remove(){},
    querySelector(){ return elementoFalso(); },
    querySelectorAll(){ return []; },
    getContext(){ return {}; },
    focus(){}, click(){},
  };
  let _text = '', _value = '', _html = '';
  Object.defineProperty(el, 'textContent', { get: () => _text, set: v => { _text = v; } });
  Object.defineProperty(el, 'value',       { get: () => _value, set: v => { _value = v; } });
  Object.defineProperty(el, 'innerHTML',   { get: () => _html,  set: v => { _html = v; } });
  return el;
}

global.document = {
  addEventListener(){},
  getElementById(){ return elementoFalso(); },
  querySelector(){ return elementoFalso(); },
  querySelectorAll(){ return []; },
  createElement(){ return elementoFalso(); },
  body: elementoFalso(),
};

global.window = {
  addEventListener(){},
  AudioContext: function () { return { createOscillator(){return {connect(){},frequency:{},start(){},stop(){}};}, createGain(){return {connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}};}, destination:{}, currentTime:0 }; },
};
global.webkitAudioContext = global.window.AudioContext;

global.Chart = function () { return { destroy(){} }; };

const caminho = process.argv[2] || './main.js';

console.log(`🔍 Verificando ${caminho} e tudo que ele importa...\n`);

import(caminho)
  .then(() => {
    console.log('✅ Tudo certo — nenhum import/export quebrado. Pode abrir o navegador.');
  })
  .catch(err => {
    console.log('❌ ERRO ENCONTRADO — é isso que travaria o app no navegador:\n');
    console.log('   ' + err.message + '\n');
    console.log('   Dica: o nome do arquivo mencionado no erro acima geralmente');
    console.log('   está desatualizado. Baixe a versão mais recente dele de novo.');
    process.exitCode = 1;
  });