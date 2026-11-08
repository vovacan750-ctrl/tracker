// Трекер обучения: bento-карточки глав, уроки внутри, тесты.
// Иконки берутся из assets/icons.js (грузится раньше этого файла).

const STATE_KEY = "tracker.state.v1";
const QUIZ_KEY = "tracker.quiz.v1";

const STATUS_TEXT = ["Не начат", "В процессе", "Пройден"];
const CHEV = '<svg class="s-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

let DATA = null;
let state = load(STATE_KEY, {});
let quizResults = load(QUIZ_KEY, {});
let filter = "all";
let query = "";
let currentLesson = 0;
let quiz = null;

const CH_ICONS = (typeof ICONS !== "undefined") ? ICONS : {};
const LS_ICONS = (typeof LESSON_ICONS !== "undefined") ? LESSON_ICONS : {};

/* ---------- хранилище ---------- */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  localStorage.setItem(QUIZ_KEY, JSON.stringify(quizResults));
}

function getLessonState(n) {
  if (!state[n]) state[n] = { s: 0 };
  return state[n];
}

function quizPassed(n) {
  const r = quizResults[n];
  return !!(r && r.perfect);
}

function chapterDone(ci) {
  const ch = DATA.chapters[ci];
  let d = 0;
  for (let n = ch.start; n < ch.start + ch.size; n++) {
    if (getLessonState(n).s === 2) d++;
  }
  return d;
}

function chapterUnlocked(ci) {
  const ch = DATA.chapters[ci];
  for (let n = ch.start; n < ch.start + ch.size; n++) {
    if (getLessonState(n).s !== 2) return false;
    const q = DATA.quizzes[n];
    if (q && q.length && !quizPassed(n)) return false;
  }
  return true;
}

function chapterIndexByLesson(n) {
  for (let i = 0; i < DATA.chapters.length; i++) {
    const ch = DATA.chapters[i];
    if (n >= ch.start && n < ch.start + ch.size) return i;
  }
  return 0;
}

/* ---------- загрузка ---------- */
async function boot() {
  try {
    const [lessons, quizzes, blockQuizzes] = await Promise.all([
      fetch("data/lessons.json").then(r => r.json()),
      fetch("data/quizzes.json").then(r => r.json()),
      fetch("data/block-quizzes.json").then(r => r.json())
    ]);
    DATA = {
      chapters: lessons.chapters,
      lessons: lessons.lessons,
      quizzes: quizzes,
      blockQuizzes: blockQuizzes
    };
    render();
  } catch (e) {
    console.error("Boot error:", e);
    const list = document.getElementById("list");
    if (list) {
      list.innerHTML = '<div class="panel">Не удалось загрузить данные: ' + (e.message || e) + '</div>';
    } else {
      document.body.insertAdjacentHTML("beforeend",
        '<div class="panel" style="margin:20px;padding:16px;background:#2a2f3a;color:#e6e8ec">Не удалось загрузить данные: ' + (e.message || e) + '</div>'
      );
    }
  }
}

/* ---------- рендер ---------- */
function render() {
  renderStats();
  renderChapters();
  bindToolbar();
  bindDropdowns();
  initAppShell();   // drawer, screens, mobile UI
  // По умолчанию — все главы свёрнуты
  document.querySelectorAll(".ch-card").forEach(c => c.classList.add("closed"));
}

/* ============ APP SHELL: drawer, screens, mobile ============ */
let drawerOpen = false;
let currentScreen = "home";

