// assets/telegram-integration.js
// Интеграция с Telegram WebApp SDK для запуска курса как Mini App внутри Telegram.
//
// Что делает этот файл:
//   1. Определяет, запущен ли курс внутри Telegram WebView.
//   2. Если да — вызывает telegram.WebApp.ready() и expand() (открыть на весь экран).
//   3. Применяет тему Telegram (фон, текст) к странице — чтобы Mini App
//      визуально сливался с клиентом Telegram.
//   4. Слушает viewportChanged — при изменении размеров Mini App
//      перерисовывает layout (срабатывает resize event → CSS media queries).
//   5. Отключает вертикальные свайпы Telegram (чтобы не мешали скроллу внутри курса).
//   6. Настраивает BackButton Telegram для закрытия модальных окон урока/теста.
//
// Если курс открыт НЕ в Telegram (обычный браузер, GitHub Pages) —
// файл ничего не делает, всё работает как раньше.

(function () {
  'use strict';

  // Защита от двойной инициализации
  if (window.__telegramIntegrated) return;
  window.__telegramIntegrated = true;

  // Проверяем, что Telegram WebApp SDK загрузился
  if (typeof window.Telegram === 'undefined' || !window.Telegram.WebApp) {
    // Не в Telegram — выходим тихо, курс работает как обычный сайт
    return;
  }

  var tg = window.Telegram.WebApp;

  // ============================================================
  // 1. Сигнализируем Telegram, что Mini App готов к отображению
  //    (вызов ready() убирает loading-индикатор Telegram)
  // ============================================================
  try { tg.ready(); } catch (e) {}
  // Раскрываем Mini App на всю доступную высоту
  try { tg.expand(); } catch (e) {}

  // ============================================================
  // 2. Применяем тему Telegram (фон и цвет текста)
  //    Чтобы Mini App визуально сливался с клиентом Telegram.
  //    Если тема Telegram светлая — оставляем нашу тёмную тему
  //    (она лучше подходит для чтения кода и уроков).
  //    Но цвет header'а и фона body подстраиваем.
  // ============================================================
  try {
    if (tg.themeParams) {
      // Цвет header (верхней панели) — берём из темы Telegram
      var headerColor = tg.themeParams.bg_color || tg.themeParams.secondary_bg_color;
      if (headerColor && document.querySelector('.app-bar')) {
        // Оставляем наш градиент для app-bar — он лучше выглядит
        // но можете раскомментировать строку ниже, если хотите Telegram-цвет:
        // document.querySelector('.app-bar').style.background = headerColor;
      }
      // Цвет фона body — оставляем наш тёмный (#2a2f3a), не подстраиваем
      // потому что наша тема специально тёмная для чтения

      // Меняем метатег theme-color для статус-бара мобильного
      var metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme && tg.themeParams.bg_color) {
        metaTheme.setAttribute('content', tg.themeParams.bg_color);
      }
    }
  } catch (e) {}

  // Устанавливаем цвет header для Telegram (Android)
  try {
    if (tg.setHeaderColor) {
      tg.setHeaderColor({
        color: '#1d2939'  // наш цвет app-bar
      });
    }
  } catch (e) {}

  // Устанавливаем цвет background для Telegram
  try {
    if (tg.setBackgroundColor) {
      tg.setBackgroundColor('#2a2f3a');  // наш фон страницы
    }
  } catch (e) {}

  // ============================================================
  // 3. Отключаем вертикальные свайпы Telegram
  //    (чтобы они не мешали скроллу внутри курса)
  // ============================================================
  try {
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
  } catch (e) {}

  // ============================================================
  // 4. Слушаем изменение viewport (когда пользователь
  //    сворачивает/разворачивает Mini App)
  //    → отправляем window resize event, чтобы CSS media queries
  //      перерисовали layout
  // ============================================================
  try {
    tg.onEvent('viewportChanged', function () {
      // Триггерим resize — CSS media queries сами подстроятся
      window.dispatchEvent(new Event('resize'));
    });
  } catch (e) {}

  // ============================================================
  // 5. BackButton Telegram — для закрытия модальных окон
  //    Когда открыто окно урока или теста — показываем BackButton
  //    Telegram, при нажатии — закрываем модалку.
  //    Когда модалок нет — скрываем BackButton.
  // ============================================================
  try {
    var backBtn = tg.BackButton;

    function updateBackButton() {
      var lessonBg = document.getElementById('lessonBg');
      var blockBg  = document.getElementById('blockBg');
      var aboutBg  = document.getElementById('aboutBg');
      var isModalOpen =
        (lessonBg && lessonBg.classList.contains('show')) ||
        (blockBg  && blockBg.classList.contains('show'))  ||
        (aboutBg  && aboutBg.classList.contains('show'));
      if (isModalOpen) {
        backBtn.show();
      } else {
        backBtn.hide();
      }
    }

    backBtn.onClick(function () {
      // Закрываем все открытые модалки в обратном порядке
      var aboutBg = document.getElementById('aboutBg');
      if (aboutBg && aboutBg.classList.contains('show')) {
        aboutBg.classList.remove('show');
        updateBackButton();
        return;
      }
      var blockBg = document.getElementById('blockBg');
      if (blockBg && blockBg.classList.contains('show')) {
        if (typeof closeBlockQuiz === 'function') closeBlockQuiz();
        updateBackButton();
        return;
      }
      var lessonBg = document.getElementById('lessonBg');
      if (lessonBg && lessonBg.classList.contains('show')) {
        if (typeof closeLesson === 'function') closeLesson();
        updateBackButton();
        return;
      }
    });

    // Наблюдаем за изменениями модалок — показываем/скрываем BackButton
    var observer = new MutationObserver(function () {
      updateBackButton();
    });
    ['lessonBg', 'blockBg', 'aboutBg'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    // Начальное состояние
    setTimeout(updateBackButton, 500);
  } catch (e) {}

  // ============================================================
  // 6. Закрываем Mini App при определённых действиях
  //    (например, при нажатии на "Выйти" — можно закрыть Mini App)
  //    Оставляем закомментированным — пусть кнопка "Выйти"
  //    просто показывает окно входа, не закрывает Mini App.
  // ============================================================
  // try { tg.onEvent('mainButtonClicked', function() { tg.close(); }); } catch(e) {}

  // ============================================================
  // 7. Сообщаем в консоль, что интеграция активна
  // ============================================================
  console.log('[telegram-integration] Mini App mode активирован. Платформа:', tg.platform);
  if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    console.log('[telegram-integration] Пользователь Telegram:', tg.initDataUnsafe.user.first_name,
                '(ID: ' + tg.initDataUnsafe.user.id + ')');
  }

})();
