import type { CardData } from '@/types/card'

const DEFAULT_INCIDENT_KIND_CODE = '7'
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
 * - Регистрационный номер: по правилу [Страна]-DP[5 цифр]-[Год]
 * - Код страны: из параметра (нередактируемое)
 * - Вид уведомления: IncidentKindCode = 7
 * - Дата формирования: текущая дата (нередактируемое)
 */
export function createNewCardData(
  countryCode: string = 'BY',
  serialInYear: string = DEFAULT_SERIAL_IN_YEAR
): CardData {
  const now = new Date()
  const formationDate = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const documentDateTime = now.toISOString() // ISO 8601
  const registrationNumber = buildNewRegistrationNumber(countryCode, serialInYear)
  const country = countryCode.toUpperCase().slice(0, 2)

  return {
    country,
    registrationNumber,
    version: 1,
    source: 'входящие',
    createdAt: documentDateTime,
    modifiedAt: documentDateTime,
    status: 'новое',

    electronicDocument: {
      messageCode: '',
      documentCode: '',
      documentId: '',
      documentDate: documentDateTime,
      language: 'ru',
      sourceDocumentId: '',
      validityPeriod: { start: '', end: '' },
      updateDateTime: documentDateTime,
    },

    notification: {
      country,
      registrationNumber,
      type: DEFAULT_INCIDENT_KIND_CODE, // smsdo:IncidentKindCode = 7
      formationDate, // csdo:DocCreationDate
      endDate: null,
      authorizedBody: {
        country: '',
        identifier: '',
        name: '',
        shortName: '',
      },
    },

    statusHistory: [],
    accessList: [],
  }
}
