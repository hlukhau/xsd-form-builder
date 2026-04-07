import type { CardData } from '@/types/card'
import { fetchDpaXml, fetchDpaMetadata } from '@/utils/referenceDataApi'
import { parseXMLToCardData, validateAndEnrichCardData, getTextContent } from '@/utils/xmlParser'

/**
 * Загрузка карты DPA с сервера и слияние метаданных VW_DPA (как при открытии по DPAID).
 */
export async function loadDpaCardFromDb(dpaid: string, guid?: string): Promise<{ card: CardData; xmlText: string }> {
  const xmlText = await fetchDpaXml(dpaid, guid)
  const cardData = parseXMLToCardData(xmlText)
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
  let alertDetails: Element | null = null
  const allElements = xmlDoc.getElementsByTagName('*')
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i]
    const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
    if (localName === 'dangerousproductalertdetails') {
      alertDetails = el
      break
    }
  }
  const incidentKindCode = getTextContent(alertDetails, 'IncidentKindCode') || ''
  const validationResult = await validateAndEnrichCardData(cardData, incidentKindCode || undefined)
  let card = validationResult.cardData
  try {
    const meta = await fetchDpaMetadata(dpaid, guid)
    const authorityFromDb =
      meta.authorityUid != null && meta.authorityUid.trim() !== ''
        ? {
            country:
              (meta.authorityCountryCode ?? card.notification?.authorizedBody?.country ?? '').trim() ||
              (card.notification?.authorizedBody?.country ?? ''),
            identifier: meta.authorityUid.trim(),
            name: (card.notification?.authorizedBody?.name ?? '').trim() || '',
            shortName: (card.notification?.authorizedBody?.shortName ?? '').trim() || '',
          }
        : undefined
    card = {
      ...card,
      registrationNumber: meta.incidentId ?? card.registrationNumber,
      country: (meta.alertCountryCode ?? meta.alertCountryName ?? card.country).trim() || card.country,
      alertCountryName: meta.alertCountryName ?? card.alertCountryName,
      version: meta.dpaVersion ?? card.version,
      source: meta.datasourceKindName ?? card.source,
      datasourceKindCode: meta.datasourceKindCode ?? card.datasourceKindCode,
      createdAt: meta.creationDateTime ?? card.createdAt,
      modifiedAt: meta.modificationDateTime ?? card.modifiedAt,
      status: meta.dpaStatusName ?? card.status,
      statusId: meta.dpaStatusId ?? card.statusId,
      notification: card.notification
        ? {
            ...card.notification,
            authorizedBody: authorityFromDb ?? card.notification.authorizedBody,
          }
        : authorityFromDb
          ? ({ authorizedBody: authorityFromDb } as typeof card.notification)
          : card.notification,
    }
  } catch {
    /* метаданные опциональны */
  }
  return { card, xmlText }
}
