/**
 * В SanitaryMeasureBaseDetails элемент StartDate обязателен по XSD. При пустом поле в форме
 * в XML подставляется эта дата; при разборе XML она снова считается «дата не указана».
 * Не использовать как осмысленную дату начала меры.
 */
export const SANITARY_MEASURE_START_DATE_XML_PLACEHOLDER = '1900-01-01'
