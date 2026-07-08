import type { StatusButtonConfig, StatusButtonResult } from '@/utils/statusButtonConfig'

function norm(c: string | null | undefined): string {
  return String(c ?? '')
    .trim()
    .toLowerCase()
}

const HINT_NO_SEND =
  'Направление сведений недоступно: нет права, неверный статус карты или карта не является исходящей.'

const HINT_NO_COMPLETE =
  'Недостаточно прав: требуется sanitaryMeasureIn:status с пересечением подразделений с доступом к SMD (SMDDEPPERMIS).'

const sendButton: StatusButtonConfig = {
  label: 'Направление сведений',
  action: 'send',
  hint: 'Направить сведения участникам органа по сотрудничеству в рамках решения Комиссии №58 (ОП 58).',
}

/** Кнопка направления для исходящей SMAQ/SMAR. */
export function outgoingSmaStatusButton(
  statusCode: string | null | undefined,
  statusName: string,
  canSend: boolean
): StatusButtonResult {
  if (!canSend) {
    return { config: null, comment: HINT_NO_SEND }
  }
  const code = norm(statusCode)
  if (code === 'new' || code === 'failed' || code === 'error') {
    return { config: sendButton, comment: sendButton.hint ?? '' }
  }
  const s = norm(statusName)
  if (s.includes('новое') || s.includes('новая')) {
    return { config: sendButton, comment: sendButton.hint ?? '' }
  }
  if (s.includes('не удалась') || s.includes('ошибка')) {
    return { config: sendButton, comment: sendButton.hint ?? '' }
  }
  return { config: null, comment: '' }
}

/** Кнопка завершения обработки для входящей SMAQ/SMAR. */
export function incomingSmaCompleteProcessingButton(
  statusCode: string | null | undefined,
  statusName: string,
  canComplete: boolean
): StatusButtonResult {
  if (!canComplete) {
    return { config: null, comment: HINT_NO_COMPLETE }
  }
  const code = norm(statusCode)
  const s = norm(statusName)
  const looksProcessing =
    code === 'processing' || (s.includes('обработке') && !s.includes('обработано'))
  if (looksProcessing) {
    return {
      config: {
        label: 'Завершить обработку',
        action: 'complete_processing',
        hint: 'Перевод карты входящих сведений в статус «Обработано».',
      },
      comment: '',
    }
  }
  return { config: null, comment: '' }
}
