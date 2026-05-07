import type { CardData, PhaPatientGroupItem } from '@/types/card'

/**
 * Есть ли содержимое для вывода smcdo:PatientGroupDetails в XML (иначе тег не создаём).
 */
export function hasPhaPatientGroupExportContent(g: PhaPatientGroupItem): boolean {
  const pq = g.personQuantity != null ? String(g.personQuantity).trim() : ''
  if (pq !== '') return true
  if ((g.ageGroupCode ?? '').trim()) return true
  if ((g.diseaseOutcomeCode ?? '').trim()) return true
  if (g.laboratoryConfirmedIndicator === 0 || g.laboratoryConfirmedIndicator === 1) return true
  return false
}

/**
 * Предупреждения о пустых строках групп пациентов (аналог пустых партий/документов DPA в getEmptyTagsWarnings).
 */
export function getPhaEmptyTagsWarnings(data: CardData): string[] {
  const warnings: string[] = []
  const groups = data.phaPatientGroups ?? []
  if (groups.length === 0) return warnings
  const empty = groups.filter((g) => !hasPhaPatientGroupExportContent(g)).length
  if (empty > 0) {
    warnings.push(
      `Обнаружены пустые группы пациентов (${empty}): такие строки в XML не включаются; при сохранении не записываются (аналогично пустым партиям в DPA).`
    )
  }
  return warnings
}
