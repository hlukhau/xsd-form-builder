/**
 * Формат отображения дат в UI: через точку (dd.mm.yyyy).
 * В XML и при сохранении используется yyyy-MM-dd.
 */
export const DATE_DISPLAY_FORMAT = 'DD.MM.YYYY'

/**
 * Формат отображения даты-времени в UI: dd.mm.yyyy hh:mm:ss.
 * В XML сохраняется yyyy-MM-ddThh:mm:ss (при необходимости с дробной частью секунд).
 */
export const DATE_TIME_DISPLAY_FORMAT = 'DD.MM.YYYY HH:mm:ss'
/** То же для date-fns (строчные dd, mm, yyyy, HH, mm, ss). */
export const DATE_TIME_DISPLAY_FORMAT_DATEFNS = 'dd.MM.yyyy HH:mm:ss'
