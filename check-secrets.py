#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка файлов данных на реальные секреты.

Ищет token / api_key / secret и показывает КОНТЕСТ вокруг каждого
совпадения, чтобы отличить настоящий ключ от примера в коде урока.

ЗАПУСК:  python check-secrets.py
"""

import json
import os
import re
import sys

FILES = [
    "site/data/lessons.json",
    "site/data/quizzes.json",
    "site/data/block-quizzes.json",
]

PATTERNS = ["token", "api_key", "apikey", "secret", "password", "bearer"]

# Длинная случайная строка — возможный настоящий ключ
REAL_KEY = re.compile(r"[A-Za-z0-9_\-]{24,}")

# Признаки заглушки / примера
PLACEHOLDER = re.compile(
    r"(ваш|your|xxx|\.\.\.|<|>|example|пример|123456|abc|def|qwerty|test)",
    re.I
)


def walk(obj, path=""):
    """Обходит JSON и возвращает (путь, строковое значение)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk(v, path + "/" + str(k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, path + "[" + str(i) + "]")
    else:
        yield path, obj


def main():
    total = 0
    suspicious = 0

    for f in FILES:
        if not os.path.isfile(f):
            print("   - " + f + " - нет файла")
            continue

        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            print("   !! " + f + " - ошибка чтения: " + str(e))
            continue

        hits = []
        for path, val in walk(data):
            if not isinstance(val, str):
                continue
            low = val.lower()
            for p in PATTERNS:
                i = low.find(p)
                if i == -1:
                    continue
                ctx = val[max(0, i - 70):i + len(p) + 70]
                ctx = ctx.replace("\n", " ")
                hits.append((path, p, ctx))
                break

        print()
        print("=" * 62)
        print(f + "  ->  совпадений: " + str(len(hits)))
        print("=" * 62)

        for path, p, ctx in hits:
            total += 1
            long_runs = REAL_KEY.findall(ctx)
            is_ph = PLACEHOLDER.search(ctx)

            if long_runs and not is_ph:
                suspicious += 1
                mark = "!! ПРОВЕРИТЬ"
            else:
                mark = "ok заглушка"

            print()
            print("  [" + mark + "]  паттерн: " + p)
            print("  путь:  " + path)
            print("  текст: ..." + ctx + "...")

    print()
    print("=" * 62)
    print("Всего совпадений:      " + str(total))
    print("Требуют проверки:      " + str(suspicious))
    print("=" * 62)

    if suspicious == 0:
        print()
        print("OK - все совпадения это примеры из уроков, не настоящие ключи.")
        print("     Репозиторий можно делать публичным.")
    else:
        print()
        print("ВНИМАНИЕ - есть подозрительные строки. Посмотри их выше.")
        print("           Если это настоящие ключи - удали из исходного")
        print("           файла урока и перезапусти build-site.py")


if __name__ == "__main__":
    main()
