(function () {
  "use strict";

  const Core = window.NorthStarCore;
  const STORAGE_GAME = "north-star-tech-game-v1";
  const STORAGE_SETTINGS = "north-star-tech-settings-v1";
  const STORAGE_WEEKLY = "north-star-tech-weekly-v1";
  const categoryClasses = {
    "AI & Data": "cat-ai", "Fintech & Crypto": "cat-fin", "SaaS & Enterprise": "cat-saas",
    "Consumer & Commerce": "cat-consumer", "Deep Tech & Climate": "cat-deep", "Builders & Breakthroughs": "cat-builders",
    "Frontier & Defence": "cat-frontier"
  };
  let questions = [];
  let weekly = null;
  let state = null;
  let timerHandle = null;
  let secondsLeft = 0;
  let studyFilter = "All";

  const $ = (id) => document.getElementById(id);
  const screens = Array.from(document.querySelectorAll(".screen"));

  function showScreen(id) {
    stopTimer();
    screens.forEach((screen) => screen.classList.toggle("hidden", screen.id !== id));
    window.scrollTo({ top: 0, behavior: "smooth" });
    const heading = $(id).querySelector("h1,h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      requestAnimationFrame(() => heading.focus({ preventScroll: true }));
    }
  }

  function saveGame() {
    if (state && state.mode !== "weekly") localStorage.setItem(STORAGE_GAME, JSON.stringify(state));
    updateResume();
  }

  function updateResume() {
    const restored = Core.restore(localStorage.getItem(STORAGE_GAME), questions);
    $("resume-button").classList.toggle("hidden", !restored || restored.winner !== null);
  }

  function startQuick() {
    state = Core.createState(questions, { mode: "quick", teams: ["Solo"], timer: 0, seed: sessionSeed() });
    Core.nextQuestion(state, questions, "Random");
    saveGame();
    renderQuestion();
  }

  function startWeekly() {
    if (!weekly || weekly.questions.length !== 8) return;
    const deck = Core.shuffle(weekly.questions.map((question) => question.id), weekly.editionDate + ":" + sessionSeed());
    state = {
      version: 1, mode: "weekly", teams: [{ name: "Weekly", score: 0 }], target: 8, timer: 0,
      turn: 0, round: 1, questionId: deck[0], selected: null, revealed: false, expired: false,
      winner: null, weeklyDeck: deck, weeklyPosition: 0
    };
    renderQuestion();
  }

  function sessionSeed() {
    let seed = sessionStorage.getItem("north-star-session-seed");
    if (!seed) {
      seed = String(Date.now()) + ":" + Math.random().toString(36).slice(2);
      sessionStorage.setItem("north-star-session-seed", seed);
    }
    return seed;
  }

  function addTeamField(name) {
    const fields = $("team-fields");
    if (fields.children.length >= 6) return;
    const row = document.createElement("div");
    row.className = "team-row";
    const number = fields.children.length + 1;
    row.innerHTML = '<span aria-hidden="true">' + number + '</span><input required maxlength="24" aria-label="Team ' + number + ' name" placeholder="Team ' + number + '" value="' + escapeAttribute(name || "") + '"><button type="button" class="remove-team" aria-label="Remove team ' + number + '">×</button>';
    row.querySelector(".remove-team").addEventListener("click", () => {
      if (fields.children.length > 2) { row.remove(); renumberTeams(); }
    });
    fields.appendChild(row);
  }

  function renumberTeams() {
    Array.from($("team-fields").children).forEach((row, index) => {
      row.firstElementChild.textContent = index + 1;
      const input = row.querySelector("input");
      input.setAttribute("aria-label", "Team " + (index + 1) + " name");
      input.placeholder = "Team " + (index + 1);
    });
  }

  function escapeAttribute(value) {
    return String(value).replace(/[&"<>]/g, (char) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[char]));
  }

  function openSetup() {
    const settings = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || "{}");
    $("team-fields").textContent = "";
    (settings.teams || ["Aurora", "Northbound"]).forEach(addTeamField);
    $("target-score").value = String(settings.target || 5);
    $("timer-setting").value = String(settings.timer === undefined ? 45 : settings.timer);
    showScreen("setup-screen");
  }

  function createTeamGame(event) {
    event.preventDefault();
    const teams = Array.from($("team-fields").querySelectorAll("input")).map((input) => input.value.trim()).filter(Boolean);
    if (teams.length < 2) return;
    const config = { teams, target: Number($("target-score").value), timer: Number($("timer-setting").value) };
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(config));
    state = Core.createState(questions, { ...config, mode: "team", seed: sessionSeed() + ":" + Date.now() });
    saveGame();
    renderCategory();
  }

  function renderScores() {
    $("scoreboard").textContent = "";
    state.teams.forEach((team, index) => {
      const chip = document.createElement("div");
      chip.className = "score-chip" + (index === state.turn ? " active" : "");
      chip.innerHTML = "<strong></strong><span></span>";
      chip.querySelector("strong").textContent = team.name;
      chip.querySelector("span").textContent = team.score + " / " + state.target + " points";
      $("scoreboard").appendChild(chip);
    });
  }

  function renderCategory() {
    $("round-label").textContent = "Round " + state.round;
    $("turn-label").textContent = state.teams[state.turn].name + ", you’re up.";
    renderScores();
    const grid = $("category-grid");
    grid.textContent = "";
    ["Random"].concat(Core.CATEGORIES).forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-button " + (category === "Random" ? "cat-ai" : categoryClasses[category]);
      button.innerHTML = "<small></small><span></span>";
      button.querySelector("small").textContent = category === "Random" ? "Surprise me" : "Choose category";
      button.querySelector("span").textContent = category === "Random" ? "Random ✦" : category;
      button.addEventListener("click", () => {
        Core.nextQuestion(state, questions, category);
        saveGame();
        renderQuestion();
      });
      grid.appendChild(button);
    });
    showScreen("category-screen");
  }

  function activeQuestions() { return state && state.mode === "weekly" ? weekly.questions : questions; }

  function currentQuestion() { return activeQuestions().find((question) => question.id === state.questionId); }

  function renderQuestion() {
    const question = currentQuestion();
    if (!question) return renderCategory();
    const category = $("question-category");
    category.textContent = state.mode === "weekly" ? "Weekly · " + question.topic : question.category;
    category.className = "category-chip " + (state.mode === "weekly" ? "cat-weekly" : categoryClasses[question.category]);
    $("question-progress").textContent = state.mode === "team" ? state.teams[state.turn].name + " · Round " + state.round : state.mode === "weekly" ? "Question " + state.round + " of " + weekly.questionCount + " · " + weekly.editionRange : "Question " + state.round;
    $("company-label").textContent = question.company;
    $("difficulty-label").textContent = state.mode === "weekly" ? "Published " + question.eventDate : "Difficulty " + "●".repeat(question.difficulty) + "○".repeat(3 - question.difficulty);
    $("question-text").textContent = question.question;
    const answers = $("answers");
    answers.textContent = "";
    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", state.selected === index ? "true" : "false");
      button.textContent = String.fromCharCode(65 + index) + ".  " + option;
      button.addEventListener("click", () => selectAnswer(index));
      answers.appendChild(button);
    });
    $("result").classList.add("hidden");
    $("result").textContent = "";
    $("submit-answer").classList.remove("hidden");
    $("submit-answer").disabled = state.selected === null;
    if (state.revealed) revealResult(false);
    showScreen("question-screen");
    if (!state.revealed) startTimer();
  }

  function selectAnswer(index) {
    if (!Core.selectAnswer(state, index)) return;
    Array.from($("answers").children).forEach((button, buttonIndex) => {
      button.classList.toggle("selected", buttonIndex === index);
      button.setAttribute("aria-checked", buttonIndex === index ? "true" : "false");
    });
    $("submit-answer").disabled = false;
    saveGame();
  }

  function submitAnswer(expired) {
    const correct = Core.submitAnswer(state, activeQuestions(), expired);
    if (correct && state.mode === "weekly") state.teams[0].score += 1;
    saveGame();
    revealResult(correct);
  }

  function revealResult(correct) {
    stopTimer();
    const question = currentQuestion();
    Array.from($("answers").children).forEach((button, index) => {
      button.disabled = true;
      button.classList.remove("selected");
      if (index === question.answer) button.classList.add("correct");
      else if (index === state.selected && !correct) button.classList.add("wrong");
    });
    $("submit-answer").classList.add("hidden");
    const result = $("result");
    result.classList.remove("hidden");
    result.innerHTML = "<h3></h3><p class=explanation></p><p class=asof></p><a class=source target=_blank rel=\"noopener noreferrer\"></a><button class=\"primary wide next-button\" type=button></button>";
    const wasCorrect = state.selected === question.answer && !state.expired;
    result.querySelector("h3").textContent = state.expired ? "Time’s up" : wasCorrect ? "That points north!" : "Not this time";
    result.querySelector(".explanation").textContent = question.explanation;
    result.querySelector(".asof").textContent = "Fact checked as of " + question.asOf + ".";
    const source = result.querySelector(".source");
    source.href = question.sourceUrl;
    source.textContent = "View source: " + question.sourceLabel + " ↗";
    const next = result.querySelector(".next-button");
    const weeklyDone = state.mode === "weekly" && state.weeklyPosition === state.weeklyDeck.length - 1;
    next.textContent = state.winner !== null ? "See the winner" : weeklyDone ? "See weekly result" : state.mode === "team" ? "Pass to next team" : "Next question";
    next.addEventListener("click", advance);
    $("live-region").textContent = result.querySelector("h3").textContent + ". " + question.explanation;
    result.focus?.();
  }

  function advance() {
    if (state.winner !== null) return renderWinner();
    if (state.mode === "weekly") {
      if (state.weeklyPosition >= state.weeklyDeck.length - 1) { state.winner = 0; return renderWinner(); }
      state.weeklyPosition += 1;
      state.round = state.weeklyPosition + 1;
      state.questionId = state.weeklyDeck[state.weeklyPosition];
      state.selected = null;
      state.revealed = false;
      state.expired = false;
      return renderQuestion();
    }
    Core.advanceTurn(state);
    saveGame();
    if (state.mode === "team") renderCategory();
    else { Core.nextQuestion(state, questions, "Random"); saveGame(); renderQuestion(); }
  }

  function startTimer() {
    stopTimer();
    const timer = $("timer");
    if (!state.timer) { timer.textContent = "No timer"; timer.classList.remove("urgent"); return; }
    secondsLeft = state.timer;
    timer.textContent = secondsLeft + "s";
    timerHandle = window.setInterval(() => {
      secondsLeft -= 1;
      timer.textContent = secondsLeft + "s";
      timer.classList.toggle("urgent", secondsLeft <= 10);
      if (secondsLeft <= 0) submitAnswer(true);
    }, 1000);
  }

  function stopTimer() {
    if (timerHandle) window.clearInterval(timerHandle);
    timerHandle = null;
  }

  function renderWinner() {
    if (state.mode === "weekly") {
      $("winner-title").textContent = state.teams[0].score + " / " + weekly.questionCount + " this week";
      $("winner-copy").textContent = "Edition " + weekly.editionRange + " complete. Rematch this edition or return home.";
      $("final-scores").textContent = "";
      const item = document.createElement("span");
      item.textContent = state.teams[0].score === weekly.questionCount ? "A perfect read on Canadian tech." : "Verified from " + weekly.questionCount + " linked reports.";
      $("final-scores").appendChild(item);
      return showScreen("winner-screen");
    }
    const winner = state.teams[state.winner];
    $("winner-title").textContent = winner.name + " found true north!";
    $("winner-copy").textContent = "First to " + state.target + " points after " + state.round + " rounds.";
    $("final-scores").textContent = "";
    state.teams.slice().sort((a, b) => b.score - a.score).forEach((team) => {
      const item = document.createElement("span"); item.textContent = team.name + " · " + team.score; $("final-scores").appendChild(item);
    });
    localStorage.removeItem(STORAGE_GAME);
    showScreen("winner-screen");
  }

  function renderStudy() {
    const filters = $("study-filters");
    filters.textContent = "";
    ["All"].concat(Core.CATEGORIES).forEach((name) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "filter" + (studyFilter === name ? " active" : ""); button.textContent = name;
      button.addEventListener("click", () => { studyFilter = name; renderStudy(); });
      filters.appendChild(button);
    });
    const selected = questions.filter((question) => studyFilter === "All" || question.category === studyFilter);
    $("study-count").textContent = selected.length + " sourced question" + (selected.length === 1 ? "" : "s");
    const list = $("study-list"); list.textContent = "";
    selected.forEach((question) => {
      const card = document.createElement("article"); card.className = "study-card";
      const summary = document.createElement("div"); summary.className = "study-summary";
      summary.innerHTML = "<div><small></small><strong></strong></div><button type=button class=study-reveal aria-expanded=false>Reveal answer</button>";
      summary.querySelector("small").textContent = question.company + " · " + question.category;
      summary.querySelector("strong").textContent = question.question;
      const detail = document.createElement("div"); detail.className = "study-answer hidden";
      detail.innerHTML = "<strong></strong><p></p><a target=_blank rel=\"noopener noreferrer\"></a>";
      detail.querySelector("strong").textContent = question.options[question.answer];
      detail.querySelector("p").textContent = question.explanation + " As of " + question.asOf + ".";
      detail.querySelector("a").href = question.sourceUrl; detail.querySelector("a").textContent = question.sourceLabel + " ↗";
      const reveal = summary.querySelector("button");
      reveal.addEventListener("click", () => { const open = detail.classList.toggle("hidden"); reveal.setAttribute("aria-expanded", String(!open)); reveal.textContent = open ? "Reveal answer" : "Hide answer"; });
      card.append(summary, detail); list.appendChild(card);
    });
    showScreen("study-screen");
  }

  function resumeGame() {
    state = Core.restore(localStorage.getItem(STORAGE_GAME), questions);
    if (!state) return;
    if (state.winner !== null) renderWinner();
    else if (state.questionId) renderQuestion();
    else if (state.mode === "team") renderCategory();
    else { Core.nextQuestion(state, questions, "Random"); renderQuestion(); }
  }

  function home() {
    const wasWeekly = state && state.mode === "weekly";
    stopTimer(); state = null;
    if (!wasWeekly) localStorage.removeItem(STORAGE_GAME);
    updateResume(); showScreen("home-screen");
  }

  function handleAction(action) {
    if (action === "setup-team") openSetup();
    else if (action === "weekly") startWeekly();
    else if (action === "quick") startQuick();
    else if (action === "study") renderStudy();
    else if (action === "home" || action === "quit") home();
    else if (action === "rematch" && state.mode === "weekly") startWeekly();
    else if (action === "rematch") { const old = state; state = Core.createState(questions, { mode: "team", teams: old.teams.map((team) => team.name), target: old.target, timer: old.timer, seed: sessionSeed() + ":rematch:" + Date.now() }); saveGame(); renderCategory(); }
  }

  function validateWeeklyEdition(edition) {
    const questionKeys = ["id", "topic", "company", "question", "options", "answer", "explanation", "sourceUrl", "sourceLabel", "eventDate", "asOf"];
    if (!edition || edition.schemaVersion !== 1 || edition.questionCount !== 8 || !/^\d{4}-\d{2}-\d{2}$/.test(edition.editionDate) || !edition.editionRange || !edition.generatedAt || !Array.isArray(edition.questions) || edition.questions.length !== 8) return false;
    const ids = new Set();
    return edition.questions.every((question) => {
      const validStrings = questionKeys.filter((key) => !["options", "answer"].includes(key)).every((key) => typeof question[key] === "string" && question[key].trim());
      const validSource = (() => { try { return new URL(question.sourceUrl).protocol === "https:"; } catch (_) { return false; } })();
      const valid = validStrings && question.id.startsWith(edition.editionDate + "-") && !ids.has(question.id) && Array.isArray(question.options) && question.options.length === 4 && new Set(question.options).size === 4 && question.options.every((option) => typeof option === "string" && option.trim()) && Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4 && validSource;
      ids.add(question.id);
      return valid;
    });
  }

  function setWeeklyEdition(edition, fromCache) {
    if (!validateWeeklyEdition(edition)) throw new Error("Weekly edition failed validation");
    weekly = edition;
    const age = Date.now() - new Date(edition.editionDate + "T23:59:59Z").getTime();
    const stale = age > 10 * 24 * 60 * 60 * 1000;
    $("weekly-edition").textContent = edition.editionRange + " · " + edition.questionCount + " questions";
    $("weekly-status").textContent = fromCache ? "Live update unavailable — using the last verified edition." : stale ? "Last updated " + edition.editionDate + " — this edition is older than 10 days." : "Verified edition · updated " + edition.editionDate;
    $("weekly-status").classList.toggle("stale", stale || fromCache);
    $("weekly-start").disabled = false;
  }

  async function loadWeekly() {
    try {
      const response = await fetch("data/weekly-news.json");
      if (!response.ok) throw new Error("Weekly data returned " + response.status);
      const edition = await response.json();
      setWeeklyEdition(edition, false);
      localStorage.setItem(STORAGE_WEEKLY, JSON.stringify(edition));
    } catch (error) {
      console.error(error);
      try { setWeeklyEdition(JSON.parse(localStorage.getItem(STORAGE_WEEKLY)), true); }
      catch (_) {
        $("weekly-edition").textContent = "The weekly edition is temporarily unavailable.";
        $("weekly-status").textContent = "No verified cached edition is available.";
      }
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => { const action = event.target.closest("[data-action]"); if (action) handleAction(action.dataset.action); });
    $("add-team").addEventListener("click", () => addTeamField(""));
    $("team-form").addEventListener("submit", createTeamGame);
    $("submit-answer").addEventListener("click", () => submitAnswer(false));
    $("resume-button").addEventListener("click", resumeGame);
    const dialog = $("about-dialog");
    $("about-open").addEventListener("click", () => dialog.showModal());
    dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  }

  async function init() {
    try {
      const response = await fetch("data/questions.json");
      if (!response.ok) throw new Error("Question data returned " + response.status);
      questions = (await response.json()).map((question, index) => {
        const shift = index % 4;
        return {
          ...question,
          options: question.options.slice(shift).concat(question.options.slice(0, shift)),
          answer: (question.answer - shift + 4) % 4
        };
      });
      bindEvents(); updateResume();
      await loadWeekly();
      document.documentElement.dataset.ready = "true";
    } catch (error) {
      console.error(error);
      $("app").innerHTML = '<article class="panel nojs"><h1>We lost the signal.</h1><p>The question deck could not load. Please refresh and try again.</p></article>';
    }
  }

  init();
})();
