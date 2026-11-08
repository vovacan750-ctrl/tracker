#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СБОРКА ДАННЫХ ДЛЯ САЙТА-ТРЕКЕРА.

Читает 6 файлов уроков + файлы тестов и создаёт:
    site/data/lessons.json        — 124 урока + список глав
    site/data/quizzes.json        — тесты по урокам (по 8 вопросов)
    site/data/block-quizzes.json  — большие тесты по главам

Дополнительно нормализует блоки &lt;pre&gt;: HTML-примеры внутри них
экранируются, иначе браузер пытается их отрендерить вместо показа как код.

ЗАПУСК:  python build-site.py
"""

import re
import json
import os
import sys
import html as _html

SITE_DIR = "site"
DATA_DIR = os.path.join(SITE_DIR, "data")

LESSON_FILES = [
    "uroki-01-16-rasshirennaya.html",
    "uroki-17-44-rasshirennaya.html",
    "uroki-45-68-rasshirennaya.html",
    "uroki-69-92-rasshirennaya.html",
    "uroki-93-110-rasshirennaya.html",
    "uroki-111-124-rasshirennaya.html",
    "uroki-AI-rasshirennaya.html",
    "uroki-modern-rasshirennaya.html",
]

QUIZ_PATTERN = r'quizzes-rasshirennaya-.*\.js$'
BLOCK_PATTERN = r'block-quiz-[A-Z]\.js$'

TITLES = [
"Что происходит, когда ты открываешь сайт","Домен, DNS и хостинг",
"Статический сайт, динамический сайт и CMS","Типы сайтов и их отличия",
"Рабочее место разработчика","Git и GitHub с первого дня",
"Бриф: как вытащить задачу у заказчика","Целевая аудитория и конкурентный анализ",
"Структура страницы и пользовательский путь","Прототипирование: блоки и логика",
"Композиция, сетки и визуальная иерархия","Правило третей, золотое сечение и воздух",
"Типографика: основа","Шрифтовые пары и Google Fonts","Цвет: теория и палитра",
"Контраст и доступность (WCAG)","UI-компоненты в Figma","Auto-layout и компоненты",
"Адаптивный дизайн и mobile-first","Дизайн-система и передача в вёрстку",
"Структура HTML-документа","Текст, списки, ссылки, изображения","Семантические теги",
"Формы: поля, типы, валидация","Доступность: ARIA, alt, label","Meta-теги и SEO-разметка",
"Таблицы, медиа и встраиваемый контент","Подключение CSS, каскад, специфичность",
"Box Model и единицы измерения","Цвета, фоны, градиенты","Типографика в CSS",
"Flexbox: основа","Flexbox: сложные случаи","CSS Grid: основа","Grid: сложные сетки",
"Позиционирование","Псевдоклассы и псевдоэлементы","Адаптив: media queries и mobile-first",
"Современные адаптивные приёмы","Анимации: transitions",
"Анимации: keyframes и transform","CSS-переменные, БЭМ, организация файлов","Sass/SCSS",
"Сборка, оптимизация, pixel perfect","Переменные и типы данных","Условия, операторы, циклы",
"Функции и стрелочные функции","Объекты и деструктуризация","Массивы и методы",
"DOM: поиск и изменение","DOM: создание и удаление","События и делегирование",
"Формы и валидация на JS","Шаблонные строки, spread, rest","Асинхронность: Promise",
"async/await и fetch","Работа с JSON и внешними API","localStorage и sessionStorage",
"Модули и npm","Обработка ошибок и отладка","Библиотеки: Swiper, Lenis, AOS",
"Проект: интерактивный лендинг + корзина","Установка: локально и на хостинге",
"Админка, настройки, пользователи, роли","Страницы, меню, виджеты",
"Темы: как устроены, дочерние темы","Иерархия шаблонов",
"functions.php и подключение ассетов","Своя тема: базовые шаблоны",
"Произвольные типы записей и таксономии","ACF: произвольные поля",
"ACF: гибкое содержимое и повторители","WP_Query и произвольные выборки",
"Elementor и Crocoblock","Обязательные плагины","Скорость WordPress","Безопасность и бэкапы",
"SEO-настройка WordPress","Проект: корпоративный сайт на своей теме",
"Установка и настройка магазина","Товары: простые и вариативные",
"Категории, атрибуты, фильтры","Корзина и оформление заказа","Доставка и налоги",
"Купоны, скидки, акции","Email-уведомления","Личный кабинет пользователя",
"Чеки и фискализация (54-ФЗ)","Кастомизация шаблонов WooCommerce","Импорт/экспорт товаров",
"Проект: интернет-магазин под ключ","Выбор хостинга и перенос сайта",
"Домен, DNS, Cloudflare, SSL","Чек-лист приёмки сайта (50 пунктов)","SEO-база",
"Аналитика: Яндекс.Метрика и GA4","Core Web Vitals и производительность",
"Право РФ: 152-ФЗ, оферта, политика","Передача проекта и поддержка",
"API, ключи и webhook — как это работает","Платёжные системы: ЮKassa",
"Robokassa, CloudPayments, эквайринг","Доставка: СДЭК, Почта России, Boxberry",
"CRM: Битрикс24, AmoCRM","Email, Telegram-боты, Google Sheets",
"Обмен с 1С и облачное хранение","React: база для современных сайтов",
"Next.js и серверный рендеринг (SSR)","Tailwind CSS","GSAP: таймлайны и анимации",
"GSAP ScrollTrigger и пиннинг","Lenis: плавный скролл и параллакс","Framer Motion",
"SVG-анимации, Lottie, Rive","Three.js и WebGL: база",
"Шейдеры, прелоадеры, переходы, курсор","Webflow для сложных анимаций",
"Проект: «вау»-лендинг и портфолио","ТЗ, смета и оценка часов","Договор, предоплата, этапы",
"Переговоры и работа с правками","Ценообразование и защита цены","Портфолио и кейсы",
"Первый клиент и дальнейшее развитие",
"AI-ассистенты: ChatGPT, Claude, Cursor",
"GitHub Copilot и автодополнение кода",
"AI для генерации UI: v0, Bolt, Lovable",
"AI для изображений: Midjourney, DALL-E, Stable Diffusion",
"Промпт-инжиниринг для разработчика",
"TypeScript: основы",
"TypeScript в React",
"Vitest: unit-тесты для JS и React",
"Playwright: e2e-тесты для сайта",
"Telegram Mini Apps: веб-приложения в Telegram",
"PWA: установка сайта как приложение",
]

CH_NAMES = [
"Глава 1. Фундамент: как работает интернет","Глава 2. Дизайн: от брифа до макета",
"Глава 3. HTML — структура сайта","Глава 4. CSS — стилизация","Глава 5. JavaScript для сайтов",
"Глава 6. WordPress","Глава 7. WooCommerce — интернет-магазин","Глава 8. Запуск, SEO и право",
"Глава 9. Интеграции","Глава 10. Продвинутый уровень","Глава 11. Профессиональные навыки и бизнес",
"Глава 12. AI в разработке","Глава 13. Современные практики",
]
CH_DUR = ["~1 нед","4–6 нед","1.5–2 нед","3–4 нед","5–7 нед","4–5 нед","3–4 нед","3–4 нед","3–4 нед","8–12 нед","параллельно","1–2 нед","2–3 нед"]
CH_SIZES = [6,14,7,17,18,17,12,8,7,12,6,5,6]
CH_SHORT = ["Фундамент","Дизайн","HTML","CSS","JavaScript","WordPress","WooCommerce","Запуск","Интеграции","Продвинутый","Бизнес","AI","Modern"]

DIRS = [os.getcwd()] + [os.path.join(os.path.expanduser("~"), d)
        for d in ("Downloads","Загрузки","Desktop","OneDrive/Рабочий стол","OneDrive/Desktop")]


def find_one(name):
    for b in DIRS:
        if not os.path.isdir(b):
            continue
        for r, ds, fs in os.walk(b):
            if r[len(b):].count(os.sep) >= 4:
                ds[:] = []
                continue
            if name in fs:
                return os.path.join(r, name)
    return None


def find_pattern(pattern):
    rx = re.compile(pattern, re.I)
    out = {}
    for b in DIRS:
        if not os.path.isdir(b):
            continue
        for r, ds, fs in os.walk(b):
            if r[len(b):].count(os.sep) >= 4:
                ds[:] = []
                continue
            for f in fs:
                if rx.search(f):
                    out[f] = os.path.join(r, f)
    plain = sorted(p for f, p in out.items() if "(" not in f)
    duped = sorted(p for f, p in out.items() if "(" in f)
    return plain + duped


def read_q(text, pos):
    o, i = [], pos
    while i < len(text):
        c = text[i]
        if c == "\\" and i + 1 < len(text):
            o.append(text[i:i+2]); i += 2; continue
        if c == '"':
            return "".join(o), i + 1
        o.append(c); i += 1
    raise ValueError


def normalize_pre(content):
    """Внутри &lt;pre&gt; всё должно быть текстом: снимаем экранирование
    и накладываем его заново, чтобы примеры кода отображались как код."""
    def fix(m):
        inner = _html.unescape(m.group(1))
        inner = _html.escape(inner, quote=False)
        return "<pre>" + inner + "</pre>"
    return re.sub(r"<pre>(.*?)</pre>", fix, content, flags=re.DOTALL)


def parse_lessons(arr):
    starts = [m.start() for m in re.finditer(r'\{t:"', arr)]
    out = []
    for k, s in enumerate(starts):
        lim = starts[k+1] if k+1 < len(starts) else len(arr)
        try:
            title, j = read_q(arr, s + 4)
            mg = re.search(r',\s*g:"', arr[j:lim])
            if not mg:
                continue
            goal, k2 = read_q(arr, j + mg.end())
            mc = re.search(r',\s*c:`', arr[k2:lim])
            if not mc:
                continue
            cs = k2 + mc.end()
            ce = arr.rfind('`}', cs, lim)
            if ce == -1:
                ce = arr.rfind('`', cs, lim)
                if ce == -1:
                    continue
            out.append({"t": title, "g": goal, "c": normalize_pre(arr[cs:ce])})
        except Exception:
            continue
    return out


def load_var(path, varname):
    txt = open(path, encoding="utf-8").read()
    m = re.search(r'var\s+' + varname + r'\s*=\s*(\{.*?\})\s*;', txt, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception as e:
        print(f"   ⚠️  {os.path.basename(path)}: битый JSON ({e})")
        return None


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def main():
    print("🔨 Сборка данных для сайта\n")
    os.makedirs(DATA_DIR, exist_ok=True)

    # --- уроки ---
    print("📚 Уроки:")
    all_l = []
    for n in LESSON_FILES:
        p = find_one(n)
        if not p:
            print(f"   ✗ {n} — НЕ НАЙДЕН"); sys.exit(1)
        txt = open(p, encoding="utf-8").read()
        m = re.search(r'var\s+L\s*=\s*\[', txt)
        if not m:
            print(f"   ✗ {n} — нет массива var L"); sys.exit(1)
        end = txt.find("var cur", m.end())
        got = parse_lessons(txt[m.end()-1: end if end != -1 else len(txt)])
        print(f"   ✓ {n}: {len(got)}")
        all_l += got

    seen, uniq = set(), []
    for it in all_l:
        k = it["t"].strip().lower()
        if k in seen:
            continue
        seen.add(k); uniq.append(it)

    if len(uniq) != len(TITLES):
        print(f"   ⚠️  уроков {len(uniq)}, ожидалось {len(TITLES)}")

    bad = [i for i, (a, b) in enumerate(zip(TITLES, uniq), 1)
           if a.strip().lower() != b["t"].strip().lower()]
    if bad:
        print(f"   ⚠️  порядок нарушен: {bad}")
    else:
        print("   ✅ порядок верный")

    chapters, start = [], 1
    for i, (name, dur, size) in enumerate(zip(CH_NAMES, CH_DUR, CH_SIZES)):
        chapters.append({"name": name, "duration": dur, "size": size, "start": start})
        start += size

    write_json(os.path.join(DATA_DIR, "lessons.json"), {
        "total": len(uniq),
        "chapters": chapters,
        "lessons": uniq
    })
    print(f"   → site/data/lessons.json ({os.path.getsize(os.path.join(DATA_DIR,'lessons.json'))//1024} КБ)")

    # --- тесты по урокам ---
    print("\n🧪 Тесты по урокам:")
    quiz = {}
    for p in find_pattern(QUIZ_PATTERN):
        d = load_var(p, "QUIZ")
        if d:
            quiz.update({int(k): v for k, v in d.items()})
            print(f"   ✓ {os.path.basename(p)}: {len(d)}")
    write_json(os.path.join(DATA_DIR, "quizzes.json"), quiz)
    print(f"   → site/data/quizzes.json ({os.path.getsize(os.path.join(DATA_DIR,'quizzes.json'))//1024} КБ)")

    # --- большие тесты ---
    print("\n🧪 Большие тесты:")
    bq = {}
    for p in find_pattern(BLOCK_PATTERN):
        d = load_var(p, "BLOCK_QUIZ")
        if d:
            bq.update({int(k): v for k, v in d.items()})
            print(f"   ✓ {os.path.basename(p)}: {len(d)}")
    write_json(os.path.join(DATA_DIR, "block-quizzes.json"), bq)
    print(f"   → site/data/block-quizzes.json ({os.path.getsize(os.path.join(DATA_DIR,'block-quizzes.json'))//1024} КБ)")

    print("\n" + "="*52)
    print("✅ ДАННЫЕ ГОТОВЫ")
    print(f"   Уроков: {len(uniq)}")
    print(f"   Тестов по урокам: {len(quiz)} (всего {sum(len(v) for v in quiz.values())} вопросов)")
    print(f"   Больших тестов: {len(bq)} (всего {sum(len(v) for v in bq.values())} вопросов)")
    print("="*52)
    print("\n   Дальше: залей папку site/ на GitHub и подключи к Vercel.")


if __name__ == "__main__":
    main()
