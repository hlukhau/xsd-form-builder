/**
 * Конфигурация кнопки смены статуса по источнику карты и текущему статусу.
 * Для сведений из БД ЕЭК (DATASOURCEKINDCODE = 3, «Данные ЕЭК») статусная модель не используется — кнопка не показывается.
 * Входящие: Завершение обработки, Закрытие карты. Исходящие: Отметка готовности, Направление сведений, Закрытие карты.
 */
export interface StatusButtonConfig {
  label: string
  action: string
  /** Подсказка, когда кнопка недоступна (например, нет соответствующей резолюции) */
  hint?: string
  /** Недоступна (например, нет резолюции районного/областного ЦГЭ) */
  disabled?: boolean
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function incomingStatusButton(status: string, hasRight: boolean): StatusButtonConfig | null {
  if (!hasRight) return null
  const s = norm(status)
  if (s.includes('в обработке') || s === 'в обработке') {
    return { label: 'Завершение обработки', action: 'complete_processing' }
  }
  if (s.includes('обработано') && !s.includes('завершено')) {
    return { label: 'Закрытие карты', action: 'close' }
  }
  return null
}

const NO_RESOLUTION_HINT =
  'Для выполнения действия необходима соответствующая резолюция (районного или областного ЦГЭ).'

function outgoingStatusButton(
  status: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  hasResolution: boolean
): StatusButtonConfig | null {
  const s = norm(status)
  if (!hasStatusRight && !hasSendRight) return null
  // Черновик → Отметка готовности (нужна резолюция после выполнения — для отображения кнопки резолюция не блокирует)
  if (s.includes('черновик') || s === 'черновик') {
    if (!hasStatusRight) return null
    return { label: 'Отметка готовности', action: 'mark_ready' }
  }
  // Новое (с резолюциями) → нужна резолюция для любого действия
  if (s.includes('новое') || s === 'новое') {
    if (!hasResolution) {
      return {
        label: 'Отметка готовности',
        action: 'mark_ready',
        hint: NO_RESOLUTION_HINT,
        disabled: true,
      }
    }
    if (hasStatusRight) return { label: 'Отметка готовности', action: 'mark_ready' }
    if (hasSendRight) return { label: 'Направление сведений', action: 'send' }
    if (hasStatusRight) return { label: 'Закрытие карты', action: 'close' }
  }
  // Ожидает отправки, Отправка не удалась, Ошибка обработки, Отредактировано
  if (
    s.includes('ожидает отправки') ||
    s.includes('отправка не удалась') ||
    s.includes('ошибка обработки') ||
    s.includes('отредактировано')
  ) {
    if (!hasResolution) {
      return {
        label: 'Направление сведений',
        action: 'send',
        hint: NO_RESOLUTION_HINT,
        disabled: true,
      }
    }
    if (hasSendRight) return { label: 'Направление сведений', action: 'send' }
    if (hasStatusRight) return { label: 'Закрытие карты', action: 'close' }
  }
  // Доставлено → Закрытие карты
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
  hasResolution?: boolean
): StatusButtonConfig | null {
  const src = norm(source)
  if (src.includes('еэк')) return null
  if (src.includes('входящ')) {
    return incomingStatusButton(status ?? '', hasStatusRight)
  }
  if (src.includes('исходящ')) {
    return outgoingStatusButton(
      status ?? '',
      hasStatusRight,
      hasSendRight ?? false,
      hasResolution ?? false
    )
  }
  return null
}
