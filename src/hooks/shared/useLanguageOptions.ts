/**
 * Справочник языков ISO 639-1
 * Статический справочник, так как языки не меняются часто
 */
const LANGUAGE_MAP: Record<string, string> = {
  'ru': 'Русский',
  'en': 'Английский',
  'by': 'Белорусский',
  'kk': 'Казахский',
  'ky': 'Киргизский',
  'hy': 'Армянский',
  'az': 'Азербайджанский',
  'ka': 'Грузинский',
  'mo': 'Молдавский',
  'uk': 'Украинский',
  'de': 'Немецкий',
  'fr': 'Французский',
  'es': 'Испанский',
  'it': 'Итальянский',
  'pt': 'Португальский',
  'zh': 'Китайский',
  'ja': 'Японский',
  'ko': 'Корейский',
  'ar': 'Арабский',
  'tr': 'Турецкий',
  'pl': 'Польский',
  'cs': 'Чешский',
  'sk': 'Словацкий',
  'bg': 'Болгарский',
  'ro': 'Румынский',
  'hu': 'Венгерский',
  'fi': 'Финский',
  'sv': 'Шведский',
  'no': 'Норвежский',
  'da': 'Датский',
  'nl': 'Нидерландский',
  'el': 'Греческий',
  'he': 'Иврит',
  'th': 'Тайский',
  'vi': 'Вьетнамский',
  'id': 'Индонезийский',
  'ms': 'Малайский',
  'hi': 'Хинди',
  'bn': 'Бенгальский',
  'ta': 'Тамильский',
  'te': 'Телугу',
  'mr': 'Маратхи',
  'gu': 'Гуджарати',
  'kn': 'Каннада',
  'ml': 'Малайалам',
  'pa': 'Панджаби',
  'or': 'Ория',
  'as': 'Ассамский',
  'ne': 'Непальский',
  'si': 'Сингальский',
  'my': 'Бирманский',
  'km': 'Кхмерский',
  'lo': 'Лаосский',
  'am': 'Амхарский',
  'sw': 'Суахили',
  'yo': 'Йоруба',
  'ig': 'Игбо',
  'ha': 'Хауса',
  'so': 'Сомали',
  'om': 'Оромо',
  'ti': 'Тигринья',
  'rw': 'Киньяруанда',
  'rn': 'Рунди',
  'sn': 'Шона',
  'st': 'Сесото',
  'tn': 'Тсвана',
  've': 'Венда',
  'ts': 'Тсонга',
  'ss': 'Свати',
  'nr': 'Ндебеле',
  'nso': 'Северный сото',
}

export function getLanguageName(code: string | undefined): string {
  if (!code) return '-'
  return LANGUAGE_MAP[code.toLowerCase()] || code.toUpperCase()
}

/** Опции «язык» в формате ТЗ: LANGALPHA2CODE-LANGNAME (каталог LANG; записи актуальности API пока нет — все элементы статического набора). */
export function getLangCatalogSelectOptions(): Array<{ value: string; label: string }> {
  return Object.entries(LANGUAGE_MAP)
    .map(([code, name]) => ({
      value: code,
      label: `${code.toUpperCase()}-${name}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

export function useLanguageOptions() {
  return {
    getLanguageName,
    getLangCatalogSelectOptions,
  }
}