function initAppShell() {
  const hamburger = document.getElementById("hamburger");
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("drawerOverlay");
  const drawerClose = document.getElementById("drawerClose");

  if (!hamburger || !drawer || !overlay) return;
  if (hamburger.dataset.bound) return;
  hamburger.dataset.bound = "1";

  // Открыть/закрыть drawer
  function openDrawer() {
    drawer.classList.add("open");
    overlay.classList.add("open");
    drawerOpen = true;
    renderDrawerStats();
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    drawerOpen = false;
  }
  function toggleDrawer() { drawerOpen ? closeDrawer() : openDrawer(); }

  hamburger.addEventListener("click", toggleDrawer);
  overlay.addEventListener("click", closeDrawer);
  if (drawerClose) drawerClose.addEventListener("click", closeDrawer);

  // Свайп вправо для открытия (с края экрана)
  let touchStartX = 0, touchStartY = 0, swipeStarted = false;
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    swipeStarted = (touchStartX < 30 && !drawerOpen);
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (!swipeStarted && !drawerOpen) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (dy > 60) { swipeStarted = false; return; }
    if (swipeStarted && dx > 80) openDrawer();
    if (drawerOpen && dx < -80) closeDrawer();
    swipeStarted = false;
  }, { passive: true });

  // Чипы фильтров
  document.querySelectorAll(".chip[data-f]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-f]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      filter = chip.dataset.f;
      applyFilter();
    });
  });

  // Поиск
  const search = document.getElementById("search");
  if (search) {
    search.addEventListener("input", (e) => {
      query = e.target.value;
      applyFilter();
    });
  }

  // Кнопки в drawer-actions (3 нижние кнопки)
  document.querySelectorAll(".drawer-action-btn[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      handleDrawerAction(action);
    });
  });

  // Кнопка "О приложении"
  const aboutClose = document.getElementById("aboutClose");
  const aboutBg = document.getElementById("aboutBg");
  if (aboutClose) aboutClose.addEventListener("click", () => aboutBg.classList.remove("show"));
  if (aboutBg) aboutBg.addEventListener("click", (e) => {
    if (e.target === aboutBg) aboutBg.classList.remove("show");
  });

  // Escape закрывает всё
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // Подзаголовок в app-bar
  const sub = document.getElementById("appBarSub");
  if (sub && DATA) {
    sub.textContent = DATA.chapters.length + " глав · " + DATA.lessons.length + " уроков";
  }

  // Первичная отрисовка статистики в drawer
  renderDrawerStats();
}

function switchScreen(name) {
  currentScreen = name;
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const screen = document.getElementById("screen-" + name);
  if (screen) screen.classList.add("active");
  if (name === "stats") renderStatsScreen();
}

function handleDrawerAction(action) {
  if (action === "csv") {
    exportCsv();
  } else if (action === "reset") {
    if (!confirm("Сбросить весь прогресс и результаты тестов?")) return;
    state = {}; quizResults = {}; save(); render();
  } else if (action === "about") {
    const aboutBg = document.getElementById("aboutBg");
    if (aboutBg) aboutBg.classList.add("show");
  }
}

/* ============ INLINE-СТАТИСТИКА В DRAWER ============ */
function renderDrawerStats() {
  if (!DATA) return;
  const body = document.getElementById("drawerBody");
  if (!body) return;

  let done = 0, proc = 0, tests = 0;
  DATA.lessons.forEach((_, i) => {
    const s = getLessonState(i + 1).s;
    if (s === 2) done++;
    if (s === 1) proc++;
    if (quizPassed(i + 1)) tests++;
  });
  const total = DATA.lessons.length;
  const pct = Math.round((done / total) * 1000) / 10;

  // Собираем HTML
  let html = '';

  // Hero-процент
  html += '<div class="drawer-hero">';
  html += '<div class="pct">' + pct + '%</div>';
  html += '<div class="label">Общий прогресс курса</div>';
  html += '<div class="bar"><i style="width:' + pct + '%"></i></div>';
  html += '</div>';

  // 4 карточки
  html += '<div class="drawer-stats-grid">';
  html += '<div class="drawer-stat-card ok"><div class="k">Пройдено</div><div class="v">' + done + '</div></div>';
  html += '<div class="drawer-stat-card proc"><div class="k">В процессе</div><div class="v">' + proc + '</div></div>';
  html += '<div class="drawer-stat-card"><div class="k">Не начато</div><div class="v">' + (total - done - proc) + '</div></div>';
  html += '<div class="drawer-stat-card acc"><div class="k">Тестов сдано</div><div class="v">' + tests + '</div></div>';
  html += '</div>';

  // Список глав
  html += '<div class="drawer-section-title">Прогресс по главам</div>';
  html += DATA.chapters.map((ch, ci) => {
    const d = chapterDone(ci);
    const pr = Math.round((d / ch.size) * 100);
    const name = ch.name.replace(/^Глава\s*\d+\.\s*/, "");
    return '<div class="drawer-chapter-row">' +
      '<div class="rowline">' +
        '<span class="name">' + name + '</span>' +
        '<span class="num">' + d + '/' + ch.size + ' · ' + pr + '%</span>' +
      '</div>' +
      '<div class="bar"><i style="width:' + pr + '%"></i></div>' +
    '</div>';
  }).join("");

  body.innerHTML = html;
}

