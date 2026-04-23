import type { CardData } from '@/types/card'

/** PHA: новая карта сразу в статусе «Новое» (PHASTATUS.PHASTATUSID = 5), без «Черновик». */
export const PHA_NEW_STATUS_ID = 5
export const PHA_NEW_STATUS_NAME = 'Новое' as const

/** DPA (опасная продукция), версия 1 — вид уведомления по умолчанию */
const DEFAULT_INCIDENT_KIND_CODE_DPA = '7'
/** PPV (выявленные нарушения), создаваемая карта — вид уведомления всегда 19 */
const DEFAULT_INCIDENT_KIND_CODE_PPV = '19'
const DEFAULT_SERIAL_IN_YEAR = '00001'

/**
 * Формирует регистрационный номер новой карты по правилу:
 * [Код страны (2 буквы)]-[DP][Порядковый номер 5 знаков]-[Две последние цифры года].
 * Пример: BY-DP00001-25
 */
export function buildNewRegistrationNumber(
  countryCode: string,
  serialInYear: string = DEFAULT_SERIAL_IN_YEAR
): string {
  const code = (countryCode || 'BY').toUpperCase().slice(0, 2)
  const serial = String(serialInYear).padStart(5, '0').slice(0, 5)
  const year2 = String(new Date().getFullYear()).slice(-2)
  return `${code}-DP${serial}-${year2}`
}

/**
 * Создаёт предзаполненные данные для новой карты (режим создания по ссылке с ? вместо DPAID).
 * - Регистрационный номер: из options.registrationNumber (уникальный с бэкенда) или по правилу [Страна]-DP[5 цифр]-[Год]
 * - Код страны: из параметра
 * - Вид уведомления: DPA — IncidentKindCode = 7; PPV — 19
 * - Дата формирования: текущая дата
 * - Статус: для DPA — «Черновик» (DPASTATUS); для PHA — сразу «Новое», PHASTATUSID = 5 (черновика нет).
 */
export function createNewCardData(
  countryCode: string = 'BY',
  serialOrOptions?: string | { serialInYear?: string; registrationNumber?: string },
  options?: { forPha?: boolean; forPpv?: boolean }
): CardData {
  const now = new Date()
  const formationDate = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const documentDateTime = now.toISOString() // ISO 8601
  const forPha = options?.forPha === true
  const forPpv = options?.forPpv === true
  const country = forPha ? 'BY' : countryCode.toUpperCase().slice(0, 2)
  const defaultIncidentKind = forPha ? '' : forPpv ? DEFAULT_INCIDENT_KIND_CODE_PPV : DEFAULT_INCIDENT_KIND_CODE_DPA
  const registrationNumber =
    typeof serialOrOptions === 'object' && serialOrOptions?.registrationNumber
      ? serialOrOptions.registrationNumber
      : buildNewRegistrationNumber(
          countryCode,
          typeof serialOrOptions === 'object' ? serialOrOptions?.serialInYear : serialOrOptions
        )

  return {
    country,
    registrationNumber,
    version: 1,
    source: 'исходящие',
    createdAt: documentDateTime,
    modifiedAt: documentDateTime,
    ...(forPha
      ? { status: PHA_NEW_STATUS_NAME, statusId: PHA_NEW_STATUS_ID }
      : { status: 'Черновик' as const, statusId: 5 }), // DPA: черновик исходящих. PHA: см. PHA_NEW_STATUS_*.

    electronicDocument: {
      messageCode: forPha ? 'token' : '',
      documentCode: forPha ? 'R.SM.SS.08.001' : '',
      documentId: forPha ? 'token' : '',
      documentDate: documentDateTime,
      language: 'ru',
      sourceDocumentId: '',
      validityPeriod: { start: '', end: '' },
      updateDateTime: documentDateTime,
    },

    notification: {
      country,
      registrationNumber,
      type: defaultIncidentKind,
      formationDate, // csdo:DocCreationDate
      endDate: null,
      authorizedBody: {
        country: forPha ? 'BY' : '',
        identifier: '',
        name: '',
        shortName: '',
      },
    },

    statusHistory: [],
    accessList: [],
  }
}
