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
    tagName: tagName.toUpperCase(), children: [], dataset: {}, hidden: false, style: {},
    textContent: '', className: '',
    classList: {
      add(name) { classes.add(name); }, remove(name) { classes.delete(name); },
      toggle(name, force) { if (force === undefined ? !classes.has(name) : force) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    click() { for (const listener of listeners.get('click') || []) listener({ target: this }); },
    dispatch(type) { for (const listener of listeners.get(type) || []) listener({ target: this }); },
  };
}

const filters = ['All', 'Politics', 'Tech', 'Economics', 'Sports'];
const topicButtons = filters.map((filter, index) => {
  const button = element('button'); button.dataset.filter = filter;
  button.setAttribute('aria-pressed', String(index === 0)); return button;
});
const leadSection = element('section');
const latestSection = element('section');
const elements = new Map([
  ['#top-rail', element('div')], ['#story-sections', element('div')], ['#reader', element('dialog')],
  ['.lead-section', leadSection], ['.latest-section', latestSection],
]);
for (const selector of ['#reader-kicker', '#reader-title', '#reader-byline', '#reader-copy', '#reader-labels',
  '#reader-disclosure', '#reader-source', '#refresh-time', '#dateline', '.no-script']) elements.set(selector, element());

const topStories = Array.from({ length: 7 }, (_, index) => ({
  id: `top-${index}`, title: `Top story ${index}`, summary: `Top summary ${index}`, source: 'Test source',
  published: '2026-08-15T12:00:00Z', region: 'World', category: filters[(index % 3) + 1], labels: [],
  url: 'https://example.com/top', imageUrl: `https://images.example.com/${index}.jpg`,
  imageWidth: 1200, imageHeight: 675, contentStatus: 'Summary',
}));
const sectionStories = filters.slice(1).map(category => ({
  id: `section-${category}`, title: `${category} section story`, summary: `${category} summary`, source: 'Test source',
  published: '2026-08-15T12:00:00Z', region: 'World', category, labels: [category],
  url: `https://example.com/${category.toLowerCase()}`,
  imageUrl: category === 'Economics' ? 'https://images.example.com/section.jpg' :
    category === 'Tech' ? 'https://user:secret@images.example.com/private.jpg' :
      category === 'Sports' ? 'http://images.example.com/insecure.jpg' : '',
  contentStatus: 'Summary',
}));
sectionStories.push({
  ...sectionStories[0], id: 'section-odd-port', title: 'Odd port section story', summary: 'Odd port summary',
  imageUrl: 'https://images.example.com:8443/odd-port.jpg',
});
const edition = { schemaVersion: 2, generatedAt: '2026-08-15T12:00:00Z', topStoryIds: topStories.map(story => story.id), stories: [...topStories, ...sectionStories] };
let fetchCalled = false;
const context = {
  console, Date, Error, Intl, Map, Number, URL,
  document: {
    body: element('body'), createElement: name => element(name),
    querySelector(selector) { return elements.get(selector) || element(); },
    querySelectorAll(selector) { return selector === '.topic' ? topicButtons : []; },
  },
  fetch() { fetchCalled = true; return Promise.resolve({ ok: true, json: () => Promise.resolve(edition) }); },
};

function renderedCategories() {
  return elements.get('#story-sections').children.filter(child => child.className === 'news-section').map(section => section.children[0].textContent);
}

function openSectionStory(category, title = `${category} section story`) {
  topicButtons.find(button => button.dataset.filter === category).click();
  const section = elements.get('#story-sections').children[0];
  const item = section.children[1].children.find(story =>
    story.children[1].children[0].textContent === title);
  item.children[1].children[0].click();
}

