#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Настройка Telegram-бота для Mini App курса «Сайт с 0».

Скрипт делает ОДНОРАЗОВУЮ настройку бота через Telegram Bot API:
  1. Проверяет токен бота (получает информацию о боте)
  2. Устанавливает кнопку меню (ChatMenuButton) — «Открыть курс» → открывает Mini App
  3. Устанавливает описание бота (видно в профиле бота)
  4. Устанавливает короткое описание (видно в списке чатов)
  5. Устанавливает команду /start
  6. Отправляет тестовое сообщение вам (если укажете свой chat_id)

После настройки бот не требует сервера — Mini App это просто ваш сайт
на GitHub Pages, открытый внутри Telegram WebView.

Запуск:
  python3 setup_telegram_bot.py

Зависимости: только стандартная библиотека Python (urllib, json).
"""

import sys
import json
import urllib.request
import urllib.parse

# ============================================================
# Вспомогательные функции
# ============================================================

def api_call(token, method, params=None):
    """Вызывает метод Telegram Bot API и возвращает распарсенный JSON."""
    url = "https://api.telegram.org/bot" + token + "/" + method
    if params:
        # Сложные параметры (вложенные dict/list) кодируем как JSON-строки
        clean = {}
        for k, v in params.items():
            if isinstance(v, (dict, list)):
                clean[k] = json.dumps(v, ensure_ascii=False)
            else:
                clean[k] = v
        data = urllib.parse.urlencode(clean, encoding="utf-8").encode("utf-8")
        req = urllib.request.Request(url, data=data)
    else:
        req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        return {"ok": False, "error_code": e.code, "description": body}
    except Exception as e:
        return {"ok": False, "description": str(e)}


def print_ok(msg):
    print("  [+] " + msg)

def print_err(msg):
    print("  [-] ОШИБКА: " + msg)

def print_info(msg):
    print("  [i] " + msg)


# ============================================================
# Основная логика
# ============================================================

def main():
    print("=" * 60)
    print("  Настройка Telegram-бота для Mini App «Сайт с 0»")
    print("=" * 60)
    print()

    # --- 1. Получаем токен бота ---
    print("Шаг 1. Введите токен бота.")
    print_info("Токен можно получить у @BotFather в Telegram.")
    print_info("Команда в @BotFather: /newbot → придумайте имя и username.")
    print_info("После создания бота BotFather пришлёт токен вида:")
    print_info("  123456789:ABCdefGHIjklMNOpqrSTUvwxYZ")
    print()
    token = input("  Токен бота: ").strip()
    if not token:
        print_err("Токен не указан. Выход.")
        sys.exit(1)
    print()

    # Проверяем токен
    print("  Проверяю токен...")
    me = api_call(token, "getMe")
    if not me.get("ok"):
        print_err("Неверный токен: " + me.get("description", "неизвестная ошибка"))
        sys.exit(1)
    bot = me["result"]
    print_ok("Бот найден: @" + bot["username"] + " (" + bot.get("first_name", "") + ")")
    print()

    # --- 2. Получаем URL Mini App ---
    print("Шаг 2. Введите URL Mini App.")
    print_info("Это адрес, где размещён ваш курс.")
    print_info("Например: https://ВАШ-USERNAME.github.io/tracker-main/")
    print_info("URL должен быть HTTPS (GitHub Pages и любой хостинг дают HTTPS по умолчанию).")
    print()
    mini_app_url = input("  URL Mini App: ").strip()
    if not mini_app_url:
        print_err("URL не указан. Выход.")
        sys.exit(1)
    if not mini_app_url.startswith("https://"):
        print_err("URL должен начинаться с https:// (Telegram требует HTTPS).")
        sys.exit(1)
    if not mini_app_url.endswith("/"):
        mini_app_url = mini_app_url + "/"  # Telegram ожидает URL с trailing slash для корня
    print()
    print_info("Mini App URL: " + mini_app_url)
    print()

    # --- 3. Устанавливаем кнопку меню ---
    print("Шаг 3. Устанавливаю кнопку меню бота (ChatMenuButton)...")
    menu_button = {
        "type": "web_app",
        "text": "Открыть курс",
        "web_app": {"url": mini_app_url}
    }
    result = api_call(token, "setChatMenuButton", {"menu_button": menu_button})
    if result.get("ok"):
        print_ok("Кнопка меню установлена — «Открыть курс».")
    else:
        print_err("Не удалось установить кнопку меню: " + result.get("description", ""))
        print_info("Продолжаю настройку...")
    print()

    # --- 4. Устанавливаем описание бота ---
    print("Шаг 4. Устанавливаю описание бота...")
    description = (
        "Курс по созданию сайтов с нуля — 16 глав, 167 уроков, тесты.\n"
        "От основ до AI и современных практик: HTML, CSS, JavaScript, "
        "WordPress, React, Node.js, PostgreSQL, бэкенд, деплой.\n\n"
        "Нажмите кнопку «Меню» (или /start) — откроется Mini App с курсом."
    )
    result = api_call(token, "setMyDescription", {"description": description})
    if result.get("ok"):
        print_ok("Описание установлено (видно в профиле бота).")
    else:
        print_err("Не удалось установить описание: " + result.get("description", ""))
    print()

    # --- 5. Короткое описание (видно в списке чатов) ---
    print("Шаг 5. Устанавливаю короткое описание (about)...")
    short_desc = "Курс по созданию сайтов — 167 уроков, тесты, работает офлайн."
    result = api_call(token, "setMyShortDescription", {"short_description": short_desc})
    if result.get("ok"):
        print_ok("Короткое описание установлено.")
    else:
        print_err("Не удалось установить: " + result.get("description", ""))
    print()

    # --- 6. Устанавливаем команды ---
    print("Шаг 6. Устанавливаю команду /start...")
    commands = [
        {"command": "start", "description": "Открыть курс"}
    ]
    result = api_call(token, "setMyCommands", {"commands": commands})
    if result.get("ok"):
        print_ok("Команда /start установлена.")
    else:
        print_err("Не удалось установить команду: " + result.get("description", ""))
    print()

    # --- 7. Устанавливаем имя бота (опционально) ---
    print("Шаг 7. Устанавливаю имя бота...")
    result = api_call(token, "setMyName", {"name": "Сайт с 0 — курс"})
    if result.get("ok"):
        print_ok("Имя бота установлено: «Сайт с 0 — курс».")
    else:
        print_err("Не удалось установить имя: " + result.get("description", ""))
    print()

    # --- 8. Отправляем тестовое сообщение (опционально) ---
    print("Шаг 8. Отправить тестовое сообщение?")
    print_info("Введите ваш chat_id, чтобы бот прислал вам приветствие с кнопкой.")
    print_info("Как узнать свой chat_id: напишите боту @userinfobot в Telegram.")
    print_info("Или оставьте пустым, чтобы пропустить этот шаг.")
    print()
    chat_id = input("  Ваш chat_id (или Enter для пропуска): ").strip()
    if chat_id:
        keyboard = {
            "inline_keyboard": [[
                {"text": "Открыть курс", "web_app": {"url": mini_app_url}}
            ]]
        }
        text = (
            "Добро пожаловать в курс «Сайт с 0»!\n\n"
            "16 глав · 167 уроков по созданию сайтов — от основ до AI "
            "и современных практик.\n\n"
            "Нажмите кнопку ниже, чтобы открыть курс 👇"
        )
        result = api_call(token, "sendMessage", {
            "chat_id": chat_id,
            "text": text,
            "reply_markup": keyboard,
            "parse_mode": "HTML"
        })
        if result.get("ok"):
            print_ok("Сообщение отправлено! Проверьте Telegram.")
        else:
            print_err("Не удалось отправить: " + result.get("description", ""))
    else:
        print_info("Тестовое сообщение пропущено.")
    print()

    # --- Готово ---
    print("=" * 60)
    print("  Настройка завершена!")
    print("=" * 60)
    print()
    print("Теперь:")
    print("  1. Откройте вашего бота в Telegram: @" + bot["username"])
    print("  2. Нажмите кнопку «Меню» внизу слева от поля ввода")
    print("     (или отправьте /start — но только если вы запустили telegram_bot.py)")
    print("  3. Нажмите «Открыть курс» — откроется Mini App с вашим курсом")
    print()
    print("Mini App откроет ваш сайт " + mini_app_url)
    print("внутри Telegram WebView, со всей адаптацией под экран.")
    print()
    print("Пользователь входит в аккаунт (email + пароль) — ")
    print("прогресс синхронизируется через Firebase Firestore ")
    print("с браузерной версией автоматически.")
    print()
    print("Важно:")
    print("  • Mini App работает в Telegram Mobile и Telegram Desktop ≥ 4.0")
    print("  • Если вы добавляете нового бота — подождите минуту после настройки")
    print("  • Если кнопка «Меню» не появилась — закройте и откройте чат с ботом")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nПрервано пользователем.")
        sys.exit(1)
