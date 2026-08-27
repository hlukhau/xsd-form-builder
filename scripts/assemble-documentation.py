#!/usr/bin/env python3
"""Собрать DOCUMENTATION.md из всех .md репозитория (единый файл)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PARTS: list[tuple[str, Path]] = [
    ('Обзор проекта', ROOT / 'README.md'),
    ('Сборка и деплой всех форм (актуально)', ROOT / 'docs' / 'BUILD_AND_DEPLOY.md'),
    ('EEC-rights (card_rigths)', ROOT / 'rights-service' / 'README.md'),
    ('Состав технологического ПО (п. 2.2)', ROOT / 'docs' / 'tech-stack-2.2.md'),
    ('Развёртывание на Tomcat (историческое, DPA)', ROOT / 'DEPLOYMENT.md'),
    ('Backend setup', ROOT / 'BACKEND_SETUP.md'),
    ('API documentation', ROOT / 'API_DOCUMENTATION.md'),
    ('Servlet API', ROOT / 'SERVLET_API.md'),
    ('Troubleshooting', ROOT / 'TROUBLESHOOTING.md'),
    ('Расположение логов', ROOT / 'LOGS_LOCATION.md'),
    ('Quick fix', ROOT / 'QUICK_FIX.md'),
    ('Deploy fix', ROOT / 'DEPLOY_FIX.md'),
    ('Rebuild required', ROOT / 'REBUILD_REQUIRED.md'),
    ('Загрузка зависимостей', ROOT / 'download-deps.md'),
    ('Ограничения полей XSD', ROOT / 'docs' / 'xsd-field-constraints.md'),
    ('Анализ XSD', ROOT / 'ANALYSIS.md'),
    ('Открытие всех версий', ROOT / 'docs' / 'OPEN_ALL_VERSIONS_OPTIONS.md'),
    ('План: партии и вкладки', ROOT / 'docs' / 'plan-batches-tabs.md'),
    ('Карты (src/cards)', ROOT / 'src' / 'cards' / 'README.md'),
    ('Summary', ROOT / 'SUMMARY.md'),
]


def demote_headings(text: str, levels: int = 2) -> str:
    out: list[str] = []
    for line in text.splitlines():
        m = re.match(r'^(#{1,6})(\s+)(.*)$', line)
        if m:
            hashes, sp, rest = m.group(1), m.group(2), m.group(3)
            n = min(6, len(hashes) + levels)
            out.append('#' * n + sp + rest)
        else:
            out.append(line)
    return '\n'.join(out)


def main() -> None:
    toc: list[str] = []
    body: list[str] = []
    for i, (title, path) in enumerate(PARTS, 1):
        if not path.exists():
            raise SystemExit(f'Missing: {path}')
        raw = path.read_text(encoding='utf-8').lstrip('\ufeff').strip() + '\n'
        # Avoid nesting the pointer to DOCUMENTATION.md from README endlessly
        if path.name == 'README.md':
            raw = re.sub(
                r'\*\*Вся документация в одном файле:\*\*.*\n(?:.*\n)?',
                '',
                raw,
                count=1,
            )
        content = demote_headings(raw, levels=2)
        anchor = re.sub(r'[^\w\-а-яА-ЯёЁ]+', '-', title.lower(), flags=re.I).strip('-')
        rel = path.relative_to(ROOT)
        toc.append(f'{i}. [{title}](#{anchor}) — `{rel}`')
        body.append(f'\n---\n\n## {title}\n\n<!-- source: {rel} -->\n\n{content}\n')

    header = f'''# Документация xsd-form-builder (единый файл)

Сводная документация по подсистеме веб-карт сведений ЕЭК: обзор, **сборка и деплой**, EEC-rights, стек, API, диагностика, XSD.

**Важно:** сервис **EEC-rights** (`card_rigths`) должен быть залит и стартовать **первым**; карты — после проверки `/card_rigths/health`. См. раздел «Сборка и деплой всех форм».

Собрано из исходных `.md` репозитория. Пересборка: `python3 scripts/assemble-documentation.py`.

## Оглавление

''' + '\n'.join(toc) + '\n'

    out = ROOT / 'DOCUMENTATION.md'
    out.write_text(header + ''.join(body), encoding='utf-8')
    lines = len(out.read_text(encoding='utf-8').splitlines())
    print(f'Wrote {out} ({out.stat().st_size} bytes, {lines} lines)')


if __name__ == '__main__':
    main()