/* ============ ЭКРАН СТАТИСТИКИ ============ */
function renderStatsScreen() {
  if (!DATA) return;
  let done = 0, proc = 0, tests = 0;
  DATA.lessons.forEach((_, i) => {
    const s = getLessonState(i + 1).s;
    if (s === 2) done++;
    if (s === 1) proc++;
    if (quizPassed(i + 1)) tests++;
  });
  const total = DATA.lessons.length;
  const pct = Math.round((done / total) * 1000) / 10;

  // Hero
  const heroPct = document.getElementById("statHeroPct");
  const heroBar = document.getElementById("statHeroBar");
  if (heroPct) heroPct.textContent = pct + "%";
  if (heroBar) heroBar.style.width = pct + "%";

  // Карточки
  const elDone = document.getElementById("statDone");
  const elProc = document.getElementById("statProc");
  const elNot = document.getElementById("statNotStarted");
  const elTests = document.getElementById("statTests");
  if (elDone) elDone.textContent = done;
  if (elProc) elProc.textContent = proc;
  if (elNot) elNot.textContent = (total - done - proc);
  if (elTests) elTests.textContent = tests;

  // Главы
  const chContainer = document.getElementById("statChapters");
  if (chContainer) {
    chContainer.innerHTML = DATA.chapters.map((ch, ci) => {
      const d = chapterDone(ci);
      const pr = Math.round((d / ch.size) * 100);
      const name = ch.name.replace(/^Глава\s*\d+\.\s*/, "");
      return '<div class="stat-chapter-row">' +
        '<div class="rowline">' +
          '<span class="name">' + name + '</span>' +
          '<span class="num">' + d + '/' + ch.size + ' · ' + pr + '%</span>' +
        '</div>' +
        '<div class="bar"><i style="width:' + pr + '%"></i></div>' +
      '</div>';
    }).join("");
  }
}

function renderStats() {
  let done = 0, proc = 0;
  DATA.lessons.forEach((_, i) => {
    const s = getLessonState(i + 1).s;
    if (s === 2) done++;
    if (s === 1) proc++;
  });
  const total = DATA.lessons.length;
  const pct = Math.round((done / total) * 1000) / 10;

  // Старые элементы статистики — могут отсутствовать в новом UI
  const cards = document.getElementById("cards");
  if (cards) {
    cards.innerHTML =
      '<div class="card ok"><div class="k">Пройдено</div><div class="v">' + done + '</div></div>' +
      '<div class="card proc"><div class="k">В процессе</div><div class="v">' + proc + '</div></div>' +
      '<div class="card"><div class="k">Не начато</div><div class="v">' + (total - done - proc) + '</div></div>' +
      '<div class="card acc"><div class="k">Прогресс</div><div class="v">' + pct + '%</div></div>' +
      '<div class="card"><div class="k">Осталось</div><div class="v">' + (total - done) + '</div></div>';
  }
  const mainBar = document.getElementById("mainBar");
  if (mainBar) mainBar.style.width = pct + "%";
  const pctTxt = document.getElementById("pctTxt");
  if (pctTxt) pctTxt.textContent = done + " из " + total + " · " + pct + "%";

  const chMini = document.getElementById("chMini");
  if (chMini) {
    chMini.innerHTML = DATA.chapters.map((ch, ci) => {
      const d = chapterDone(ci);
      const pr = Math.round((d / ch.size) * 100);
      const num = ch.name.split(".")[0];
      return '<div><div class="rowline" style="margin-bottom:5px">' +
        '<span style="font-size:12.5px;font-weight:600">' + num + '</span>' +
        '<span style="font-size:12px;color:var(--muted);font-weight:700">' + d + "/" + ch.size + '</span>' +
        '</div><div class="bar sm"><i style="width:' + pr + '%"></i></div></div>';
    }).join("");
  }
}

