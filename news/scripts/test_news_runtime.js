'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
  return {
    children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {},
  };
}

const elements = new Map([
  ['#top-rail', element()],
  ['#story-sections', element()],
  ['#reader', element()],
]);
let fetchCalled = false;
const context = {
  console,
  Date,
  Error,
  Intl,
  Map,
  Number,
  URL,
  document: {
    body: element(),
    createElement: element,
    querySelector(selector) { return elements.get(selector) || element(); },
    querySelectorAll() { return []; },
  },
  fetch() {
    fetchCalled = true;
    return new Promise(() => {});
  },
};

const scriptPath = path.join(__dirname, '..', 'assets', 'news.js');
const source = fs.readFileSync(scriptPath, 'utf8');
assert.doesNotThrow(
  () => vm.runInNewContext(source, context, { filename: scriptPath }),
  'Daily Seven JavaScript should initialize without a runtime exception',
);
assert.equal(fetchCalled, true, 'Daily Seven initialization should start loading the edition');
console.log('Daily Seven runtime initialization test passed');
