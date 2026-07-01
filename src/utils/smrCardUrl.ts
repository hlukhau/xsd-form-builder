/** URL просмотра карты SMR: /smr_card/{SMRID}/{GUID} */
export function buildSmrCardViewUrl(smrId: number, guid: string): string {
  const base =
    (import.meta.env.VITE_SMR_CARD_BASE as string | undefined)?.replace(/\/$/, '') ||
    (import.meta.env.VITE_REVIEW_RESULT_CARD_BASE as string | undefined)?.replace(/\/$/, '') ||
    '/smr_card'
  return `${base}/${smrId}/${encodeURIComponent(guid.trim())}`
}

/** URL создания карты SMR: /smr_card/create/{SMDID}/{GUID} */
export function buildSmrCardCreateUrl(smdid: string, guid: string): string {
  const base =
    (import.meta.env.VITE_SMR_CARD_BASE as string | undefined)?.replace(/\/$/, '') ||
    (import.meta.env.VITE_REVIEW_RESULT_CARD_BASE as string | undefined)?.replace(/\/$/, '') ||
    '/smr_card'
  return `${base}/create/${encodeURIComponent(smdid)}/${encodeURIComponent(guid.trim())}`
}

/** URL просмотра связанной карты SMD: /smd_card/{SMDID}/{GUID} */
export function buildSmdCardViewUrl(smdid: number | string, guid: string): string {
  const base =
    (import.meta.env.VITE_SMD_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/smd_card'
  return `${base}/${smdid}/${encodeURIComponent(guid.trim())}`
}