function renderChapters() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  DATA.chapters.forEach((ch, ci) => {
    const card = document.createElement("div");
    card.className = "ch-card";
    card.dataset.ci = ci;
    card.innerHTML =
      '<div class="cc-top">' +
        '<span class="cc-icon">' + (CH_ICONS[ci + 1] || "") + '</span>' +
        '<div class="cc-txt">' +
          '<div class="cc-title">' + ch.name + '</div>' +
          '<div class="cc-meta">' + ch.duration + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cc-prog">' +
        '<div class="cc-bar"><i></i></div>' +
        '<div class="cc-nums"><span class="cc-count"></span><span class="cc-pct"></span></div>' +
      '</div>' +
      '<button class="cc-test"></button>' +
      '<div class="cc-lessons"></div>';

    // Клик по карточке (кроме урока и кнопки) — свернуть/развернуть
    card.addEventListener("click", (e) => {
      if (e.target.closest(".l-card") || e.target.closest(".cc-test") ||
          e.target.closest(".lc-sel")) return;
      closeAllMenus();
      card.classList.toggle("closed");
    });

    card.querySelector(".cc-test").addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.currentTarget.disabled) return;
      startBlockQuiz(ci);
    });

    const grid = card.querySelector(".cc-lessons");
    for (let n = ch.start; n < ch.start + ch.size; n++) {
      const st = getLessonState(n).s;
      const lc = document.createElement("div");
      lc.className = "l-card lc-" + st;
      lc.dataset.n = n;
      lc.dataset.title = DATA.lessons[n - 1].t.toLowerCase();
      lc.dataset.s = st;
      lc.innerHTML =
        '<div class="lc-top">' +
          '<span class="lc-ic">' + (LS_ICONS[st] || "") + '</span>' +
          '<span class="lc-num">' + n + '</span>' +
        '</div>' +
        '<div class="lc-name">' + DATA.lessons[n - 1].t + '</div>' +
        '<div class="lc-sel" data-n="' + n + '">' +
          '<button type="button" class="lc-sel-btn">' +
            '<span class="s-ic">' + (LS_ICONS[st] || "") + '</span>' +
            '<span class="s-txt">' + STATUS_TEXT[st] + '</span>' + CHEV +
          '</button>' +
          '<div class="lc-menu">' +
            [0, 1, 2].map(v =>
              '<button type="button" data-v="' + v + '"' + (v === st ? ' class="on"' : "") + '>' +
              (LS_ICONS[v] || "") + STATUS_TEXT[v] + '</button>'
            ).join("") +
          '</div>' +
        '</div>';
      lc.addEventListener("click", (e) => {
        if (e.target.closest(".lc-sel")) return;
        openLesson(n);
      });
      grid.appendChild(lc);
    }

    list.appendChild(card);
    updateChapterCard(ci);
  });
}

/* ---------- выпадающий список статуса ---------- */
function closeAllMenus() {
  document.querySelectorAll(".lc-sel.open").forEach(s => s.classList.remove("open"));
}

function bindDropdowns() {
  document.querySelectorAll(".lc-sel").forEach(sel => {
    const btn = sel.querySelector(".lc-sel-btn");
    const menu = sel.querySelector(".lc-menu");
    if (!btn || !menu || btn.dataset.bound) return;
    btn.dataset.bound = "1";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = sel.classList.contains("open");
      closeAllMenus();
      if (!wasOpen) sel.classList.add("open");
    });

    menu.querySelectorAll("button").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        setLessonStatus(+sel.dataset.n, +item.dataset.v);
        closeAllMenus();
      });
    });
  });

  // Клик вне списка — закрыть
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".lc-sel")) closeAllMenus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllMenus();
  });
}

function setLessonStatus(n, s) {
  const cur = getLessonState(n).s;
  if (cur === s) return;
  getLessonState(n).s = s;
  save();
  updateLessonCard(n, s);
  updateChapterCard(chapterIndexByLesson(n));
  renderStats();
}

/* Обновляет одну карточку урока — без перерисовки сетки,
   чтобы анимация раскрытия не срабатывала заново. */
function updateLessonCard(n, s) {
  const lc = document.querySelector('.l-card[data-n="' + n + '"]');
  if (!lc) return;
  lc.className = "l-card lc-" + s;
  lc.dataset.s = s;

  const ic = lc.querySelector(".lc-ic");
  if (ic) ic.innerHTML = LS_ICONS[s] || "";
  const bIc = lc.querySelector(".lc-sel-btn .s-ic");
  if (bIc) bIc.innerHTML = LS_ICONS[s] || "";
  const txt = lc.querySelector(".lc-sel-btn .s-txt");
  if (txt) txt.textContent = STATUS_TEXT[s];

  const menu = lc.querySelector(".lc-menu");
  if (menu) {
    menu.querySelectorAll("button").forEach(b => {
      b.classList.toggle("on", +b.dataset.v === s);
    });
  }
}

