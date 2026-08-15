'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element(tagName = '') {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    dataset: {},
    hidden: false,
    style: {},
    textContent: '',
    className: '',
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, force) {
        if (force === undefined ? !classes.has(name) : force) classes.add(name);
        else classes.delete(name);
      },
      contains(name) { return classes.has(name); },
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    click() {
      for (const listener of listeners.get('click') || []) listener({ target: this });
    },
  };
}

const filters = ['All', 'Politics', 'Tech', 'Sports'];
const topicButtons = filters.map((filter, index) => {
  const button = element('button');
  button.dataset.filter = filter;
  button.setAttribute('aria-pressed', String(index === 0));
  return button;
});
const leadSection = element('section');
const elements = new Map([
  ['#top-rail', element('div')],
  ['#story-sections', element('div')],
  ['#reader', element('dialog')],
  ['.lead-section', leadSection],
]);
const byId = [
  '#reader-kicker', '#reader-title', '#reader-byline', '#reader-copy',
  '#reader-labels', '#reader-disclosure', '#reader-source', '#refresh-time',
  '#dateline', '.no-script',
];
for (const selector of byId) elements.set(selector, element());

const topStories = Array.from({ length: 7 }, (_, index) => ({
  id: `top-${index}`,
  title: `Top story ${index}`,
  summary: 'Top summary',
  source: 'Test source',
  published: '2026-08-15T12:00:00Z',
  region: 'World',
  category: filters[(index % 3) + 1],
  labels: [],
  url: 'https://example.com/top',
  contentStatus: 'Summary',
}));
const sectionStories = filters.slice(1).map(category => ({
  id: `section-${category}`,
  title: `${category} section story`,
  summary: `${category} summary`,
  source: 'Test source',
  published: '2026-08-15T12:00:00Z',
  region: 'World',
  category,
  labels: [category],
  url: `https://example.com/${category.toLowerCase()}`,
  contentStatus: 'Summary',
}));
const edition = {
  generatedAt: '2026-08-15T12:00:00Z',
  topStoryIds: topStories.map(story => story.id),
  stories: [...topStories, ...sectionStories],
};
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
    body: element('body'),
    createElement: name => element(name),
    querySelector(selector) { return elements.get(selector) || element(); },
    querySelectorAll(selector) { return selector === '.topic' ? topicButtons : []; },
  },
  fetch() {
    fetchCalled = true;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(edition) });
  },
};

function renderedCategories() {
  return elements.get('#story-sections').children
    .filter(child => child.className === 'news-section')
    .map(section => section.children[0].textContent);
}

async function run() {
  const scriptPath = path.join(__dirname, '..', 'assets', 'news.js');
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.doesNotThrow(
    () => vm.runInNewContext(source, context, { filename: scriptPath }),
    'Daily Seven JavaScript should initialize without a runtime exception',
  );
  assert.equal(fetchCalled, true, 'Daily Seven initialization should start loading the edition');
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(leadSection.hidden, false, 'Today initially shows the complete Top 7 lead section');
  assert.deepEqual(renderedCategories(), ['Politics', 'Tech', 'Sports'], 'Today initially renders every general section');

  for (const category of filters.slice(1)) {
    topicButtons.find(button => button.dataset.filter === category).click();
    assert.equal(leadSection.hidden, true, `${category} hides the complete Top 7 lead section`);
    assert.deepEqual(renderedCategories(), [category], `${category} renders only its chosen section`);
    for (const button of topicButtons) {
      assert.equal(button.getAttribute('aria-pressed'), String(button.dataset.filter === category), 'aria-pressed identifies the selected filter');
    }
  }

  topicButtons[0].click();
  assert.equal(leadSection.hidden, false, 'Today restores the complete Top 7 lead section');
  assert.deepEqual(renderedCategories(), ['Politics', 'Tech', 'Sports'], 'Today restores every general section');
  assert.equal(topicButtons[0].getAttribute('aria-pressed'), 'true', 'Today is exposed as selected after restoration');
  console.log('Daily Seven section filter runtime regression test passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
