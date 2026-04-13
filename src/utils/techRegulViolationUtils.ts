import type { TSDData, ViolationsData, ViolatedRequirement, ProductBatchDetails } from '@/types/card'
import type { TechRegulOption } from '@/utils/referenceDataApi'

function violationsList(batch: ProductBatchDetails): ViolationsData[] {
  const raw = batch.violations
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') return [raw as ViolationsData]
  return []
}

/**
 * После загрузки XML в TechnicalRegulationId мог остаться TECHREGULCODE; привязываем к справочнику и подставляем TECHREGULREGNUM / TECHREGULNAME.
 */
export function normalizeViolatedRequirementTechRegul(
  r: ViolatedRequirement,
  options: TechRegulOption[]
): { req: ViolatedRequirement; changed: boolean } {
  if ((r.techRegulDictionaryCode ?? '').trim()) {
    return { req: r, changed: false }
  }
  const id = (r.technicalRegulationId ?? '').trim()
  if (!id || options.length === 0) {
    return { req: r, changed: false }
  }
  const byCode = options.find((o) => (o.code ?? '').trim() === id)
  const byReg = options.find((o) => (o.regNum ?? '').trim() === id)
  const opt = byCode ?? byReg
  if (!opt) {
    return { req: r, changed: false }
  }
  const regNum = (opt.regNum ?? '').trim() || opt.code
  const nameFromXml = (r.technicalRegulationName ?? '').trim()
  const next: ViolatedRequirement = {
    ...r,
    techRegulDictionaryCode: opt.code,
    technicalRegulationId: regNum,
    technicalRegulationName: nameFromXml || opt.name,
  }
  const changed =
    r.techRegulDictionaryCode !== next.techRegulDictionaryCode ||
    (r.technicalRegulationId ?? '').trim() !== (next.technicalRegulationId ?? '').trim() ||
    (r.technicalRegulationName ?? '').trim() !== (next.technicalRegulationName ?? '').trim()
  return { req: next, changed }
}

/** Нормализация требований по справочнику после загрузки опций (без смены ссылки tsd, если правок нет). */
export function patchTsdTechRegulFromDictionary(tsd: TSDData, options: TechRegulOption[]): { next: TSDData; changed: boolean } {
  if (!tsd.batches?.length) {
    return { next: tsd, changed: false }
  }
  let changed = false
  const batches = tsd.batches.map((batch) => {
    const list = violationsList(batch)
    if (list.length === 0) return batch
    const newList = list.map((v) => {
      const reqs = (v.violatedRequirements ?? []).map((r) => {
        const { req, changed: c } = normalizeViolatedRequirementTechRegul(r, options)
        if (c) changed = true
        return req
      })
      return { ...v, violatedRequirements: reqs }
    })
    return { ...batch, violations: newList.length ? newList : undefined }
  })
  if (!changed) {
    return { next: tsd, changed: false }
  }
  return { next: { ...tsd, batches }, changed: true }
}