/* Прогресс, счётчик и доступность теста в карточке главы */
function updateChapterCard(ci) {
  const card = document.querySelector('.ch-card[data-ci="' + ci + '"]');
  if (!card) return;
  const ch = DATA.chapters[ci];
  const d = chapterDone(ci);
  const pct = Math.round((d / ch.size) * 100);
  const unlocked = chapterUnlocked(ci);

  const bar = card.querySelector(".cc-bar > i");
  if (bar) bar.style.width = pct + "%";
  const cnt = card.querySelector(".cc-count");
  if (cnt) cnt.textContent = d + " из " + ch.size + " уроков";
  const p = card.querySelector(".cc-pct");
  if (p) p.innerHTML = "<b>" + pct + "%</b>";

  const btn = card.querySelector(".cc-test");
  if (btn) {
    btn.disabled = !unlocked;
    btn.textContent = unlocked
      ? "Большой тест по главе →"
      : "Пройдите все уроки и их тесты на 100%";
  }
}

/* Перерисовывает все статусы и прогресс, не пересоздавая сетку */
function refreshAllCards() {
  DATA.lessons.forEach((_, i) => updateLessonCard(i + 1, getLessonState(i + 1).s));
  DATA.chapters.forEach((_, ci) => updateChapterCard(ci));
  renderStats();
}

function bindToolbar() {
  // Старые .btn[data-f] могут отсутствовать (теперь .chip), но привязки остались
  document.querySelectorAll(".btn[data-f]").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".btn[data-f]").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      filter = b.dataset.f;
      applyFilter();
    };
  });
  // Поиск привязывается в initAppShell, но оставим запасной вариант
  const search = document.getElementById("search");
  if (search && !search.dataset.bound) {
    search.dataset.bound = "1";
    search.addEventListener("input", (e) => { query = e.target.value; applyFilter(); });
  }
  // Кнопки в старой панели могут отсутствовать — проверяем
  const btnCsv = document.getElementById("btnCsv");
  if (btnCsv) btnCsv.onclick = exportCsv;
  const btnReset = document.getElementById("btnReset");
  if (btnReset) btnReset.onclick = () => {
    if (!confirm("Сбросить весь прогресс и результаты тестов?")) return;
    state = {}; quizResults = {}; save(); render();
  };
  document.getElementById("mClose").onclick = closeLesson;
  document.getElementById("lessonBg").onclick = e => { if (e.target.id === "lessonBg") closeLesson(); };
  document.getElementById("bClose").onclick = closeBlockQuiz;
  document.getElementById("blockBg").onclick = e => { if (e.target.id === "blockBg") closeBlockQuiz(); };
  document.getElementById("mPrev").onclick = () => { if (currentLesson > 1) openLesson(currentLesson - 1); };
  document.getElementById("mNext").onclick = () => { if (currentLesson < DATA.lessons.length) openLesson(currentLesson + 1); };
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeLesson(); closeBlockQuiz(); }
  });
}

function applyFilter() {
  const q = query.trim().toLowerCase();
  const hasFilter = (filter !== "all") || (q.length > 0);

  document.querySelectorAll(".l-card[data-n]").forEach(lc => {
    let ok = true;
    if (filter !== "all" && lc.dataset.s !== filter) ok = false;
    if (q && lc.dataset.title.indexOf(q) === -1) ok = false;
    lc.classList.toggle("hidden", !ok);
  });
  document.querySelectorAll(".ch-card").forEach(card => {
    let any = false;
    card.querySelectorAll(".l-card[data-n]").forEach(lc => {
      if (!lc.classList.contains("hidden")) any = true;
    });
    card.classList.toggle("hidden", !any);
    // При поиске/фильтре — разворачиваем карточки автоматически
    if (any && hasFilter) card.classList.remove("closed");
  });
}

