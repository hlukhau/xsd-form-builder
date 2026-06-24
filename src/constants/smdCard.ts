export const SMD_MESSAGE_INTRO = 'P.SS.09.MSG.001'
export const SMD_MESSAGE_CHANGE = 'P.SS.09.MSG.002'
export const SMD_MESSAGE_CANCEL = 'P.SS.09.MSG.003'

/** Виды сообщения SS.09 для версии карты = 1. */
export const SMD_MESSAGE_OPTIONS_V1: { code: string; name: string }[] = [
  {
    code: 'P.SS.09.MSG.001',
    name: 'Сведения о введении временной санитарной мере',
  },
]

/** Виды сообщения SS.09 для версии карты > 1. */
export const SMD_MESSAGE_OPTIONS_V2_PLUS: { code: string; name: string }[] = [
  { code: 'P.SS.09.MSG.002', name: 'Сведения об изменении временной санитарной меры' },
  { code: 'P.SS.09.MSG.003', name: 'Сведения об отмене временной санитарной меры' },
]

export function getSmdMessageOptionsForVersion(version: number | null | undefined): { code: string; name: string }[] {
  const v = version ?? 1
  return v <= 1 ? SMD_MESSAGE_OPTIONS_V1 : SMD_MESSAGE_OPTIONS_V2_PLUS
}

export function getSmdMessageName(code: string | null | undefined, version?: number): string | null {
  const c = (code ?? '').trim()
  if (!c) return null
  const opt = getSmdMessageOptionsForVersion(version).find((o) => o.code === c)
  return opt?.name ?? c
}
