#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Опциональный сервер Telegram-бота для курса «Сайт с 0».

Этот скрипт запускает бота в режиме long-polling —
он слушает обновления от Telegram и отвечает на /start,
отправляя приветственное сообщение с кнопкой «Открыть курс».

НЕ ОБЯЗАТЕЛЕН для работы Mini App:
  • Кнопка меню бота (которую установил setup_telegram_bot.py)
    открывает Mini App и без этого сервера.
  • Но если вы хотите, чтобы по команде /start пользователю
    приходило приветственное сообщение с кнопкой —
    запустите этот скрипт.

Запуск:
  1. Откройте файл и впишите свои значения в TOKEN и MINI_APP_URL ниже.
  2. Запустите: python3 telegram_bot.py
  3. Не закрывайте окно — бот работает, пока скрипт запущен.
  4. Для постоянной работы — разверните на сервере (Railway, Fly.io, VPS).

Зависимости: только стандартная библиотека Python (urllib, json).
"""

import sys
import json
import time
import urllib.request
import urllib.parse

# ============================================================
# НАСТРОЙКИ — впишите свои значения
# ============================================================

# Токен бота от @BotFather (формат: 123456789:ABCdefGHI...)
TOKEN = "ВСТАВЬТЕ_ТОКЕН_БОТА_СЮДА"

# URL вашего курса (Mini App). Должен быть HTTPS.
MINI_APP_URL = "https://ВАШ-USERNAME.github.io/tracker-main/"

# ============================================================
# Вспомогательные функции
# ============================================================

def api_call(method, params=None):
    """Вызывает метод Telegram Bot API."""
    url = "https://api.telegram.org/bot" + TOKEN + "/" + method
    if params:
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
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def send_welcome(chat_id, first_name=""):
    """Отправляет приветственное сообщение с кнопкой «Открыть курс»."""
    keyboard = {
        "inline_keyboard": [[
            {"text": "Открыть курс", "web_app": {"url": MINI_APP_URL}}
        ]]
    }
    name_part = ""
    if first_name:
        name_part = ", " + first_name
    text = (
        "Привет" + name_part + "! 👋\n\n"
        "Добро пожаловать в курс «Сайт с 0»!\n\n"
        "16 глав · 167 уроков по созданию сайтов — "
        "от основ до AI и современных практик:\n"
        "• Дизайн и прототипы\n"
        "• HTML, CSS, JavaScript\n"
        "• WordPress, React\n"
        "• Node.js, PostgreSQL, бэкенд\n"
        "• Деплой, Docker, безопасность\n\n"
        "Прогресс сохраняется на вашем аккаунте — "
        "продолжите с любого устройства.\n\n"
        "Нажмите кнопку ниже, чтобы открыть курс 👇"
    )
    return api_call("sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "reply_markup": keyboard,
        "parse_mode": "HTML"
    })


def send_help(chat_id):
    """Отправляет справку по командам."""
    text = (
        "📚 Курс «Сайт с 0»\n\n"
        "Доступные команды:\n"
        "/start — приветствие и кнопка открытия курса\n"
        "/help — эта справка\n\n"
        "Курс также можно открыть через кнопку «Меню» "
        "слева от поля ввода сообщения."
    )
    return api_call("sendMessage", {
        "chat_id": chat_id,
        "text": text
    })


# ============================================================
# Главная логика — long-polling
# ============================================================

def handle_update(update):
    """Обрабатывает одно обновление от Telegram."""
    message = update.get("message") or {}
    if not message:
        return
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")
    first_name = message.get("from", {}).get("first_name", "")

    if not chat_id:
        return

    if text.startswith("/start"):
        print("  [/start от chat_id=" + str(chat_id) + "]")
        send_welcome(chat_id, first_name)
    elif text.startswith("/help"):
        print("  [/help от chat_id=" + str(chat_id) + "]")
        send_help(chat_id)
    elif text:
        # Любое другое сообщение — показываем кнопку открытия курса
        print("  [сообщение от chat_id=" + str(chat_id) + ": " + text[:50] + "]")
        keyboard = {
            "inline_keyboard": [[
                {"text": "Открыть курс", "web_app": {"url": MINI_APP_URL}}
            ]]
        }
        api_call("sendMessage", {
            "chat_id": chat_id,
            "text": "Чтобы открыть курс — нажмите кнопку ниже 👇",
            "reply_markup": keyboard
        })


def main():
    # Проверка настроек
    if "ВСТАВЬТЕ_ТОКЕН" in TOKEN:
        print("ОШИБКА: Откройте файл telegram_bot.py и впишите TOKEN.")
        print("Получить токен можно у @BotFather в Telegram (команда /newbot).")
        sys.exit(1)
    if "ВАШ-USERNAME" in MINI_APP_URL:
        print("ОШИБКА: Откройте файл telegram_bot.py и впишите MINI_APP_URL.")
        print("Это адрес вашего курса на GitHub Pages.")
        sys.exit(1)

    # Проверяем токен
    print("Проверяю токен...")
    me = api_call("getMe")
    if not me.get("ok"):
        print("ОШИБКА: неверный токен — " + me.get("description", ""))
        sys.exit(1)
    bot = me["result"]
    print()
    print("=" * 60)
    print("  Бот запущен: @" + bot["username"])
    print("  Mini App URL: " + MINI_APP_URL)
    print("=" * 60)
    print()
    print("Слушаю обновления... (Ctrl+C для остановки)")
    print()

    offset = 0
    while True:
        try:
            updates = api_call("getUpdates", {
                "offset": offset,
                "timeout": 30,
                "allowed_updates": json.dumps(["message"])
            })
            if not updates.get("ok"):
                print("Ошибка getUpdates: " + updates.get("description", ""))
                time.sleep(5)
                continue
            for update in updates.get("result", []):
                offset = update["update_id"] + 1
                try:
                    handle_update(update)
                except Exception as e:
                    print("Ошибка обработки обновления: " + str(e))
        except KeyboardInterrupt:
            print("\nОстановка...")
            break
        except Exception as e:
            print("Ошибка: " + str(e))
            time.sleep(5)

    print("Бот остановлен.")


if __name__ == "__main__":
    main()
