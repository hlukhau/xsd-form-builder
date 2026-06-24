/** URL просмотра карты запроса дополнительных сведений: /sma_card/{SMAQID}/{GUID} */
export function buildSmaqCardViewUrl(smaqId: number, guid: string): string {
  const base =
    (import.meta.env.VITE_SMA_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/sma_card'
  return `${base}/${smaqId}/${encodeURIComponent(guid.trim())}`
}

/** URL создания карты запроса дополнительных сведений: /sma_card/create/{SMDID}/{GUID} */
export function buildSmaqCardCreateUrl(smdid: string, guid: string): string {
  const base =
    (import.meta.env.VITE_SMA_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/sma_card'
  return `${base}/create/${encodeURIComponent(smdid)}/${encodeURIComponent(guid.trim())}`
}

/** URL просмотра карты ответа на запрос: /smar_card/{SMARID}/{GUID} */
export function buildSmarCardViewUrl(smarId: number, guid: string): string {
  const base =
    (import.meta.env.VITE_SMAR_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/smar_card'
  return `${base}/${smarId}/${encodeURIComponent(guid.trim())}`
}

/** URL создания карты ответа: /smar_card/create/{SMAQID}/{GUID} */
export function buildSmarCardCreateUrl(smaqId: number, guid: string): string {
  const base =
    (import.meta.env.VITE_SMAR_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/smar_card'
  return `${base}/create/${smaqId}/${encodeURIComponent(guid.trim())}`
}

/** URL просмотра карты результата рассмотрения меры: /smr_card/{SMRID}/{GUID} */
export function buildSmrCardViewUrl(smrId: number, guid: string): string {
  const base =
    (import.meta.env.VITE_SMR_CARD_BASE as string | undefined)?.replace(/\/$/, '') ||
    (import.meta.env.VITE_REVIEW_RESULT_CARD_BASE as string | undefined)?.replace(/\/$/, '') ||
    '/smr_card'
  return `${base}/${smrId}/${encodeURIComponent(guid.trim())}`
}

/** URL создания карты результата рассмотрения: /smr_card/create/{SMDID}/{GUID} */
export function buildSmrCardCreateUrl(smdid: string, guid: string): string {
  const base =
    (import.meta.env.VITE_SMR_CARD_BASE as string | undefined)?.replace(/\/$/, '') ||
    (import.meta.env.VITE_REVIEW_RESULT_CARD_BASE as string | undefined)?.replace(/\/$/, '') ||
    '/smr_card'
  return `${base}/create/${encodeURIComponent(smdid)}/${encodeURIComponent(guid.trim())}`
}
