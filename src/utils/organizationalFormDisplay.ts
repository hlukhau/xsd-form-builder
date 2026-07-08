/** Справочник LEGALFORM (организационно-правовая форма), codeListId в XML. */
export const LEGAL_FORM_CODE_LIST_ID = '2049'

export interface OrganizationalFormSource {
  organizationalForm?: string
  businessEntityTypeCode?: string
  businessEntityTypeCodeListId?: string
  businessEntityTypeName?: string
}

/** Подпись ОПФ для просмотра: справочник (код — наименование) или свободный текст. */
export function formatOrganizationalFormLabel(
  source: OrganizationalFormSource | undefined | null,
  getLegalFormNameByCode?: (code: string) => string | null
): string {
  if (!source) return '-'
  const isFromRef = !!(
    source.businessEntityTypeCode?.trim() &&
    source.businessEntityTypeCodeListId === LEGAL_FORM_CODE_LIST_ID
  )
  if (isFromRef && source.businessEntityTypeCode) {
    const code = source.businessEntityTypeCode.trim()
    const name = getLegalFormNameByCode?.(code)
    return name ? `${code} — ${name}` : code
  }
  const manual = (source.organizationalForm ?? source.businessEntityTypeName ?? '').trim()
  return manual || '-'
}
