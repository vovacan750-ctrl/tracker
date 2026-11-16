// assets/auth.js
// Логика входа, регистрации и синхронизации прогресса через Firebase.
// Интегрируется с app.js (трекер обучения): использует те же ключи localStorage
// (tracker.state.v1 и tracker.quiz.v1) и те же глобальные объекты state / quizResults.
//
// Что делает этот файл:
//   1. При первом заходе на сайт (если пользователь не вошёл) — автоматически
//      показывает окно входа/регистрации.
//   2. Добавляет кнопку «Войти в аккаунт» в начало бокового меню (drawer).
//   3. После входа подтягивает прогресс из Firestore и объединяет его с локальным.
//   4. Каждый раз, когда app.js сохраняет прогресс локально, — выгружает его в облако
//      именно на аккаунт пользователя (users/{uid}).

(function () {
  'use strict';

  // Защита от двойной инициализации
  if (window.__authInitialized) return;
  window.__authInitialized = true;

  // Локальные ключи — должны совпадать с теми, что в app.js
  var STATE_KEY = 'tracker.state.v1';
  var QUIZ_KEY  = 'tracker.quiz.v1';

  // Ключ в localStorage для флага "окно уже показывалось"
  var MODAL_SHOWN_KEY = 'auth.modalAutoShown';

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
  var isRegister = false;
  // По умолчанию показываем вкладку "Регистрация" при автопоказе первого входа
  var defaultMode = 'register';

  function buildModal() {
    overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.7)',
      'z-index:99999', 'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:system-ui,-apple-system,sans-serif'
    ].join(';');

    var modal = document.createElement('div');
    modal.style.cssText = [
      'background:#fff', 'color:#222', 'padding:28px', 'border-radius:14px',
      'max-width:380px', 'width:90%', 'box-shadow:0 12px 40px rgba(0,0,0,0.4)'
    ].join(';');

    modal.innerHTML =
      '<h2 id="auth-title" style="margin:0 0 6px;font-size:20px;">Создать аккаунт</h2>' +
      '<p id="auth-sub" style="margin:0 0 14px;font-size:13px;color:#666;line-height:1.4;">' +
        'Аккаунт нужен, чтобы сохранять прогресс обучения и продолжать с любого устройства.' +
      '</p>' +
      '<div id="auth-error" style="color:#d32f2f;font-size:13px;min-height:18px;margin-bottom:8px;"></div>' +
      '<input id="auth-email" type="email" placeholder="Email" autocomplete="email" ' +
        'style="width:100%;padding:11px;margin-bottom:8px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box;font-size:14px;" />' +
      '<input id="auth-pass" type="password" placeholder="Пароль (6+ символов)" autocomplete="new-password" ' +
        'style="width:100%;padding:11px;margin-bottom:12px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box;font-size:14px;" />' +
      '<button id="auth-submit" ' +
        'style="width:100%;padding:12px;background:#ff8c00;color:#fff;border:0;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Зарегистрироваться</button>' +
      '<button id="auth-toggle" ' +
        'style="width:100%;padding:10px;background:transparent;color:#555;border:0;font-size:13px;cursor:pointer;">Уже есть аккаунт? Войти</button>' +
      '<button id="auth-reset" ' +
        'style="width:100%;padding:6px;background:transparent;color:#888;border:0;font-size:12px;cursor:pointer;">Забыли пароль?</button>' +
      '<button id="auth-skip" ' +
        'style="width:100%;padding:6px;background:transparent;color:#aaa;border:0;font-size:12px;cursor:pointer;margin-top:4px;">Продолжить без аккаунта</button>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('auth-skip').onclick = closeModal;
    document.getElementById('auth-toggle').onclick = toggleMode;
    document.getElementById('auth-reset').onclick = resetPassword;
    document.getElementById('auth-submit').onclick = submit;
    document.getElementById('auth-pass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });
    document.getElementById('auth-email').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('auth-pass').focus();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    // Устанавливаем начальный режим
    setMode(defaultMode);
  }

  function setMode(register) {
    isRegister = register;
    document.getElementById('auth-title').textContent = isRegister ? 'Создать аккаунт' : 'Вход в аккаунт';
    document.getElementById('auth-sub').textContent = isRegister
      ? 'Аккаунт нужен, чтобы сохранять прогресс обучения и продолжать с любого устройства.'
      : 'Введите почту и пароль от вашего аккаунта.';
    document.getElementById('auth-submit').textContent = isRegister ? 'Зарегистрироваться' : 'Войти';
    document.getElementById('auth-toggle').textContent = isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
    var emailInput = document.getElementById('auth-email');
    if (emailInput) emailInput.setAttribute('autocomplete', isRegister ? 'email' : 'email');
    var passInput = document.getElementById('auth-pass');
    if (passInput) passInput.setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');
    var err = document.getElementById('auth-error');
    if (err) err.textContent = '';
  }

  function toggleMode() {
    setMode(!isRegister);
  }

  function openModal(opts) {
    opts = opts || {};
    if (!overlay) buildModal();
    if (opts.mode) {
      setMode(opts.mode === 'register');
      defaultMode = opts.mode;
    }
    overlay.style.display = 'flex';
    setTimeout(function () { document.getElementById('auth-email').focus(); }, 50);
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
    if (!email || !pass) { showError('Заполните все поля'); return; }
    if (pass.length < 6) { showError('Пароль минимум 6 символов'); return; }

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

    if (isRegister) {
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
      if (typeof renderDrawerStats === 'function') renderDrawerStats();
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
  // 6. Кнопка «Войти / Выйти» в боковом меню (drawer)
  // ============================================================
  var authButton = null;

  function ensureAuthButton() {
    if (authButton && document.body.contains(authButton)) return;

    var drawer = document.getElementById('drawer');
    if (!drawer) return;

    var container = document.createElement('div');
    container.id = 'auth-drawer-block';
    container.style.cssText = 'padding:16px;border-bottom:1px solid rgba(255,255,255,0.08);';
    container.innerHTML =
      '<button id="auth-menu-btn" ' +
      'style="width:100%;padding:12px 16px;background:#ff8c00;color:#fff;border:0;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">' +
      'Войти в аккаунт</button>';

    authButton = container.querySelector('#auth-menu-btn');
    authButton.addEventListener('click', function () {
      if (firebase.auth().currentUser) {
        if (confirm('Выйти из аккаунта?')) {
          firebase.auth().signOut().catch(function (e) { console.warn(e); });
        }
      } else {
        openModal({ mode: 'login' });
      }
    });

    drawer.insertBefore(container, drawer.firstChild);
  }

  function updateAuthButton(user) {
    if (!authButton) return;
    if (user) {
      var email = user.email || '';
      var short = email.split('@')[0];
      authButton.textContent = 'Выйти (' + short + ')';
      authButton.style.background = '#3a3f4a';
    } else {
      authButton.textContent = 'Войти в аккаунт';
      authButton.style.background = '#ff8c00';
    }
  }

  // ============================================================
  // 7. АВТОПОКАЗ ОКНА ВХОДА ПРИ ПЕРВОМ ЗАХОДЕ
  //    Показываем только если:
  //    - пользователь не залогинен
  //    - окно ещё ни разу не показывалось автоматически (флаг в localStorage)
  // ============================================================
  function maybeAutoShowModal(user) {
    if (user) return; // Уже залогинен — не показываем
    if (localStorage.getItem(MODAL_SHOWN_KEY) === '1') return; // Уже показывали — не показываем

    // Помечаем, что показали
    localStorage.setItem(MODAL_SHOWN_KEY, '1');

    // Небольшая задержка, чтобы успел скрыться loader
    setTimeout(function () {
      openModal({ mode: 'register' });
    }, 1200);
  }

  // Сбросить флаг "окно показывалось" — полезно, если хотите, чтобы окно снова
  // появилось при следующем заходе (например, после выхода из аккаунта).
  // По умолчанию НЕ сбрасываем — пользователь уже видел окно, не назойливим.
  // Раскомментируйте строку в signOut ниже, если хотите всегда показывать окно
  // при следующем заходе после выхода.

  // ============================================================
  // 8. Реакция на изменения состояния авторизации
  // ============================================================
  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      // Вошёл — подтягиваем прогресс из облака на аккаунт
      downloadProgress(user)
        .then(function (cloudData) { applyCloudProgress(cloudData); })
        .catch(function (e) { console.warn('Load progress error:', e); });
    } else {
      // Вышел — просто обновляем UI, локальный прогресс не трогаем
      lastSyncedHash = null;
    }
    updateAuthButton(user);
    // Пытаемся показать автопоказ (только при первом заходе, без аккаунта)
    maybeAutoShowModal(user);
  });

  // ============================================================
  // 9. Инициализация
  // ============================================================
  function init() {
    patchLocalStorage();
    ensureAuthButton();
    // Синхронизация между вкладками — стандартный storage event
    window.addEventListener('storage', function (e) {
      if (e.key === STATE_KEY || e.key === QUIZ_KEY) {
        if (firebase.auth().currentUser) scheduleUpload();
      }
    });
    // Перед закрытием вкладки — выгрузить прогресс на аккаунт
    window.addEventListener('beforeunload', function () {
      if (firebase.auth().currentUser) uploadProgress();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
