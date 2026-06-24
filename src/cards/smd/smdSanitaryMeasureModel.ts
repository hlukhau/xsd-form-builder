import type { CardData, SanitaryMeasure } from '@/types/card'
import { getSmdMessageName } from '@/constants/smdCard'
import { applySmdRegulatoryDocToCard } from './smdMeasureDoc'

export function createDefaultSmdPrimaryMeasure(): SanitaryMeasure {
  return {
    languageCode: 'ru',
    measureDocDetails: { country: 'BY', languageCode: 'ru' },
    measureInitiationBasisDetails: [],
  }
}

export function getSmdPrimaryMeasure(data: CardData): SanitaryMeasure {
  return data.measures?.measures?.[0] ?? createDefaultSmdPrimaryMeasure()
}

/** Синхронизация шапки карты и SMD-индекса с блоком MeasureDocDetails и датами меры. */
export function syncSmdCardFromPrimaryMeasure(data: CardData): CardData {
  const m = data.measures?.measures?.[0] ?? createDefaultSmdPrimaryMeasure()
  const startDate = (m.startDate ?? data.smdMeasureStartDate ?? '').trim().slice(0, 10)

  const notification = data.notification ?? {
    country: 'BY',
    registrationNumber: '',
    type:
      getSmdMessageName(data.electronicDocument?.messageCode, data.version) ??
      'Сведения о введении временной санитарной мере',
    formationDate: '',
    endDate: null,
    authorizedBody: { country: 'BY', identifier: '', name: '', shortName: '' },
  }

  const withMeasure: CardData = {
    ...data,
    smdMeasureStartDate: startDate || undefined,
    notification,
    measures: { measures: [m, ...(data.measures?.measures?.slice(1) ?? [])] },
  }

  return applySmdRegulatoryDocToCard(withMeasure)
}

export function ensureSmdCardStructure(data: CardData): CardData {
  const measures =
    data.measures?.measures?.length ? data.measures.measures : [createDefaultSmdPrimaryMeasure()]
  return syncSmdCardFromPrimaryMeasure({ ...data, measures: { measures } })
}

export function patchSmdPrimaryMeasure(data: CardData, patch: Partial<SanitaryMeasure>): CardData {
  const current = getSmdPrimaryMeasure(data)
  const merged: SanitaryMeasure = { ...current, ...patch }
  if (patch.measureDocDetails) {
    merged.measureDocDetails = {
      ...current.measureDocDetails,
      ...patch.measureDocDetails,
    }
  }
  return syncSmdCardFromPrimaryMeasure({
    ...data,
    measures: { measures: [merged, ...(data.measures?.measures?.slice(1) ?? [])] },
  })
}

export function patchSmdPrimaryMeasureField<K extends keyof SanitaryMeasure>(
  data: CardData,
  field: K,
  value: SanitaryMeasure[K]
): CardData {
  return patchSmdPrimaryMeasure(data, { [field]: value } as Partial<SanitaryMeasure>)
}
