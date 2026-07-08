import type { CardData, MeasureDocDetails } from '@/types/card'
import { getSmdPrimaryMeasure } from './smdSanitaryMeasureModel'

const DEFAULT_REGULATORY_DOC: MeasureDocDetails = {
  country: 'BY',
  languageCode: 'ru',
}

/** Значение из measureDocDetails без подстановки шапки, если поле задано явно (в т.ч. пустая строка). */
function pickMeasureDocField(
  fromMeasure: string | undefined | null,
  fallback: string | undefined | null
): string {
  if (fromMeasure !== undefined && fromMeasure !== null) {
    return String(fromMeasure).trim()
  }
  return (fallback ?? '').trim()
}

/**
 * Документ, регламентирующий введение (отмену) меры — единственный источник SMD.DOCID / шапки.
 * Не путать с initialMeasureDocDetails и measureInitiationBasisDetails (только XML).
 */
export function getSmdRegulatoryMeasureDoc(data: CardData): MeasureDocDetails {
  const measure = getSmdPrimaryMeasure(data)
  const fromMeasure = measure.measureDocDetails ?? {}
  const docId = pickMeasureDocField(
    fromMeasure.docId,
    data.notification?.registrationNumber ?? data.registrationNumber
  )
  const docCreationDate = pickMeasureDocField(
    fromMeasure.docCreationDate,
    data.notification?.formationDate
  ).slice(0, 10)
  const country = (
    fromMeasure.country ||
    data.notification?.country ||
    data.country ||
    'BY'
  )
    .trim()
    .toUpperCase()
    .slice(0, 2)

  return {
    ...DEFAULT_REGULATORY_DOC,
    ...fromMeasure,
    country,
    docId,
    docCreationDate,
    authorityName: pickMeasureDocField(
      fromMeasure.authorityName,
      data.notification?.authorizedBody?.name
    ),
  }
}

export function getSmdRegulatoryDocId(data: CardData): string | null {
  const id = getSmdRegulatoryMeasureDoc(data).docId?.trim()
  return id || null
}

export function getSmdRegulatoryDocCreationDate(data: CardData): string | null {
  const d = getSmdRegulatoryMeasureDoc(data).docCreationDate?.trim().slice(0, 10)
  return d || null
}

/** Встраивает нормализованный regulatory-doc в measures[0] и шапку. */
export function applySmdRegulatoryDocToCard(data: CardData): CardData {
  const measure = getSmdPrimaryMeasure(data)
  const fromMeasure = measure.measureDocDetails ?? {}
  const doc = getSmdRegulatoryMeasureDoc(data)
  const mergedMeasure = {
    ...measure,
    measureDocDetails: {
      ...fromMeasure,
      country: doc.country,
      docId: doc.docId,
      docCreationDate: doc.docCreationDate,
      authorityName:
        fromMeasure.authorityName !== undefined && fromMeasure.authorityName !== null
          ? fromMeasure.authorityName
          : doc.authorityName,
    },
  }
  const docId = doc.docId?.trim() ?? ''
  const docDate = doc.docCreationDate?.trim().slice(0, 10) ?? ''

  return {
    ...data,
    country: doc.country ?? data.country,
    registrationNumber: docId,
    notification: data.notification
      ? {
          ...data.notification,
          country: doc.country ?? data.notification.country,
          registrationNumber: docId,
          formationDate: docDate,
          authorizedBody: {
            ...data.notification.authorizedBody,
            country: doc.country ?? data.notification.authorizedBody?.country ?? 'BY',
            name:
              fromMeasure.authorityName !== undefined && fromMeasure.authorityName !== null
                ? fromMeasure.authorityName
                : (doc.authorityName ?? data.notification.authorizedBody?.name ?? ''),
          },
        }
      : data.notification,
    measures: { measures: [mergedMeasure, ...(data.measures?.measures?.slice(1) ?? [])] },
  }
}
