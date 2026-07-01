import type { CardData } from '@/types/card'
import type { DprParsedBundle } from '@/types/dprCard'
import type { SmrParsedBundle } from '@/types/smrCard'

/** Сообщение при отсутствии csdo:AuthorityName на вкладке «Уведомление». */
export const MARK_READY_AUTHORITY_REQUIRED_MESSAGE =
  'Отметка о готовности запрещена, необходимо указать уполномоченный орган'

/** УО выбран: заполнено наименование (UnifiedAuthorityDetails → AuthorityName). */
export function isNotificationAuthorityNameFilled(data: CardData): boolean {
  return !!(data.notification?.authorizedBody?.name?.trim())
}

/** DPR: уполномоченный орган на вкладке «Уведомление» (DangerousProductAlertResponseDetails → UnifiedAuthorityDetails). */
export function isDprNotifyingAuthorityNameFilled(
  parsed: Pick<DprParsedBundle, 'notifyingAuthority'>
): boolean {
  return !!(parsed.notifyingAuthority?.name?.trim())
}

/** SMR: уполномоченный орган на вкладке «Уведомление» (SanitaryMeasureConsiderationDetails → UnifiedAuthorityDetails). */
export function isSmrRespondingAuthorityNameFilled(
  parsed: Pick<SmrParsedBundle, 'respondingAuthority'>
): boolean {
  return !!(parsed.respondingAuthority?.name?.trim())
}
