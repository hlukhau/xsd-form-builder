/** URL просмотра карты DPR: /dpr_card/{DPRID}/{GUID} */
export function buildDprCardViewUrl(dprId: number, guid: string): string {
  const base = (import.meta.env.VITE_DPR_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/dpr_card'
  return `${base}/${dprId}/${encodeURIComponent(guid.trim())}`
}
