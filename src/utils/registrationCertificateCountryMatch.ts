/**
 * Свидетельство о регистрации (DocKindCode=25): первые 2 символа csdo:DocId
 * должны совпадать с csdo:UnifiedCountryCode уполномоченного органа.
 */

export const REGISTRATION_CERTIFICATE_DOC_KIND_CODE = '25'

export const LAB_PROTOCOLS_DOC_ID_COUNTRY_MISMATCH_WARNING =
  'Номер документа не соотносится с Кодом страны уполномоченного органа'

export const REGISTRATION_CERTIFICATE_COUNTRY_MISMATCH_REMARK =
  'Для каждого свидетельства о регистрации код страны УО должен совпадать с первыми двумя символами в номере свидетельства'

/** true, если оба значения заданы и префикс номера совпадает с кодом страны (без учёта регистра). */
export function registrationCertificateDocIdMatchesAuthorityCountry(
  docId: string | null | undefined,
  authorityCountryCode: string | null | undefined
): boolean {
  const id = (docId ?? '').trim()
  const cc = (authorityCountryCode ?? '').trim()
  if (!id || !cc) return true
  if (id.length < 2) return false
  return id.slice(0, 2).toUpperCase() === cc.slice(0, 2).toUpperCase()
}

export function isRegistrationCertificateDocKind(docKindCode: string | null | undefined): boolean {
  return (docKindCode ?? '').trim() === REGISTRATION_CERTIFICATE_DOC_KIND_CODE
}
