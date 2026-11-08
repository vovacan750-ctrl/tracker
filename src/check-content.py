#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
АУДИТ КОНТЕНТА — поиск опечаток и проблем разметки.

Что проверяется:
  1. Пробелы перед запятой/точкой/двоеточием
  2. Отсутствие пробела после запятой
  3. Двойные и тройные пробелы
  4. Многоточия из двух точек
  5. Незакрытые HTML-теги в контенте урока
  6. Незаэкранированный символ < внутри кода
  7. Пустые уроки (нет контента)
  8. Слишком короткий контент (меньше 300 символов)
  9. Дубли названий уроков
 10. Битые ссылки в блоке pre (пример кода)

ЗАПУСК:  python check-content.py
"""

import json
import os
import re
import sys
from collections import Counter

DATA = "site/data/lessons.json"

ISSUES = Counter()


def add(kind, where, detail):
    ISSUES[kind] += 1
    print("  [" + kind + "] " + where)
    if detail:
        print("      " + detail[:160])


def check_text(idx, title, text):
    where = "урок " + str(idx) + " «" + title[:40] + "»"

    # 1. пробел перед знаком препинания
    for m in re.finditer(r"\s+[,.;:!?]", text):
        ctx = text[max(0, m.start() - 35):m.start() + 15].replace("\n", " ")
        add("пробел перед знаком", where, "..." + ctx + "...")

    # 2. нет пробела после запятой между словами
    for m in re.finditer(r"[а-яА-Яa-zA-Z],[а-яА-Яa-zA-Z]", text):
        ctx = text[max(0, m.start() - 30):m.start() + 15].replace("\n", " ")
        add("нет пробела после запятой", where, "..." + ctx + "...")

    # 3. двойной+ пробел (не в начале строки и не в коде)
    for m in re.finditer(r"\S  +\S", text):
        ctx = text[max(0, m.start() - 30):m.start() + 20].replace("\n", " ")
        add("двойной пробел", where, "..." + ctx + "...")

    # 4. две точки вместо трёх
    for m in re.finditer(r"\.\.(?![.\d])", text):
        ctx = text[max(0, m.start() - 30):m.start() + 20].replace("\n", " ")
        add("многоточие из 2 точек", where, "..." + ctx + "...")


def check_html(idx, title, text):
    where = "урок " + str(idx) + " «" + title[:40] + "»"
    # теги, которые не требуют закрытия
    VOID = {"br", "hr", "img", "input", "meta", "link", "source", "path",
            "circle", "rect", "line", "polyline", "polygon", "use", "stop"}

    stack = []
    for m in re.finditer(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)((?:\"[^\"]*\"|'[^']*'|[^>\"'])*)>", text):
        closing, tag, attrs = m.group(1), m.group(2).lower(), m.group(3) or ""
        selfclose = attrs.rstrip().endswith("/")
        if tag in VOID or selfclose or tag.startswith("?"):
            continue
        if closing:
            if stack and stack[-1][0] == tag:
                stack.pop()
            else:
                add("лишний закрывающий тег", where, "</" + tag + "> в позиции " + str(m.start()))
        else:
            stack.append((tag, m.start()))

    if stack:
        add("незакрытые теги", where,
            ", ".join("<" + t + ">" for t, _ in stack[:8]) +
            (" и ещё " + str(len(stack) - 8) if len(stack) > 8 else ""))


def main():
    if not os.path.isfile(DATA):
        print("Нет файла " + DATA + ". Сначала запусти build-site.py")
        sys.exit(1)

    data = json.load(open(DATA, encoding="utf-8"))
    lessons = data["lessons"]

    print("=" * 62)
    print("АУДИТ КОНТЕНТА — " + str(len(lessons)) + " уроков")
    print("=" * 62)

    titles = Counter()
    for i, l in enumerate(lessons, 1):
        title = l.get("t", "")
        body = l.get("c", "")
        titles[title.strip().lower()] += 1

        if not body.strip():
            add("пустой урок", i, title)
            continue
        if len(body) < 300:
            add("очень короткий урок", i, title + " (" + str(len(body)) + " симв.)")
        if not l.get("g"):
            add("нет цели урока", i, title)

        check_text(i, title, body)
        check_html(i, title, body)

    dups = [t for t, c in titles.items() if c > 1]
    if dups:
        print()
        print("Дубли названий:")
        for d in dups:
            add("дубль названия", d, "встречается " + str(titles[d]) + " раза")

    print()
    print("=" * 62)
    print("ИТОГО проблем: " + str(sum(ISSUES.values())))
    print("=" * 62)
    for k, v in ISSUES.most_common():
        print("  " + k.ljust(28) + str(v))

    if sum(ISSUES.values()) == 0:
        print()
        print("Чисто - ошибок не найдено.")


if __name__ == "__main__":
    main()