function exportCsv() {
  let csv = "Номер,Глава,Урок,Статус,Тест сдан\n";
  DATA.chapters.forEach(ch => {
    const num = ch.name.replace(/^Глава\s*(\d+)\..*/, "$1");
    for (let n = ch.start; n < ch.start + ch.size; n++) {
      const st = getLessonState(n);
      const q = DATA.quizzes[n] && DATA.quizzes[n].length
        ? (quizPassed(n) ? "да" : "нет") : "—";
      const title = DATA.lessons[n - 1].t.replace(/"/g, '""');
      csv += n + ',"Глава ' + num + '","' + title + '","' +
        ["Не начат", "В процессе", "Пройден"][st.s] + '","' + q + '"\n';
    }
  });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "progress.csv";
  a.click();
}

/* ---------- окно урока ---------- */
function openLesson(n) {
  const d = DATA.lessons[n - 1];
  if (!d) return;
  currentLesson = n;

  const ci = chapterIndexByLesson(n);
  document.getElementById("mCrumb").textContent = DATA.chapters[ci].name;
  document.getElementById("mTitle").textContent = d.t;
  document.getElementById("mGoal").textContent = d.g || "";

  const body = document.getElementById("mBody");
  body.innerHTML = d.c;

  const q = DATA.quizzes[n];
  const passed = quizPassed(n);
  let html = '<div class="qz-launch">';
  if (!q || !q.length) {
    html += '<span class="qz-launch-hint">Тест по этому уроку пока не подготовлен</span>';
  } else if (passed) {
    html += '<span class="qz-ok-badge">✓ Тест по уроку сдан на 100%</span>' +
      '<span class="qz-launch-hint">Можно пройти заново — вопросы перемешаются</span>';
  } else {
    html += '<button class="btn pri" id="btnQuiz">Пройти тест по уроку (' + q.length +
      ' вопросов)</button><span class="qz-launch-hint">проверьте, как усвоили материал</span>';
  }
  html += "</div>";
  body.insertAdjacentHTML("beforeend", html);

  document.getElementById("quizWrap").classList.remove("show");
  document.getElementById("quizWrap").innerHTML = "";
  body.style.display = "block";

  const btn = document.getElementById("btnQuiz");
  if (btn) btn.onclick = () => startLessonQuiz(n);

  document.getElementById("mNum").textContent = "Урок " + n + " из " + DATA.lessons.length;
  document.getElementById("mPrev").style.visibility = n > 1 ? "visible" : "hidden";
  document.getElementById("mNext").style.visibility =
    n < DATA.lessons.length ? "visible" : "hidden";

  const bg = document.getElementById("lessonBg");
  bg.classList.add("show");
  bg.scrollTop = 0;
  document.body.style.overflow = "hidden";
}

function closeLesson() {
  document.getElementById("lessonBg").classList.remove("show");
  document.body.style.overflow = "";
}

function closeBlockQuiz() {
  document.getElementById("blockBg").classList.remove("show");
  document.getElementById("bWrap").innerHTML = "";
  document.body.style.overflow = "";
}

/* ---------- движок теста ---------- */
function shuffle(arr) {
  const r = arr.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = r[i]; r[i] = r[j]; r[j] = t;
  }
  return r;
}

// Перемешивает варианты; правильный ответ едет вместе со своим текстом.
function shuffleQuestions(list) {
  return list.map(q => {
    const order = shuffle(q.a.map((_, i) => i));
    return {
      q: q.q,
      a: order.map(i => q.a[i]),
      c: order.indexOf(q.c)
    };
  });
}

function resetQuiz() {
  quiz = { list: [], idx: 0, ok: 0, bad: 0, answered: false, kind: null, id: 0, onExit: null, restart: null };
}

function renderQuestion(wrapId) {
  const w = document.getElementById(wrapId);
  if (quiz.idx >= quiz.list.length) { renderResult(wrapId); return; }
  const it = quiz.list[quiz.idx];
  let h = '<div class="qz-box"><div class="qz-top">' +
    '<span class="qz-num">Вопрос ' + (quiz.idx + 1) + " из " + quiz.list.length + "</span>" +
    '<button class="qz-exit" data-exit="1">✕ выйти из теста</button></div>' +
    '<div class="qz-bar"><i style="width:' + (quiz.idx / quiz.list.length * 100) + '%"></i></div>' +
    '<div class="qz-q">' + it.q + '</div><div class="qz-opts">';
  it.a.forEach((o, i) => { h += '<button class="qz-opt" data-i="' + i + '">' + o + "</button>"; });
  h += '</div><div class="qz-fb" id="qzFb"></div>' +
    '<div class="qz-actions"><button class="btn pri" id="qzNext" style="display:none">' +
    (quiz.idx + 1 < quiz.list.length ? "Следующий вопрос →" : "Показать результат →") +
    "</button></div></div>";
  w.innerHTML = h;
  w.querySelector("[data-exit]").onclick = quiz.onExit;
  w.querySelectorAll(".qz-opt").forEach(b => {
    b.onclick = () => answer(+b.dataset.i);
  });
  document.getElementById("qzNext").onclick = () => {
    quiz.idx++; quiz.answered = false; renderQuestion(wrapId);
  };
}

