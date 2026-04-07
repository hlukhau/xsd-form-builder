import type { CardData } from '@/types/card'
import { fetchPhaXml, fetchPhaMetadata, fetchPhaStatusHistory } from '@/cards/pha/phaApi'
import { parsePhaXmlToCardData } from '@/cards/pha/phaXmlParser'

/**
 * Загрузка карты PHA с сервера и обогащение метаданными PHA (как при открытии по PHAID; без first_open).
 */
export async function loadPhaCardFromDb(phaid: string, guid?: string): Promise<{ card: CardData; xmlText: string }> {
  const [xmlText, meta] = await Promise.all([fetchPhaXml(phaid, guid), fetchPhaMetadata(phaid, guid)])
  const card = parsePhaXmlToCardData(xmlText)
  const versionFromPha =
    meta.phaVersion != null && !Number.isNaN(Number(meta.phaVersion)) ? Number(meta.phaVersion) : 1
  let enriched: CardData = {
    ...card,
    version: versionFromPha,
    registrationNumber: meta.incidentId ?? card.registrationNumber,
    country: meta.alertCountryCode ?? card.country,
    alertCountryName: meta.alertCountryName ?? card.alertCountryName,
    source: meta.dataSourceKindName ?? card.source,
    datasourceKindCode: meta.dataSourceKindCode ?? card.datasourceKindCode,
    phaAccessibleDepIds: meta.phaAccessibleDepIds,
    createdAt: meta.creationDateTime ?? card.createdAt,
    modifiedAt: meta.modificationDateTime ?? card.modifiedAt,
    status: meta.phaStatusName ?? card.status,
    statusId: meta.phaStatusId ?? card.statusId,
    notification: card.notification
      ? {
          ...card.notification,
          endDate: card.notification.endDate,
          authorizedBody: card.notification.authorizedBody
            ? {
                ...card.notification.authorizedBody,
                identifier:
                  (card.notification.authorizedBody.identifier ?? '').trim() ||
                  (meta.authorityUid ?? '').trim() ||
                  '',
              }
            : card.notification.authorizedBody,
        }
      : card.notification,
  }
  const statusTextEmpty = !(enriched.status ?? '').trim()
  const hasStatusIdFromMeta = meta.phaStatusId !== undefined && meta.phaStatusId !== null
  if (statusTextEmpty && !hasStatusIdFromMeta) {
    try {
      const history = await fetchPhaStatusHistory(phaid, guid)
      if (history.length > 0) {
        const latest = history[history.length - 1]
        if (latest?.status?.trim()) enriched = { ...enriched, status: latest.status }
      }
    } catch {
      /* история недоступна */
    }
  }
  return { card: enriched, xmlText }
}
