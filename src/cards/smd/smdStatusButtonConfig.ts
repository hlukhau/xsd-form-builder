import type { StatusButtonConfig } from '@/utils/statusButtonConfig'

/** Заготовка кнопок статуса SMD (логика по статусной модели — в следующих итерациях). */
export function incomingSmdStatusButton(_statusCode: string | null | undefined): StatusButtonConfig | null {
  return null
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