async function run() {
  const scriptPath = process.env.NEWS_JS_PATH || path.join(__dirname, '..', 'assets', 'news.js');
  assert.doesNotThrow(() => vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), context, { filename: scriptPath }));
  assert.equal(fetchCalled, true, 'initialization starts loading');
  await new Promise(resolve => setImmediate(resolve));

  const cards = elements.get('#top-rail').children;
  assert.equal(cards.length, 7, 'Today renders exactly seven cards');
  assert.equal(cards.filter(card => card.children[0].children.filter(child => child.tagName === 'IMG').length === 1).length, 7, 'every card renders one image');
  assert.equal(leadSection.hidden, false, 'Today shows Top 7');
  assert.equal(latestSection.hidden, true, 'Today hides latest container');
  assert.equal(latestSection.getAttribute('aria-hidden'), 'true', 'Today removes latest from accessibility tree');
  assert.deepEqual(renderedCategories(), [], 'Today does not render section lists');

  const first = cards[0];
  const firstImage = first.children[0].children.find(child => child.tagName === 'IMG');
  firstImage.dispatch('error');
  assert.equal(first.classList.contains('image-unavailable'), true, 'failed image marks unavailable');
  assert.equal(firstImage.hidden, true, 'failed image is hidden');
  assert.ok(first.children.some(child => child.textContent === 'Top story 0'), 'image error preserves story text');

  for (const category of filters.slice(1)) {
    topicButtons.find(button => button.dataset.filter === category).click();
    assert.equal(leadSection.hidden, true, `${category} hides Top 7`);
    assert.equal(latestSection.hidden, false, `${category} shows latest`);
    assert.equal(latestSection.getAttribute('aria-hidden'), 'false', `${category} exposes latest accessibly`);
    assert.deepEqual(renderedCategories(), [category], `${category} renders only itself`);
  }

  openSectionStory('Economics');
  const copy = elements.get('#reader-copy');
  assert.equal(copy.children[0].tagName, 'FIGURE', 'reader image is before summary text');
  assert.equal(copy.children[1].tagName, 'P');
  assert.equal(copy.children[1].textContent, 'Economics summary');
  const readerFigure = copy.children[0];
  const readerImage = readerFigure.children[0];
  const readerStatus = readerFigure.children[1];
  assert.equal(readerImage.tagName, 'IMG');
  assert.equal(readerImage.src, 'https://images.example.com/section.jpg');
  assert.equal(readerImage.alt, '', 'adjacent title makes reader image decorative');
  assert.equal(readerImage.width, 640); assert.equal(readerImage.height, 360);
  assert.equal(readerImage.loading, 'lazy'); assert.equal(readerImage.decoding, 'async');
  assert.equal(readerImage.referrerPolicy, 'no-referrer');
  assert.equal(readerStatus.tagName, 'FIGCAPTION'); assert.equal(readerStatus.hidden, true);

  readerImage.dispatch('error');
  assert.equal(readerImage.hidden, true, 'failed reader image is hidden');
  assert.equal(readerStatus.hidden, false, 'failed reader image gets an honest status');
  assert.equal(readerStatus.textContent, 'Publisher image unavailable');
  assert.equal(elements.get('#reader-title').textContent, 'Economics section story', 'image error preserves reader title');
  assert.equal(copy.children[1].textContent, 'Economics summary', 'image error preserves summary');

  for (const category of ['Politics', 'Tech', 'Sports']) {
    openSectionStory(category);
    assert.equal(elements.get('#reader-copy').children.some(child => child.tagName === 'FIGURE'), false,
      `${category} missing or unsafe image creates no reader figure`);
    assert.equal(elements.get('#reader-copy').children[0].textContent, `${category} summary`, `${category} summary remains`);
  }
  openSectionStory('Politics', 'Odd port section story');
  assert.equal(elements.get('#reader-copy').children.some(child => child.tagName === 'FIGURE'), false,
    'odd-port image creates no reader figure');
  assert.equal(elements.get('#reader-copy').children[0].textContent, 'Odd port summary');
  topicButtons[0].click();
  assert.equal(leadSection.hidden, false); assert.equal(latestSection.hidden, true);
  assert.deepEqual(renderedCategories(), [], 'Today restores only the seven');
  console.log('Daily Seven Today/images/section runtime regression test passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
