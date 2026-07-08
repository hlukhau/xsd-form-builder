/** EDOCCODE SMAR: дополнительные сведения. */
export const SMAR_EDOCCODE_INFO = 'R.SM.SS.09.002'

/** EDOCCODE SMAR: сведения отсутствуют (ProcessingResultDetails). */
export const SMAR_EDOCCODE_ABSENT = 'R.006'

/** Код результата обработки: сведения отсутствуют (csdo:ProcessingResultV2Code). */
export const SMAR_ABSENT_PROCESSING_RESULT_CODE = '1'

export const PROCESSING_RESULT_CODE_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 — сведения отсутствуют' },
  { value: '2', label: '2 — сведения получены' },
  { value: '3', label: '3 — сведения добавлены' },
  { value: '4', label: '4 — сведения изменены' },
  { value: '5', label: '5 — сведения удалены' },
  { value: '6', label: '6 — сведения обработаны' },
]
