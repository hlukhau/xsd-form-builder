import type { StatusButtonConfig, StatusButtonResult } from '@/utils/statusButtonConfig'

const HINT_NO_STATUS_RIGHT_IN =
  'Недостаточно прав: для смены статуса требуется право sanitaryMeasureIn:status в пределах подразделения с доступом к карте.'
const HINT_NO_STATUS_RIGHT_OUT =
  'Недостаточно прав: для закрытия карты требуется право sanitaryMeasureOut:status в пределах подразделения с доступом к карте.'

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

const CLOSE_CFG = (hint: string, disabled = false): StatusButtonConfig => ({
  label: 'Закрытие карты',
  action: 'close',
  hint,
  disabled,
})

/** Кнопка смены статуса для входящей карты SMD. */
export function incomingSmdStatusButton(
  statusCode: string | null | undefined,
  statusName: string | null | undefined,
  canComplete: boolean,
  completeDeniedReason?: string | null,
  canClose?: boolean,
  closeDeniedReason?: string | null
): StatusButtonResult {
  const code = (statusCode ?? '').trim().toUpperCase()
  const s = norm(statusName)

  if (code === 'COMPLETED' || s.includes('заверш')) {
    return {
      config: null,
      comment: 'Карта в статусе «Завершено»; дальнейшие переходы не предусмотрены.',
    }
  }

  if (code === 'RECEIVED' || (s.includes('получен') && !s.includes('обработ'))) {
    return {
      config: null,
      comment:
        'Статус «Получено»: при первичном открытии карты выполняется автоматический переход в «В обработке».',
    }
  }

  const isProcessing = code === 'PROCESSING' || (s.includes('обработке') && !s.includes('обработано'))
  if (isProcessing) {
    if (!canComplete) {
      return {
        config: {
          label: 'Завершение обработки',
          action: 'complete_processing',
          disabled: true,
          hint: completeDeniedReason?.trim() || HINT_NO_STATUS_RIGHT_IN,
        },
        comment: completeDeniedReason?.trim() || HINT_NO_STATUS_RIGHT_IN,
      }
    }
    return {
      config: {
        label: 'Завершение обработки',
        action: 'complete_processing',
        hint: 'Переход карты в статус «Обработано».',
        disabled: false,
      },
      comment: 'Переход карты в статус «Обработано».',
    }
  }

  const isProcessed = code === 'PROCESSED' || (s.includes('обработано') && !s.includes('заверш'))
  if (isProcessed) {
    if (!canClose) {
      return {
        config: CLOSE_CFG(closeDeniedReason?.trim() || HINT_NO_STATUS_RIGHT_IN, true),
        comment: closeDeniedReason?.trim() || HINT_NO_STATUS_RIGHT_IN,
      }
    }
    return {
      config: CLOSE_CFG('Переход карты в статус «Завершено».'),
      comment: 'Переход карты в статус «Завершено».',
    }
  }

  return {
    config: null,
    comment: 'Кнопка смены статуса не отображается: для текущего статуса входящей карты переход не предусмотрен.',
  }
}

/** Исходящие SMD: закрытие из NEW, FAILED, ERROR, DELIVERED. */
export function smdOutgoingCloseAllowed(statusCode: string | null | undefined, statusName?: string | null): boolean {
  const code = (statusCode ?? '').trim().toUpperCase()
  if (code === 'NEW' || code === 'FAILED' || code === 'ERROR' || code === 'DELIVERED') return true
  const s = norm(statusName ?? '')
  if (s.includes('заверш')) return false
  if (s.includes('новое') && !s.includes('ожидает')) return true
  if (s.includes('не удалась')) return true
  if (s.includes('ошибка обработки')) return true
  if (s.includes('доставлено')) return true
  return false
}

/** Кнопки смены статуса для исходящей карты SMD (закрытие; направление — отдельная кнопка). */
export function outgoingSmdStatusButton(
  statusCode: string | null | undefined,
  statusName: string | null | undefined,
  canClose: boolean,
  closeDeniedReason?: string | null
): StatusButtonResult {
  const code = (statusCode ?? '').trim().toUpperCase()
  const s = norm(statusName)

  if (code === 'COMPLETED' || s.includes('заверш')) {
    return {
      config: null,
      comment: 'Карта в статусе «Завершено»; дальнейшие переходы не предусмотрены.',
    }
  }

  if (code === 'PENDING' || s.includes('ожидает отправки')) {
    return {
      config: null,
      comment: 'Статус «Ожидает отправки»; закрытие карты в этом статусе не предусмотрено.',
    }
  }

  if (code === 'SENT' || s === 'отправлено') {
    return {
      config: null,
      comment: 'Статус «Отправлено»; закрытие карты в этом статусе не предусмотрено.',
    }
  }

  if (!smdOutgoingCloseAllowed(code, statusName)) {
    return {
      config: null,
      comment: 'Кнопка закрытия карты не отображается: для текущего статуса исходящей карты переход не предусмотрен.',
    }
  }

  if (!canClose) {
    const hint = closeDeniedReason?.trim() || HINT_NO_STATUS_RIGHT_OUT
    return {
      config: CLOSE_CFG(hint, true),
      comment: hint,
    }
  }

  const closeHint = 'Переход карты в статус «Завершено».'
  const isDelivered = code === 'DELIVERED' || s.includes('доставлено')
  if (isDelivered) {
    return {
      config: CLOSE_CFG(closeHint),
      comment: closeHint,
    }
  }

  return {
    config: null,
    closeConfig: CLOSE_CFG(closeHint),
    comment: 'Доступно закрытие карты.',
  }
}

export function isSmdIncomingSource(source: string | undefined, code?: string | null): boolean {
  if (String(code ?? '').trim() === '1') return true
  return (source ?? '').toLowerCase().includes('входящ')
}

export function isSmdOutgoingSource(source: string | undefined, code?: string | null): boolean {
  if (String(code ?? '').trim() === '2') return true
  return (source ?? '').toLowerCase().includes('исходящ')
}
