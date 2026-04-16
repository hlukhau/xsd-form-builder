#!/usr/bin/env python3
"""Копирует DPA-сервлеты → PPV: пакет, классы, таблицы PPV/PPVXML/…, поля PPVID/PPVVERSION/…; справочник DPASTATUS без переименования."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "src/main/java/com/eec/servlet/dpa"
DST_DIR = ROOT / "src/main/java/com/eec/servlet/ppv"


def transform_java(content: str) -> str:
    s = content
    s = s.replace("package com.eec.servlet.dpa;", "package com.eec.servlet.ppv;")
    s = re.sub(r"\bclass (Dpa)(\w+)\b", r"class Ppv\2", s)
    s = re.sub(r"\b(Dpa)(\w+Servlet)\b", r"Ppv\2", s)
    s = s.replace("[Dpa", "[Ppv")

    pairs = [
        ("DPAXMLBODY", "PPVXMLBODY"),
        ("DPADEPPERMIS", "PPVDEPPERMIS"),
        ("DPASTATUSHIST", "PPVSTATUSHIST"),
        ("DPARESOLUTION", "PPVRESOLUTION"),
        ("VW_DPA", "VW_PPV"),
        ("DPAXML", "PPVXML"),
        ("SQDPA", "SQPPV"),
        ("DPA_FK", "PPV_FK"),
    ]
    for a, b in pairs:
        s = s.replace(a, b)

    s = re.sub(r"\bFROM DPA\b", "FROM PPV", s)
    s = re.sub(r"\bINTO DPA\b", "INTO PPV", s)
    s = re.sub(r"\bUPDATE DPA\b", "UPDATE PPV", s)
    s = re.sub(r"\bJOIN DPA\b", "JOIN PPV", s)
    s = re.sub(r"\bLEFT JOIN DPA\b", "LEFT JOIN PPV", s)

    s = re.sub(r"\bvw\.DPAID\b", "vw.PPVID", s)
    s = re.sub(r"\bvw\.DPAVERSION\b", "vw.PPVVERSION", s)
    s = re.sub(r"\bvw\.DPASTATUSID\b", "vw.PPVSTATUSID", s)
    s = re.sub(r"\bvw\.DPASTATUSNAME\b", "vw.PPVSTATUSNAME", s)
    s = re.sub(r"\bd\.DPAID\b", "d.PPVID", s)

    s = re.sub(r"\bDPAID\b", "PPVID", s)

    # Ответ save: отдаём и ppvid, и dpaid (одинаковое число) — фронт DPA/PPV
    s = s.replace('"success":true,"ppvid":', '"success":true,"ppvid":')
    s = re.sub(
        r'print\("\\"success\\":true,\\"ppvid\\":"\s*\+\s*(\w+)\s*\+\s*""\)',
        r'print("\\"success\\":true,\\"ppvid\\":" + \1 + ",\\"dpaid\\":" + \1 + "")',
        s,
    )
    # Частый паттерн: "success":true,"dpaid:"+dpaid
    s = re.sub(
        r'"success":true,"dpaid":\s*\+\s*(\w+)',
        r'"success":true,"ppvid":+" + \1 + ",\"dpaid\":" + \1',
        s,
    )
    # Проще: заменить только ключ в success JSON вручную в PpvSaveServlet после генерации

    # Тексты ошибок /api/dpa → /api/ppv
    s = s.replace("/api/dpa/", "/api/ppv/")
    s = s.replace("api/dpa/", "api/ppv/")

    return s


def main() -> None:
    DST_DIR.mkdir(parents=True, exist_ok=True)
    for src in sorted(SRC_DIR.glob("*.java")):
        dst = DST_DIR / src.name.replace("Dpa", "Ppv")
        dst.write_text(transform_java(src.read_text(encoding="utf-8")), encoding="utf-8")
        print(dst.relative_to(ROOT))


if __name__ == "__main__":
    main()
