(() => {
  'use strict';
  const state = { data: null, filter: 'All' };
  const $ = selector => document.querySelector(selector);
  const rail = $('#top-rail');
  const leadSection = $('.lead-section');
  const latestSection = $('.latest-section');
  const sections = $('#story-sections');
  const reader = $('#reader');
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  function safeDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? 'Publication time unavailable' : formatter.format(date);
  }
  function el(name, className, text) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function meta(story) { return `${story.source} · ${safeDate(story.published)} · ${story.region}`; }
  function safeSourceUrl(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function safeImageUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') ? url.href : '';
    } catch (_) { return ''; }
  }
  function openReader(story) {
    $('#reader-kicker').textContent = `${story.category} · ${story.region}`;
    $('#reader-title').textContent = story.title;
    $('#reader-byline').textContent = meta(story);
    const copy = $('#reader-copy'); copy.replaceChildren(el('p', '', story.summary));
    const storyLabels = Array.isArray(story.labels) ? story.labels : [story.category, story.region];
    const labels = $('#reader-labels'); labels.replaceChildren(...storyLabels.map(label => el('span', '', label)));
    $('#reader-disclosure').textContent = `${story.contentStatus}. This reader never fabricates missing article text or embeds a publisher page.`;
    const source = $('#reader-source');
    const sourceUrl = safeSourceUrl(story.url);
    source.hidden = !sourceUrl;
    if (sourceUrl) source.href = sourceUrl;
    source.setAttribute('aria-label', `Optional: continue reading ${story.title} at ${story.source} (opens new tab)`);
    if (typeof reader.showModal === 'function') reader.showModal(); else reader.setAttribute('open', '');
    document.body.classList.add('reader-open');
  }
  reader.addEventListener('close', () => document.body.classList.remove('reader-open'));
  reader.addEventListener('click', event => { if (event.target === reader) reader.close(); });

  function storyButton(story, compact = false) {
    const button = el('button', compact ? '' : 'read-button', compact ? story.title : 'Read in app');
    button.type = 'button'; button.addEventListener('click', () => openReader(story));
    return button;
  }
  function renderTop(stories) {
    rail.replaceChildren();
    stories.forEach((story, index) => {
      const card = el('article', 'story-card');
      const frame = el('div', 'story-image-frame');
      const image = el('img', 'story-image');
      image.src = safeImageUrl(story.imageUrl); image.alt = ''; image.width = 640; image.height = 360;
      image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
      const unavailable = el('p', 'image-status', 'Publisher image unavailable'); unavailable.hidden = true;
      image.addEventListener('error', () => {
        image.hidden = true; unavailable.hidden = false; card.classList.add('image-unavailable');
      });
      frame.append(image, unavailable);
      card.append(frame, el('p', 'card-number', String(index + 1).padStart(2, '0')),
        el('p', 'story-meta', meta(story)), el('h3', '', story.title), el('p', 'dek', story.summary), storyButton(story));
      rail.append(card);
    });
    rail.setAttribute('aria-busy', 'false');
  }
  function renderSections(stories) {
    sections.replaceChildren();
    const categories = state.filter === 'All' ? [] : [state.filter];
    categories.forEach(category => {
      const categoryStories = stories.filter(story => story.category === category)
        .sort((a, b) => Number(Boolean(b.focus)) - Number(Boolean(a.focus))).slice(0, 12);
      if (!categoryStories.length) return;
      const wrapper = el('section', 'news-section');
      wrapper.append(el('h3', 'news-section-title', category));
      const list = el('div', 'story-list');
      categoryStories.forEach(story => {
        const item = el('article', 'list-story');
        const title = el('h3'); title.append(storyButton(story, true));
        item.append(el('p', 'story-meta', meta(story)), title, el('p', 'labels', (story.labels || []).join(' · ')));
        list.append(item);
      });
      wrapper.append(list); sections.append(wrapper);
    });
    if (state.filter !== 'All' && !sections.children.length) {
      sections.append(el('p', 'empty-state', 'No stories are available in this section. The next refresh will try again.'));
    }
  }
  function applyFilter(filter) {
    state.filter = filter;
    leadSection.hidden = filter !== 'All';
    latestSection.hidden = filter === 'All';
    latestSection.setAttribute('aria-hidden', String(filter === 'All'));
    document.querySelectorAll('.topic').forEach(button => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    renderSections(state.data.stories);
  }
  document.querySelectorAll('.topic').forEach(button => button.addEventListener('click', () => applyFilter(button.dataset.filter)));

  async function load() {
    try {
      const response = await fetch('data/news.json', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.stories) || !Array.isArray(data.topStoryIds) || data.topStoryIds.length !== 7) throw new Error('Invalid edition');
      state.data = data;
      const byId = new Map(data.stories.map(story => [story.id, story]));
      const top = data.topStoryIds.map(id => byId.get(id)).filter(Boolean);
      if (top.length !== 7 || top.some(story => story.category === 'Sports' || !safeImageUrl(story.imageUrl))) throw new Error('Incomplete Top 7');
      renderTop(top); applyFilter('All');
      $('#refresh-time').textContent = `Updated ${safeDate(data.generatedAt)}`;
      $('#dateline').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(data.generatedAt));
    } catch (error) {
      rail.replaceChildren(el('p', 'empty-state', 'Today’s live edition could not load. The checked-in Top 7 remains below.'));
      rail.setAttribute('aria-busy', 'false');
      document.querySelector('.no-script').style.display = 'block';
    }
  }
  load();
})();
