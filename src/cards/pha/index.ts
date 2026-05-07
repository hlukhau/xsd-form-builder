/**
 * Карта сведений об обнаружении болезней (PHA).
 * Таблицы: PHA (PHAID, ...), PHAXML (PHAID, PHAXMLBODY, EDOCCODE, EDOCVERSION).
 * Путь приложения: /pha_card/{PHAID}/{GUID}
 * API: /api/pha/xml, /api/pha/metadata и др. (собственные сервлеты и справочники).
 */
export { default as PhaCard } from './PhaCard'
