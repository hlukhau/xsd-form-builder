import type { CardData } from '@/types/card'

/** Сообщение при отсутствии csdo:AuthorityName на вкладке «Уведомление». */
export const MARK_READY_AUTHORITY_REQUIRED_MESSAGE =
  'Отметка о готовности запрещена, необходимо указать уполномоченный орган'

/** УО выбран: заполнено наименование (UnifiedAuthorityDetails → AuthorityName). */
export function isNotificationAuthorityNameFilled(data: CardData): boolean {
  return !!(data.notification?.authorizedBody?.name?.trim())
}
