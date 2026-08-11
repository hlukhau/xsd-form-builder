import type { SmaIncidentAlert } from '@/types/smaCard'

const INCIDENT_INCOMPLETE_MSG =
  'Для уведомления о нежелательной ситуации должны быть заполнены Страна, Регистрационный номер, Вид и Дата'

/** Если блок уведомления начат (есть хотя бы одно поле) — все поля обязательны. */
export function validateSmaIncidentAlertComplete(
  alert: SmaIncidentAlert | null | undefined
): string | null {
  if (!alert) return null
  const country = (alert.country ?? '').trim()
  const reg = (alert.registrationNumber ?? '').trim()
  const typeCode = (alert.typeCode ?? '').trim()
  const date = (alert.formationDate ?? '').trim()
  const hasAny = Boolean(country || reg || typeCode || date)
  if (!hasAny) return null
  if (country && reg && typeCode && date) return null
  return INCIDENT_INCOMPLETE_MSG
}

export function validateSmaqRequiredFields(opts: {
  descriptionText: string | null | undefined
  authorityName: string | null | undefined
}): string | null {
  if (!(opts.authorityName ?? '').trim()) {
    return 'Заполните наименование уполномоченного органа'
  }
  if (!(opts.descriptionText ?? '').trim()) {
    return 'Заполните описание запроса'
  }
  return null
}