function answer(i) {
  if (quiz.answered) return;
  quiz.answered = true;
  const it = quiz.list[quiz.idx];
  const good = i === it.c;
  if (good) quiz.ok++; else quiz.bad++;
  document.querySelectorAll(".qz-opt").forEach(b => {
    b.disabled = true;
    if (+b.dataset.i === i) b.classList.add(good ? "ok" : "bad");
  });
  document.getElementById("qzFb").innerHTML = good
    ? '<div class="qz-res ok">✓ Правильно!</div>'
    : '<div class="qz-res bad">✗ Неправильно. Перечитайте материал урока и пройдите тест заново.</div>';
  document.getElementById("qzNext").style.display = "inline-block";
}

function renderResult(wrapId) {
  const total = quiz.list.length;
  const pct = Math.round(quiz.ok / total * 100);
  const msg = pct === 100 ? "Отлично! Материал усвоен полностью."
    : pct >= 75 ? "Хорошо! Но есть моменты, которые стоит перечитать."
    : pct >= 50 ? "Неплохо, но рекомендуется перечитать раздел."
    : "Стоит внимательно перечитать материал и пройти тест снова.";

  if (quiz.kind === "lesson") {
    quizResults[quiz.id] = { ok: quiz.ok, total: total, perfect: quiz.ok === total };
    save();
  }

  document.getElementById(wrapId).innerHTML =
    '<div class="qz-box qz-result"><div class="qz-top">' +
    '<span class="qz-num">Результат теста</span>' +
    '<button class="qz-exit" data-exit="1">✕ выйти из теста</button></div>' +
    '<div class="qz-score"><div class="qz-score-num">' + quiz.ok + " / " + total + "</div>" +
    '<div class="qz-score-pct">' + pct + "% правильных ответов</div></div>" +
    '<div class="qz-sum"><span class="ok">Правильно: ' + quiz.ok + "</span>" +
    '<span class="bad">Неправильно: ' + quiz.bad + "</span></div>" +
    '<div class="qz-msg">' + msg + "</div>" +
    '<div class="qz-actions"><button class="btn pri" data-again="1">↻ Пройти тест заново</button>' +
    '<button class="btn" data-exit="1">Вернуться</button></div></div>';

  const w = document.getElementById(wrapId);
  w.querySelectorAll("[data-exit]").forEach(b => { b.onclick = quiz.onExit; });
  w.querySelector("[data-again]").onclick = () => quiz.restart(quiz.id);
  refreshAllCards();
}

function startLessonQuiz(n) {
  const list = DATA.quizzes[n];
  if (!list || !list.length) return;
  resetQuiz();
  quiz.list = shuffleQuestions(list);
  quiz.kind = "lesson";
  quiz.id = n;
  quiz.onExit = () => {
    document.getElementById("quizWrap").classList.remove("show");
    document.getElementById("quizWrap").innerHTML = "";
    document.getElementById("mBody").style.display = "block";
  };
  quiz.restart = startLessonQuiz;
  document.getElementById("mBody").style.display = "none";
  document.getElementById("quizWrap").classList.add("show");
  renderQuestion("quizWrap");
}

function startBlockQuiz(ci) {
  const list = DATA.blockQuizzes[ci + 1];
  if (!list || !list.length) { alert("Большой тест по этой главе пока не готов."); return; }
  resetQuiz();
  quiz.list = shuffleQuestions(list);
  quiz.kind = "block";
  quiz.id = ci + 1;
  quiz.onExit = closeBlockQuiz;
  quiz.restart = startBlockQuiz;
  document.getElementById("bCrumb").textContent = DATA.chapters[ci].name;
  document.getElementById("bTitle").textContent = "Большой тест по главе";
  document.getElementById("bGoal").textContent =
    list.length + " вопросов по ключевым моментам главы";
  document.getElementById("blockBg").classList.add("show");
  document.getElementById("blockBg").scrollTop = 0;
  document.body.style.overflow = "hidden";
  renderQuestion("bWrap");
}

// Ждём полной загрузки DOM, потом запускаем приложение
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
