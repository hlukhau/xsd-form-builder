/**
 * Конфигурация кнопки смены статуса по источнику карты и текущему статусу.
 * Логика по DPASTATUSID (таблица DPASTATUS). При отсутствии statusId — запасная проверка по названию.
 * Входящие (1–4): PROCESSING→Завершение обработки, PROCESSED→Закрытие карты.
 * Исходящие (5–13): DRAFT/NEW→резолюция, NEW/PENDING/FAILED/ERROR/EDITED→Направление/Закрытие, DELIVERED→Закрытие.
 */
export interface StatusButtonConfig {
  label: string
  action: string
  hint?: string
  disabled?: boolean
}

/** DPASTATUSID: входящие 1–4, исходящие 5–13 (DRAFT=5, NEW=6, PENDING=7, SENT=8, FAILED=9, ERROR=10, DELIVERED=11, EDITED=12, COMPLETED=13) */
const INCOMING_PROCESSING = 2
const INCOMING_PROCESSED = 3
const OUTGOING_DRAFT = 5
const OUTGOING_NEW = 6
const OUTGOING_PENDING = 7
const OUTGOING_FAILED = 9
const OUTGOING_ERROR = 10
const OUTGOING_DELIVERED = 11
const OUTGOING_EDITED = 12

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function incomingStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasRight: boolean
): StatusButtonConfig | null {
  if (!hasRight) return null
  if (statusId === INCOMING_PROCESSING) return { label: 'Завершение обработки', action: 'complete_processing' }
  if (statusId === INCOMING_PROCESSED) return { label: 'Закрытие карты', action: 'close' }
  const s = norm(status)
  if (s.includes('в обработке')) return { label: 'Завершение обработки', action: 'complete_processing' }
  if (s.includes('обработано') && !s.includes('завершено')) return { label: 'Закрытие карты', action: 'close' }
  return null
}

/** Подсказка, когда для действия нужна уже наложенная резолюция */
const NO_RESOLUTION_HINT =
  'Для выполнения действия необходима соответствующая резолюция (районного, областного или республиканского ЦГЭ).'

/** Текст кнопки наложения резолюции по уровню пользователя (DEPKINDCODE) */
function getResolutionButtonLabel(depKindCode: string | null | undefined): string {
  if (!depKindCode) return 'Отметка готовности'
  const c = depKindCode.trim().toLowerCase()
  if (c === 'dep0601') return 'Резолюция районного ЦГЭ'
  if (c === 'dep0602') return 'Резолюция областного ЦГЭ'
  if (c === 'dep0603') return 'Резолюция республиканского ЦГЭ'
  return 'Отметка готовности'
}

function outgoingStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  hasResolution: boolean,
  userDepKindCode: string | null | undefined,
  existingResolutionDepKindCodes: string[] | undefined
): StatusButtonConfig | null {
  if (!hasStatusRight && !hasSendRight) return null
  const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
  const hasResolutionOfUserLevel =
    userDepKindCode &&
    Array.isArray(existingResolutionDepKindCodes) &&
    existingResolutionDepKindCodes.some((c) => norm(c) === norm(userDepKindCode))

  // По DPASTATUSID (исходящие 5–13)
  if (statusId === OUTGOING_DRAFT) {
    if (!hasStatusRight) return null
    return { label: resolutionLabel, action: 'mark_ready' }
  }
  if (statusId === OUTGOING_NEW) {
    if (hasStatusRight && !hasResolutionOfUserLevel) return { label: resolutionLabel, action: 'mark_ready' }
    if (hasStatusRight && hasResolutionOfUserLevel) {
      if (hasSendRight) return { label: 'Направление сведений', action: 'send' }
      return { label: 'Закрытие карты', action: 'close' }
    }
    if (!hasResolution) {
      return {
        label: hasSendRight ? 'Направление сведений' : 'Закрытие карты',
        action: hasSendRight ? 'send' : 'close',
        hint: NO_RESOLUTION_HINT,
        disabled: true,
      }
    }
    if (hasSendRight) return { label: 'Направление сведений', action: 'send' }
    if (hasStatusRight) return { label: 'Закрытие карты', action: 'close' }
  }
  if (
    statusId === OUTGOING_PENDING ||
    statusId === OUTGOING_FAILED ||
    statusId === OUTGOING_ERROR ||
    statusId === OUTGOING_EDITED
  ) {
    if (!hasResolution) {
      return { label: 'Направление сведений', action: 'send', hint: NO_RESOLUTION_HINT, disabled: true }
    }
    if (hasSendRight) return { label: 'Направление сведений', action: 'send' }
    if (hasStatusRight) return { label: 'Закрытие карты', action: 'close' }
  }
  if (statusId === OUTGOING_DELIVERED) {
    if (!hasStatusRight) return null
    if (!hasResolution) {
      return { label: 'Закрытие карты', action: 'close', hint: NO_RESOLUTION_HINT, disabled: true }
    }
    return { label: 'Закрытие карты', action: 'close' }
  }
  if (statusId === 8 || statusId === 13) return null // SENT, COMPLETED — кнопки нет

  // Запасная проверка по названию (карты без statusId, например из XML)
  const s = norm(status)
  if (s.includes('черновик') || s.includes('создан')) {
    if (!hasStatusRight) return null
    return { label: resolutionLabel, action: 'mark_ready' }
  }
  if (s.includes('новое') || s.includes('новая') || s === 'новый') {
    if (hasStatusRight && !hasResolutionOfUserLevel) return { label: resolutionLabel, action: 'mark_ready' }
    if (hasStatusRight && hasResolutionOfUserLevel) {
      if (hasSendRight) return { label: 'Направление сведений', action: 'send' }
      return { label: 'Закрытие карты', action: 'close' }
    }
    if (!hasResolution) {
      return {
        label: hasSendRight ? 'Направление сведений' : 'Закрытие карты',
        action: hasSendRight ? 'send' : 'close',
        hint: NO_RESOLUTION_HINT,
        disabled: true,
      }
    }
    if (hasSendRight) return { label: 'Направление сведений', action: 'send' }
    if (hasStatusRight) return { label: 'Закрытие карты', action: 'close' }
  }
  if (
    s.includes('ожидает отправки') ||
    s.includes('отправка не удалась') ||
    s.includes('ошибка обработки') ||
    s.includes('отредактировано')
  ) {
    if (!hasResolution) {
      return { label: 'Направление сведений', action: 'send', hint: NO_RESOLUTION_HINT, disabled: true }
    }
    if (hasSendRight) return { label: 'Направление сведений', action: 'send' }
    if (hasStatusRight) return { label: 'Закрытие карты', action: 'close' }
  }
  if (s.includes('доставлено')) {
    if (!hasStatusRight) return null
    if (!hasResolution) {
      return { label: 'Закрытие карты', action: 'close', hint: NO_RESOLUTION_HINT, disabled: true }
    }
    return { label: 'Закрытие карты', action: 'close' }
  }
  return null
}

export function getStatusButtonConfig(
  source: string | undefined,
  status: string | undefined,
  hasStatusRight: boolean,
  hasSendRight?: boolean,
  hasResolution?: boolean,
  userDepKindCode?: string | null,
  existingResolutionDepKindCodes?: string[],
  statusId?: number | null
): StatusButtonConfig | null {
  const src = norm(source)
  if (src.includes('еэк')) return null
  if (src.includes('входящ')) {
    return incomingStatusButton(statusId, status ?? '', hasStatusRight)
  }
  if (src.includes('исходящ')) {
    return outgoingStatusButton(
      statusId,
      status ?? '',
      hasStatusRight,
      hasSendRight ?? false,
      hasResolution ?? false,
      userDepKindCode ?? null,
      existingResolutionDepKindCodes ?? []
    )
  }
  return null
}
