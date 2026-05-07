/**
 * Единая точка postMessage в родительское окно из карты (iframe) + лог в консоль для отладки интеграции.
 */

const LOG_PREFIX = '[Карта → родитель]'

export function postMessageFromCardToParent(payload: unknown, reason: string): void {
  if (typeof window === 'undefined') return
  try {
    window.parent.postMessage(payload, '*')
    console.log(`${LOG_PREFIX} Сообщение отправлено картой — ${reason}:`, payload)
  } catch (e) {
    console.warn(`${LOG_PREFIX} Не удалось отправить (${reason}):`, e, payload)
  }
}
