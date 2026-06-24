import type { StatusButtonConfig, StatusButtonResult } from '@/utils/statusButtonConfig'

const HINT_NO_STATUS_RIGHT_IN =
  'Недостаточно прав: для завершения обработки требуется право sanitaryMeasureIn:status в пределах подразделения с доступом к карте.'

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/** Кнопка смены статуса для входящей карты SMD. */
export function incomingSmdStatusButton(
  statusCode: string | null | undefined,
  statusName: string | null | undefined,
  canComplete: boolean,
  completeDeniedReason?: string | null
): StatusButtonResult {
  const code = (statusCode ?? '').trim().toUpperCase()
  const s = norm(statusName)

  if (code === 'RECEIVED' || (s.includes('получен') && !s.includes('обработ'))) {
    return {
      config: null,
      comment:
        'Статус «Получено»: при первичном открытии карты выполняется автоматический переход в «В обработке».',
    }
  }

  const isProcessing = code === 'PROCESSING' || (s.includes('обработке') && !s.includes('обработано'))
  if (!isProcessing) {
    return { config: null, comment: '' }
  }

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

export function outgoingSmdStatusButton(_statusCode: string | null | undefined): StatusButtonConfig | null {
  return null
}

export function smdCloseCardButton(): StatusButtonConfig | null {
  return { label: 'Закрыть карту', action: 'close_card' }
}

export function isSmdIncomingSource(source: string | undefined, code?: string | null): boolean {
  if (String(code ?? '').trim() === '1') return true
  return (source ?? '').toLowerCase().includes('входящ')
}

export function isSmdOutgoingSource(source: string | undefined, code?: string | null): boolean {
  if (String(code ?? '').trim() === '2') return true
  return (source ?? '').toLowerCase().includes('исходящ')
}
