/**
 * Справочник видов каналов связи (communicationchannel).
 * Код заносится в csdo:CommunicationChannelCode, наименование — в csdo:CommunicationChannelName.
 * Формат отображения: <код> - <наименование>.
 */
export const COMMUNICATION_CHANNEL_OPTIONS: { code: string; name: string }[] = [
  { code: 'EM', name: 'Электронная почта' },
  { code: 'TE', name: 'Телефон' },
  { code: 'TEL', name: 'Телефон' },
  { code: 'FX', name: 'Факс' },
  { code: 'TG', name: 'Телеграф' },
  { code: 'TL', name: 'Телекс' },
  { code: 'AO', name: 'URL' },
]

export function getCommunicationChannelNameByCode(code: string | undefined): string | undefined {
  if (!code) return undefined
  return COMMUNICATION_CHANNEL_OPTIONS.find((o) => o.code === code)?.name
}

export function getCommunicationChannelSelectOptions(): { value: string; label: string }[] {
  return COMMUNICATION_CHANNEL_OPTIONS.map((o) => ({
    value: o.code,
    label: `${o.code} - ${o.name}`,
  }))
}
