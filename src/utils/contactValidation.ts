import type { ContactDetails } from '@/types/card'

function empty(s: string | undefined | null): boolean {
  return s == null || String(s).trim() === ''
}

/** Задан способ/вид связи — в XML нужен CommunicationChannelId (см. exportCommunicationDetailsBlock). */
export function contactNeedsCommunicationValue(c: ContactDetails): boolean {
  return (
    !empty(c.communicationChannelCode) ||
    !empty(c.communicationChannelName) ||
    !empty(c.communicationChannelId) ||
    !empty(c.contactKind)
  )
}

/** Значение для канала: contactValue и/или communicationChannelId (как в phaValidation). */
export function contactHasCommunicationValue(c: ContactDetails): boolean {
  return !empty(c.contactValue) || !empty(c.communicationChannelId)
}

/**
 * Если для строки контакта указан канал/вид связи, но нет значения — возвращает текст замечания.
 * @param scopePhrase — пояснение контекста (DPA); без него — короткая формулировка как в PHA.
 */
export function remarkContactsIncomplete(contacts: ContactDetails[] | undefined, scopePhrase?: string): string | null {
  if (!contacts?.length) return null
  for (const c of contacts) {
    if (!contactNeedsCommunicationValue(c)) continue
    if (!contactHasCommunicationValue(c)) {
      const s = scopePhrase?.trim()
      if (s) {
        return `Для контактного реквизита ${s} должно быть указано значение (номер, адрес и т.п.)`
      }
      return 'Для контактного реквизита должно быть указано значение'
    }
  }
  return null
}
