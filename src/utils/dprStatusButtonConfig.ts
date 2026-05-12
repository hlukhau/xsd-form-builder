/**
 * Кнопки смены статуса для исходящей карты DPR (DPRSTATUSID по справочнику DPRSTATUS, DATASOURCEKINDCODE=2).
 * Логика по образцу исходящей DPA: mark_ready, send, to_new.
 */
import type { StatusButtonConfig, StatusButtonResult } from '@/utils/statusButtonConfig'

const DPR_DRAFT = 4
const DPR_NEW = 5
const DPR_PENDING = 6
const DPR_SENT = 7
const DPR_FAILED = 8
const DPR_ERROR = 9
const DPR_DELIVERED = 10

function norm(c: string | null | undefined): string {
  return String(c ?? '')
    .trim()
    .toLowerCase()
}

function hintNoStatusRight(): string {
  return 'Недостаточно прав: требуется violationDetectedIn:status с пересечением подразделений с доступом к PPV (PPVDEPPERMIS).'
}

function getResolutionButtonLabel(userDepKindCode: string | null | undefined): string {
  const c = norm(userDepKindCode)
  if (c === 'dep0601') return 'Отметить готовность (районный ЦГЭ)'
  if (c === 'dep0602') return 'Отметить готовность (областной ЦГЭ)'
  if (c === 'dep0603') return 'Отметить готовность (республиканский ЦГЭ)'
  return 'Отметить готовность'
}

export function outgoingDprStatusButton(
  statusId: number | null | undefined,
  statusName: string,
  hasStatusRight: boolean,
  existingResolutionDepKindCodes: string[] | undefined,
  userDepKindCode: string | null | undefined,
  userDepKindName: string | null | undefined
): StatusButtonResult {
  const noSt = hintNoStatusRight()
  const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
  const hasRegionalOrRepublicanResolution =
    Array.isArray(existingResolutionDepKindCodes) &&
    existingResolutionDepKindCodes.some((c) => {
      const x = norm(c)
      return x === 'dep0602' || x === 'dep0603'
    })
  const hasResolutionOfUserLevel =
    userDepKindCode &&
    Array.isArray(existingResolutionDepKindCodes) &&
    existingResolutionDepKindCodes.some((c) => norm(c) === norm(userDepKindCode))

  const hintNewToPending = 'Новое + резолюция областного/республиканского ЦГЭ → Ожидает отправки'
  const hintToNew =
    'Перевод в «Новое» из «Отправка не удалась» или «Ошибка обработки»; далее снова доступно направление при резолюции.'
  const NEED_REGIONAL_OR_REPUBLICAN_HINT = 'Ожидается резолюция областного или республиканского ЦГЭ.'

  if (!hasStatusRight) {
    return {
      config: {
        label: resolutionLabel,
        action: 'mark_ready',
        disabled: true,
        hint: noSt,
      },
      comment: noSt,
    }
  }

  const sid = statusId ?? -1
  if (sid === DPR_DRAFT) {
    const draftHint =
      userDepKindName && userDepKindName.trim()
        ? `Наложение резолюции уровня «${userDepKindName.trim()}» и перевод в «Новое».`
        : 'Наложение резолюции и перевод карты в статус «Новое».'
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: draftHint },
      comment: draftHint,
    }
  }
  if (sid === DPR_NEW) {
    if (hasRegionalOrRepublicanResolution) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintNewToPending },
        comment: hintNewToPending,
      }
    }
    if (hasResolutionOfUserLevel && !hasRegionalOrRepublicanResolution) {
      return {
        config: {
          label: 'Направление сведений',
          action: 'send',
          disabled: true,
          hint: NEED_REGIONAL_OR_REPUBLICAN_HINT,
        },
        comment: NEED_REGIONAL_OR_REPUBLICAN_HINT,
      }
    }
    const hintNew =
      userDepKindCode && norm(userDepKindCode) === 'dep0601'
        ? 'Ожидается резолюция областного или республиканского ЦГЭ.'
        : 'Наложите резолюцию своего уровня либо дождитесь резолюции вышестоящего ЦГЭ.'
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: hintNew },
      comment: hintNew,
    }
  }
  if (sid === DPR_PENDING || sid === DPR_SENT) {
    return { config: null, comment: '' }
  }
  if (sid === DPR_FAILED || sid === DPR_ERROR) {
    return {
      config: { label: 'Перевести в Новое', action: 'to_new', hint: hintToNew },
      comment: hintToNew,
    }
  }
  if (sid === DPR_DELIVERED) {
    return { config: null, comment: '' }
  }

  const s = norm(statusName)
  if (s.includes('черновик')) {
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: 'Перевод в «Новое» с резолюцией.' },
      comment: 'Черновик',
    }
  }
  if (s.includes('новое') || s.includes('новая')) {
    if (hasRegionalOrRepublicanResolution) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintNewToPending },
        comment: hintNewToPending,
      }
    }
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: 'Наложение резолюции.' },
      comment: 'Новое',
    }
  }
  if (s.includes('не удалась') || s.includes('ошибка')) {
    return {
      config: { label: 'Перевести в Новое', action: 'to_new', hint: hintToNew },
      comment: hintToNew,
    }
  }

  return { config: null, comment: '' }
}
