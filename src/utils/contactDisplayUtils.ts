import type { ContactDetails } from '@/types/card'

/**
 * Строки для блока «Контактный реквизит» (та же логика, что у изготовителя на вкладке «Продукция»).
 */
export function buildContactDisplayLines(
  contacts: ContactDetails[] | undefined,
  getChannelNameByCode: (code: string | undefined) => string | undefined
): string[] {
  if (!contacts?.length) return []

  const formatContactLabel = (contact: ContactDetails): string => {
    if (!contact) return ''
    const code = contact.communicationChannelCode?.trim()
    if (code) {
      const nameFromDict = getChannelNameByCode(code)?.trim()
      if (nameFromDict) return nameFromDict
      return code
    }
    if (contact.communicationChannelName?.trim()) return contact.communicationChannelName.trim()
    if (contact.contactKind?.trim()) return contact.contactKind.trim()
    return ''
  }

  const channelId = (contact: ContactDetails): string =>
    (contact.communicationChannelId ?? contact.contactValue ?? '').trim()

  const groups = contacts.reduce(
    (acc, contact) => {
      const label = formatContactLabel(contact) || 'Контакт'
      const value = channelId(contact)
      const hasLabel = !!(formatContactLabel(contact)?.trim())
      const hasValue = !!value
      if (!hasLabel && !hasValue) return acc
      if (!acc[label]) acc[label] = []
      acc[label].push(hasValue ? value : '—')
      return acc
    },
    {} as Record<string, string[]>
  )

  return Object.entries(groups).map(([label, values]) => `${label}: ${values.join(' ')}`)
}
