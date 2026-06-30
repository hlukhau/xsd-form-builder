import type { CardData } from '@/types/card'
import { collectFormatValidationErrors } from '@/utils/cardValidation'

/** Ошибки вида уведомления при сохранении новой версии карты (копия). */
export function collectDpaCopyKindSaveErrors(
  data: CardData,
  copyFromDpaid: number | null | undefined,
  isPpv: boolean
): string[] {
  if (copyFromDpaid == null) return []
  const v = data.version ?? 1
  const kind = data.notification?.type?.trim() ?? ''
  const errors: string[] = []
  if (!kind) {
    errors.push('Уведомление: Вид уведомления должен быть указан')
    return errors
  }
  if (isPpv) {
    if (v === 1 && kind !== '19') errors.push('Уведомление: Неверно указан вид уведомления')
    else if (v !== 1 && kind !== '8' && kind !== '9') errors.push('Уведомление: Неверно указан вид уведомления')
  } else if (v === 1 && kind !== '7') {
    errors.push('Уведомление: Неверно указан вид уведомления')
  } else if (v !== 1 && kind !== '8' && kind !== '9') {
    errors.push('Уведомление: Неверно указан вид уведомления')
  }
  return errors
}

export function collectDpaSaveBlockingErrors(
  data: CardData,
  copyFromDpaid: number | null | undefined,
  isPpv: boolean
): string[] {
  return [
    ...collectFormatValidationErrors(data).errors,
    ...collectDpaCopyKindSaveErrors(data, copyFromDpaid, isPpv),
  ]
}
