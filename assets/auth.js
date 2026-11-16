// assets/auth.js
// Логика входа, регистрации и синхронизации прогресса через Firebase.
// Интегрируется с app.js (трекер обучения): использует те же ключи localStorage
// (tracker.state.v1 и tracker.quiz.v1) и те же глобальные объекты state / quizResults.
//
// Что делает этот файл:
//   1. При первом заходе на сайт (если пользователь не вошёл) — автоматически
//      показывает окно входа/регистрации. Без входа дальше пройти нельзя.
//   2. Добавляет кнопку «Выйти» в верхнюю панель (app-bar).
//   3. После входа подтягивает прогресс из Firestore и объединяет его с локальным.
//   4. Каждый раз, когда app.js сохраняет прогресс локально, — выгружает его в облако
//      именно на аккаунт пользователя (users/{uid}).
//
// Окно входа/регистрации:
//   - Тёмная тема в цветах рабочего пространства сайта (#1d2939 / #3a4150 / #6b73e8)
//   - Полностью непрозрачный фон (курсы за окном не видны)
//   - Две вкладки: «Вход» и «Регистрация»
//   - В регистрации 3 поля: Email, Пароль, Повторите пароль
//   - Нет кнопок «Продолжить без аккаунта» и «Нет аккаунта / Уже есть аккаунт»
//   - Закрыть окно без успешной авторизации нельзя

