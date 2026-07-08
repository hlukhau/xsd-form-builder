/** URL просмотра карты запроса: /sma_card/smaq/{SMAQID}/{GUID} */
export function buildSmaqCardViewUrl(smaqId: number, guid: string): string {
  const base =
    (import.meta.env.VITE_SMA_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/sma_card'
  return `${base}/smaq/${smaqId}/${encodeURIComponent(guid.trim())}`
}

/** URL просмотра карты ответа: /sma_card/smar/{SMARID}/{GUID} */
export function buildSmarCardViewUrl(smarId: number, guid: string): string {
  const base =
    (import.meta.env.VITE_SMA_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/sma_card'
  return `${base}/smar/${smarId}/${encodeURIComponent(guid.trim())}`
}

/** URL создания запроса: /sma_card/create/smd/{SMDID}/{GUID} */
export function buildSmaqCardCreateUrl(smdid: string, guid: string): string {
  const base =
    (import.meta.env.VITE_SMA_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/sma_card'
  return `${base}/create/smd/${encodeURIComponent(smdid)}/${encodeURIComponent(guid.trim())}`
}

/** URL создания ответа: /sma_card/create/smaq/{SMAQID}/{GUID} */
export function buildSmarCardCreateUrl(smaqId: number, guid: string): string {
  const base =
    (import.meta.env.VITE_SMA_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/sma_card'
  return `${base}/create/smaq/${smaqId}/${encodeURIComponent(guid.trim())}`
}

export { buildSmdCardViewUrl } from '@/utils/smrCardUrl'