(function () {
  'use strict';

  // Защита от двойной инициализации
  if (window.__authInitialized) return;
  window.__authInitialized = true;

  // Локальные ключи — должны совпадать с теми, что в app.js
  var STATE_KEY = 'tracker.state.v1';
  var QUIZ_KEY  = 'tracker.quiz.v1';

  // ============================================================
  // 1. Чтение/запись прогресса (работаем через localStorage,
  //    чтобы не зависеть от того, успел ли загрузиться app.js)
  // ============================================================
  function readProgress() {
    try {
      return {
        state: JSON.parse(localStorage.getItem(STATE_KEY) || '{}'),
        quiz:  JSON.parse(localStorage.getItem(QUIZ_KEY)  || '{}')
      };
    } catch (e) {
      return { state: {}, quiz: {} };
    }
  }

  // ============================================================
  // 2. Модальное окно входа/регистрации
  // ============================================================
  var overlay = null;
  var currentMode = 'login';     // 'login' или 'register'

  // Цвета берём из CSS-переменных сайта
  var C = {
    bgOverlay: '#1a1d23',        // полностью непрозрачный фон — курсы не видны
    cardBg:    '#1d2939',        // фон окна (как тёмная карточка на сайте)
    cardBorder:'#3a4150',
    txt:       '#e6e8ec',
    muted:     '#9aa4b4',
    acc:       '#6b73e8',        // акцентный цвет сайта
    accHover:  '#5a61d4',
    inputBg:   '#252a35',
    inputBorder: '#3a4150',
    inputFocus: '#6b73e8',
    errColor:  '#f87171',
    tabActiveBg: '#2a2f3a',
    tabInactiveBg: 'transparent',
    tabInactiveColor: '#9aa4b4'
  };

  function buildModal() {
    overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0',
      'background:' + C.bgOverlay,                       // полностью непрозрачный фон
      'z-index:99999', 'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif',
      'padding:20px'
    ].join(';');

    // Контейнер окна — размер остаётся прежним (max-width:380px)
    var modal = document.createElement('div');
    modal.style.cssText = [
      'background:' + C.cardBg,
      'color:' + C.txt,
      'padding:0',
      'border:1px solid ' + C.cardBorder,
      'border-radius:16px',
      'max-width:380px', 'width:100%',
      'box-shadow:0 24px 70px rgba(0,0,0,0.6)',
      'overflow:hidden'
    ].join(';');

    modal.innerHTML =
      // Логотип/заголовок окна
      '<div style="padding:24px 28px 14px;text-align:center;">' +
        '<div style="width:48px;height:48px;border-radius:12px;' +
          'background:linear-gradient(135deg,#1d2939,#101828);' +
          'border:1px solid rgba(255,255,255,0.12);' +
          'display:inline-grid;place-items:center;' +
          'color:' + C.acc + ';font-weight:800;font-family:monospace;font-size:18px;' +
          'margin-bottom:10px;">&lt;/&gt;</div>' +
        '<div id="auth-title" style="font-size:20px;font-weight:700;color:#fff;margin-bottom:4px;">Вход в аккаунт</div>' +
        '<div id="auth-sub" style="font-size:13px;color:' + C.muted + ';line-height:1.45;">' +
          'Введите почту и пароль от вашего аккаунта.' +
        '</div>' +
      '</div>' +

      // Вкладки Вход / Регистрация
      '<div style="display:flex;padding:0 28px 18px;gap:8px;">' +
        '<button type="button" id="auth-tab-login" class="auth-tab" data-mode="login" ' +
          'style="flex:1;padding:10px 12px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;transition:all .15s ease;">Вход</button>' +
        '<button type="button" id="auth-tab-register" class="auth-tab" data-mode="register" ' +
          'style="flex:1;padding:10px 12px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;transition:all .15s ease;">Регистрация</button>' +
      '</div>' +

      // Поля формы
      '<div style="padding:0 28px 22px;">' +
        '<div id="auth-error" style="color:' + C.errColor + ';font-size:13px;min-height:18px;margin-bottom:10px;"></div>' +

        '<label style="display:block;font-size:12px;color:' + C.muted + ';margin-bottom:6px;font-weight:600;">Email</label>' +
        '<input id="auth-email" type="email" placeholder="you@example.com" autocomplete="email" ' +
          'style="width:100%;padding:12px 14px;margin-bottom:14px;' +
          'background:' + C.inputBg + ';color:' + C.txt + ';' +
          'border:1.5px solid ' + C.inputBorder + ';border-radius:10px;' +
          'box-sizing:border-box;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s ease;" />' +

        '<label style="display:block;font-size:12px;color:' + C.muted + ';margin-bottom:6px;font-weight:600;">Пароль (6+ символов)</label>' +
        '<input id="auth-pass" type="password" placeholder="••••••••" autocomplete="current-password" ' +
          'style="width:100%;padding:12px 14px;margin-bottom:14px;' +
          'background:' + C.inputBg + ';color:' + C.txt + ';' +
          'border:1.5px solid ' + C.inputBorder + ';border-radius:10px;' +
          'box-sizing:border-box;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s ease;" />' +

        // Третье поле — повтор пароля (видно только в режиме регистрации)
        '<div id="auth-pass2-wrap" style="display:none;">' +
          '<label style="display:block;font-size:12px;color:' + C.muted + ';margin-bottom:6px;font-weight:600;">Повторите пароль</label>' +
          '<input id="auth-pass2" type="password" placeholder="••••••••" autocomplete="new-password" ' +
            'style="width:100%;padding:12px 14px;margin-bottom:14px;' +
            'background:' + C.inputBg + ';color:' + C.txt + ';' +
            'border:1.5px solid ' + C.inputBorder + ';border-radius:10px;' +
            'box-sizing:border-box;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s ease;" />' +
        '</div>' +

        '<button id="auth-submit" type="button" ' +
          'style="width:100%;padding:13px;background:' + C.acc + ';color:#fff;border:0;border-radius:10px;' +
          'font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s ease;">Войти</button>' +

        // Ссылка «Забыли пароль?» — только в режиме входа
        '<button id="auth-reset" type="button" ' +
          'style="width:100%;padding:10px;background:transparent;color:' + C.muted + ';border:0;font-size:12.5px;cursor:pointer;font-family:inherit;margin-top:6px;">Забыли пароль?</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Привязка событий
    var tabLogin = document.getElementById('auth-tab-login');
    var tabReg = document.getElementById('auth-tab-register');
    if (tabLogin) tabLogin.addEventListener('click', function () { setMode('login'); });
    if (tabReg)   tabReg.addEventListener('click',   function () { setMode('register'); });

    document.getElementById('auth-submit').addEventListener('click', submit);
    document.getElementById('auth-reset').addEventListener('click', resetPassword);

    var emailInput = document.getElementById('auth-email');
    var passInput  = document.getElementById('auth-pass');
    var pass2Input = document.getElementById('auth-pass2');

    // Focus-эффект — рамка становится акцентного цвета
    [emailInput, passInput, pass2Input].forEach(function (inp) {
      if (!inp) return;
      inp.addEventListener('focus', function () { inp.style.borderColor = C.inputFocus; });
      inp.addEventListener('blur',  function () { inp.style.borderColor = C.inputBorder; });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          if (inp === emailInput) { passInput.focus(); return; }
          if (inp === passInput && currentMode === 'register') { pass2Input.focus(); return; }
          submit();
        }
      });
    });

    // Клик по overlay — НЕ закрываем (пользователь обязан войти)
    // overlay.addEventListener('click', function (e) {
    //   if (e.target === overlay) closeModal();
    // });

    // Устанавливаем начальный режим
    setMode('login');
  }

  // Переключение режима (вход/регистрация)
  function setMode(mode) {
    currentMode = mode;
    var isLogin = (mode === 'login');

    var title = document.getElementById('auth-title');
    var sub   = document.getElementById('auth-sub');
    var submitBtn = document.getElementById('auth-submit');
    var pass2Wrap = document.getElementById('auth-pass2-wrap');
    var resetBtn  = document.getElementById('auth-reset');
    var passInput = document.getElementById('auth-pass');

    if (title)     title.textContent = isLogin ? 'Вход в аккаунт' : 'Создать аккаунт';
    if (sub)       sub.textContent   = isLogin
      ? 'Введите почту и пароль от вашего аккаунта.'
      : 'Аккаунт нужен, чтобы сохранять прогресс и продолжать с любого устройства.';
    if (submitBtn) {
      submitBtn.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
    }
    if (pass2Wrap) pass2Wrap.style.display = isLogin ? 'none' : 'block';
    if (resetBtn)  resetBtn.style.display  = isLogin ? 'block' : 'none';
    if (passInput) passInput.setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');

    // Стили вкладок
    var tabLogin = document.getElementById('auth-tab-login');
    var tabReg   = document.getElementById('auth-tab-register');
    function styleTab(btn, active) {
      if (!btn) return;
      if (active) {
        btn.style.background = C.acc;
        btn.style.color = '#fff';
        btn.style.border = '1.5px solid ' + C.acc;
      } else {
        btn.style.background = C.tabActiveBg;
        btn.style.color = C.tabInactiveColor;
        btn.style.border = '1.5px solid ' + C.inputBorder;
      }
    }
    styleTab(tabLogin, isLogin);
    styleTab(tabReg,   !isLogin);

    var err = document.getElementById('auth-error');
    if (err) err.textContent = '';
  }

  function openModal(opts) {
    opts = opts || {};
    if (!overlay) buildModal();
    if (opts.mode) setMode(opts.mode);
    overlay.style.display = 'flex';
    setTimeout(function () {
      var el = document.getElementById('auth-email');
      if (el) el.focus();
    }, 50);
  }

  function closeModal() {
    if (overlay) overlay.style.display = 'none';
    var err = document.getElementById('auth-error');
    if (err) err.textContent = '';
  }

  function showError(msg) {
    var el = document.getElementById('auth-error');
    if (el) el.textContent = msg;
  }

  // ============================================================
  // 3. Действия с Firebase Auth
  // ============================================================
  function submit() {
    var email = document.getElementById('auth-email').value.trim();
    var pass  = document.getElementById('auth-pass').value;
    var pass2 = document.getElementById('auth-pass2') ? document.getElementById('auth-pass2').value : '';

    if (!email || !pass) { showError('Заполните все поля'); return; }
    if (pass.length < 6) { showError('Пароль минимум 6 символов'); return; }

    if (currentMode === 'register') {
      // В регистрации — проверяем что пароли совпадают
      if (!pass2) { showError('Повторите пароль'); return; }
      if (pass !== pass2) { showError('Пароли не совпадают — проверьте правильность ввода'); return; }
    }

    showError('');
    var submitBtn = document.getElementById('auth-submit');
    var originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Подождите...';

    function done(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      if (err) showError(err);
    }

    // Проверяем что Firebase доступен
    if (!isFirebaseReady()) {
      done('Сервис авторизации недоступен (Firebase SDK не загрузился). ' +
           'Проверьте интернет-соединение или попробуйте обновить страницу. ' +
           'Если проблема повторяется — домен сайта не добавлен в Firebase Console → Authentication → Settings → Authorized domains.');
      return;
    }

    if (currentMode === 'register') {
      firebase.auth().createUserWithEmailAndPassword(email, pass)
        .then(function (uc) { return uc.user.sendEmailVerification(); })
        .then(function () {
          closeModal();
          alert('Аккаунт создан! На почту отправлено письмо для подтверждения. ' +
                'Перейдите по ссылке из письма, чтобы активировать аккаунт. ' +
                'Прогресс уже сохраняется на ваш аккаунт.');
          done();
        })
        .catch(function (e) { done(translateError(e.code)); });
    } else {
      firebase.auth().signInWithEmailAndPassword(email, pass)
        .then(function () {
          closeModal();
          done();
        })
        .catch(function (e) { done(translateError(e.code)); });
    }
  }

  function resetPassword() {
    var email = document.getElementById('auth-email').value.trim();
    if (!email) { showError('Введите email для сброса пароля'); return; }
    if (!isFirebaseReady()) {
      showError('Сервис авторизации недоступен. Проверьте интернет-соединение.');
      return;
    }
    firebase.auth().sendPasswordResetEmail(email)
      .then(function () { alert('Письмо для сброса пароля отправлено на ' + email); })
      .catch(function (e) { showError(translateError(e.code)); });
  }

  function translateError(code) {
    var map = {
      'auth/email-already-in-use':   'Пользователь с такой почтой уже существует. Войдите вместо регистрации.',
      'auth/invalid-email':          'Некорректный email',
      'auth/weak-password':          'Пароль слишком слабый (минимум 6 символов)',
      'auth/user-not-found':         'Пользователь не найден. Возможно, нужно зарегистрироваться.',
      'auth/wrong-password':         'Неверный пароль',
      'auth/invalid-credential':     'Неверный email или пароль',
      'auth/too-many-requests':      'Слишком много попыток. Попробуйте позже или сбросьте пароль.',
      'auth/unauthorized-domain':    'Домен сайта не добавлен в Authorized domains в Firebase Console',
      'auth/operation-not-allowed':  'Вход по почте и паролю не включён в Firebase Console',
      'auth/network-request-failed': 'Нет соединения с интернетом'
    };
    return map[code] || (code || 'Ошибка');
  }

  // ============================================================
  // 4. Синхронизация прогресса с Firestore
  //    Прогресс сохраняется на аккаунт: users/{uid} -> { state, quiz, updatedAt, email }
  // ============================================================

  // Слияние статусов уроков: берём максимальный прогресс (s = 0/1/2 → 2 = пройден)
  function mergeState(local, cloud) {
    local = local || {};
    cloud = cloud || {};
    var result = JSON.parse(JSON.stringify(local));
    for (var k in cloud) {
      if (!(k in result)) {
        result[k] = cloud[k];
      } else {
        var ls = (result[k] && result[k].s) || 0;
        var cs = (cloud[k]  && cloud[k].s)  || 0;
        if (cs > ls) result[k] = cloud[k];
      }
    }
    return result;
  }

  // Слияние результатов тестов: предпочитаем perfect=true, иначе — больше ok
  function mergeQuiz(local, cloud) {
    local = local || {};
    cloud = cloud || {};
    var result = JSON.parse(JSON.stringify(local));
    for (var k in cloud) {
      if (!(k in result)) {
        result[k] = cloud[k];
      } else {
        if (cloud[k].perfect && !result[k].perfect) {
          result[k] = cloud[k];
        } else if (cloud[k].perfect && result[k].perfect) {
          // keep local
        } else if ((cloud[k].ok || 0) > (result[k].ok || 0)) {
          result[k] = cloud[k];
        }
      }
    }
    return result;
  }

  // Выгрузка локального прогресса в облако — на аккаунт пользователя
  function uploadProgress() {
    var user = firebase.auth().currentUser;
    if (!user) return;
    var p = readProgress();
    var data = {
      state: p.state,
      quiz:  p.quiz,
      updatedAt: new Date().toISOString(),
      email: user.email || ''
    };
    firebase.firestore().collection('users').doc(user.uid)
      .set(data, { merge: true })
      .catch(function (e) { console.warn('Sync upload error:', e); });
  }

  // Загрузка прогресса из облака
  function downloadProgress(user) {
    return firebase.firestore().collection('users').doc(user.uid).get()
      .then(function (doc) { return doc.exists ? doc.data() : null; });
  }

  // Применение облачного прогресса к локальному
  function applyCloudProgress(cloudData) {
    if (!cloudData) {
      // Первый вход — выгружаем локальный прогресс в облако
      uploadProgress();
      markSynced();
      return;
    }

    var local = readProgress();
    var newState = mergeState(local.state, cloudData.state);
    var newQuiz  = mergeQuiz(local.quiz,  cloudData.quiz);

    // Сохраняем в localStorage
    localStorage.setItem(STATE_KEY, JSON.stringify(newState));
    localStorage.setItem(QUIZ_KEY,  JSON.stringify(newQuiz));

    // Обновляем in-memory объекты app.js (если они доступны)
    try {
      if (typeof state !== 'undefined' && state) {
        for (var k in state) delete state[k];
        Object.assign(state, newState);
      }
    } catch (e) {}
    try {
      if (typeof quizResults !== 'undefined' && quizResults) {
        for (var k2 in quizResults) delete quizResults[k2];
        Object.assign(quizResults, newQuiz);
      }
    } catch (e) {}

    // Обновляем UI через готовые функции app.js
    try {
      if (typeof refreshAllCards === 'function') refreshAllCards();
    } catch (e) {}
    try {
      if (typeof renderInlineStats === 'function') renderInlineStats();
      else if (typeof renderDrawerStats === 'function') renderDrawerStats();
    } catch (e) {}
    try {
      if (typeof renderStats === 'function') renderStats();
    } catch (e) {}

    markSynced();

    // Если локальный прогресс был богаче облачного — выгружаем объединённую версию
    uploadProgress();
  }

  // ============================================================
  // 5. Автовыгрузка при изменении localStorage
  //    (app.js вызывает localStorage.setItem каждый раз через save())
  // ============================================================
  var lastSyncedHash = null;

  function currentLocalHash() {
    return (localStorage.getItem(STATE_KEY) || '') + '|' + (localStorage.getItem(QUIZ_KEY) || '');
  }

  function markSynced() {
    lastSyncedHash = currentLocalHash();
  }

  // Патчим localStorage.setItem — чтобы ловить изменения из app.js
  function patchLocalStorage() {
    try {
      var proto = Object.getPrototypeOf(localStorage);
      var original = proto.setItem;
      proto.setItem = function (key, value) {
        original.call(this, key, value);
        if ((key === STATE_KEY || key === QUIZ_KEY) && firebase && firebase.auth && firebase.auth().currentUser) {
          scheduleUpload();
        }
      };
    } catch (e) {
      // Если патч не сработал — fallback на polling
      setInterval(pollForChanges, 2000);
    }
  }

  var uploadTimer = null;
  function scheduleUpload() {
    if (uploadTimer) clearTimeout(uploadTimer);
    uploadTimer = setTimeout(uploadProgress, 800);  // debounce 800ms
  }

  // Fallback-поллинг на случай, если патч localStorage не сработал
  function pollForChanges() {
    var user = firebase.auth && firebase.auth().currentUser;
    if (!user) return;
    var h = currentLocalHash();
    if (h !== lastSyncedHash) {
      lastSyncedHash = h;
      uploadProgress();
    }
  }

  // ============================================================
  // 6. Кнопка «Выйти» в верхней панели (app-bar)
  // ============================================================
  var logoutButton = null;

  function ensureLogoutButton() {
    if (logoutButton && document.body.contains(logoutButton)) return;

    var appBar = document.querySelector('.app-bar');
    if (!appBar) return;

    // Контейнер для действий справа в app-bar
    var actions = document.createElement('div');
    actions.className = 'app-bar-actions';
    actions.style.cssText = 'display:flex;align-items:center;gap:8px;margin-left:auto;flex:0 0 auto;';

    // Кнопка «Выйти» — стили вынесены в CSS-класс .auth-logout-btn в index.html
    // чтобы media queries могли переопределять их на мобильных экранах.
    // display:none по умолчанию задано в CSS (.auth-logout-btn без класса .visible),
    // НЕ используем inline style для display — иначе media queries не сработают.
    actions.innerHTML =
      '<button id="auth-logout-btn" class="auth-logout-btn" type="button">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
          '<polyline points="16 17 21 12 16 7"/>' +
          '<line x1="21" y1="12" x2="9" y2="12"/>' +
        '</svg>' +
        '<span id="auth-logout-text">Выйти</span>' +
      '</button>';

    appBar.appendChild(actions);

    logoutButton = document.getElementById('auth-logout-btn');
    if (logoutButton) {
      logoutButton.addEventListener('click', function () {
        if (firebase.auth().currentUser) {
          if (confirm('Выйти из аккаунта? Прогресс сохранён на сервере.')) {
            firebase.auth().signOut().catch(function (e) { console.warn(e); });
          }
        } else {
          openModal({ mode: 'login' });
        }
      });
    }
  }

  function updateLogoutButton(user) {
    if (!logoutButton) return;
    if (user) {
      var email = user.email || '';
      var short = email.split('@')[0] || 'аккаунт';
      // Показываем кнопку через класс (не инлайним display, чтобы media queries работали)
      logoutButton.classList.add('visible');
      var txt = document.getElementById('auth-logout-text');
      if (txt) txt.textContent = 'Выйти (' + short + ')';
      // Сохраняем короткое имя в data-атрибуте для CSS-варианта (иконка на мобильном)
      logoutButton.setAttribute('title', 'Выйти (' + short + ')');
      logoutButton.setAttribute('aria-label', 'Выйти (' + short + ')');
    } else {
      // Не залогинен — кнопка скрыта
      logoutButton.classList.remove('visible');
    }
  }

  // ============================================================
  // 7. АВТОПОКАЗ ОКНА ВХОДА ПРИ ОТСУТСТВИИ АККАУНТА
  //    Окно показывается всегда, пока пользователь не залогинен.
  //    Закрыть без входа — нельзя.
  // ============================================================
  function maybeAutoShowModal(user) {
    if (user) {
      // Залогинен — скрываем окно
      closeModal();
      return;
    }
    // Не залогинен — показываем окно входа
    setTimeout(function () {
      openModal({ mode: 'login' });
    }, 800);
  }

  // ============================================================
  // 8. Реакция на изменения состояния авторизации
  //    (с защитой от ошибок Firebase — если SDK не загрузился,
  //    окно входа всё равно покажется)
  // ============================================================
  function isFirebaseReady() {
    try {
      return (typeof firebase !== 'undefined') &&
             firebase.auth &&
             (typeof firebase.auth === 'function');
    } catch (e) {
      return false;
    }
  }

  function setupAuthListener() {
    if (!isFirebaseReady()) {
      console.warn('[auth] Firebase SDK не загрузился — показываем окно входа в режиме заглушки.');
      // Показываем окно входа всё равно, чтобы пользователь увидел проблему
      setTimeout(function () { openModal({ mode: 'login' }); }, 1000);
      return;
    }
    try {
      firebase.auth().onAuthStateChanged(function (user) {
        try {
          if (user) {
            // Вошёл — подтягиваем прогресс из облака на аккаунт
            downloadProgress(user)
              .then(function (cloudData) { applyCloudProgress(cloudData); })
              .catch(function (e) { console.warn('Load progress error:', e); });
          } else {
            // Вышел — обновляем UI и показываем окно входа
            lastSyncedHash = null;
          }
          updateLogoutButton(user);
          // Показываем/скрываем окно входа в зависимости от состояния
          maybeAutoShowModal(user);
        } catch (innerErr) {
          console.error('[auth] Ошибка в onAuthStateChanged callback:', innerErr);
          // Показываем окно входа как fallback
          setTimeout(function () { openModal({ mode: 'login' }); }, 1000);
        }
      });
    } catch (e) {
      console.error('[auth] Не удалось подписаться onAuthStateChanged:', e);
      // Fallback — показываем окно входа через 1 сек
      setTimeout(function () { openModal({ mode: 'login' }); }, 1000);
    }
  }

  // ============================================================
  // 9. Инициализация
  // ============================================================
  function init() {
    try { patchLocalStorage(); } catch (e) { console.warn('[auth] patchLocalStorage failed:', e); }
    try { ensureLogoutButton(); } catch (e) { console.warn('[auth] ensureLogoutButton failed:', e); }
    // Синхронизация между вкладками — стандартный storage event
    window.addEventListener('storage', function (e) {
      if (e.key === STATE_KEY || e.key === QUIZ_KEY) {
        try {
          if (isFirebaseReady() && firebase.auth().currentUser) scheduleUpload();
        } catch (e2) {}
      }
    });
    // Перед закрытием вкладки — выгрузить прогресс на аккаунт
    window.addEventListener('beforeunload', function () {
      try {
        if (isFirebaseReady() && firebase.auth().currentUser) uploadProgress();
      } catch (e2) {}
    });
    // Запускаем подписку на auth state
    setupAuthListener();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
