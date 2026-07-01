/**
 * Кнопки смены статуса для исходящей карты DPR.
 * Предпочтительно по {@code dprStatusCode} из справочника DPRSTATUS; иначе запасной разбор по {@code dprStatusId} / названию.
 * Отметка готовности: {@code rightsDepKindId} из JSON прав (72 — район, 73 — область, 74 — республика) по ТЗ.
 */
import type { StatusButtonConfig, StatusButtonResult } from '@/utils/statusButtonConfig'
import type { DprResolutionRow } from '@/types/dprCard'

const DPR_DRAFT = 4
const DPR_NEW = 5
const DPR_PENDING = 6
const DPR_SENT = 7
const DPR_FAILED = 8
const DPR_ERROR = 9
const DPR_DELIVERED = 10

/** department.depkindid в карте прав (ТЗ на исходящую DPR). */
const RIGHTS_DEPKIND_DISTRICT = 72
const RIGHTS_DEPKIND_REGIONAL = 73
const RIGHTS_DEPKIND_REPUBLIC = 74

function norm(c: string | null | undefined): string {
  return String(c ?? '')
    .trim()
    .toLowerCase()
}

function hintNoStatusRight(): string {
  return 'Недостаточно прав: требуется violationDetectedIn:status с пересечением подразделений с доступом к PPV (PPVDEPPERMIS).'
}

function hintNoSendRight(): string {
  return 'Направление сведений недоступно: нет права violationDetectedIn:status с пересечением PPVDEPPERMIS, неверный статус карты или отсутствует резолюция областного (dep0602 / DEPKINDID 73) или республиканского (dep0603 / DEPKINDID 74) уровня.'
}

function hintRightsDepKindId(): string {
  return 'Укажите в карте прав department.depkindid: 72 — районный ЦГЭ, 73 — областной, 74 — республиканский.'
}

function getResolutionButtonLabel(userDepKindCode: string | null | undefined): string {
  const c = norm(userDepKindCode)
  if (c === 'dep0601') return 'Отметить готовность (районный ЦГЭ)'
  if (c === 'dep0602') return 'Отметить готовность (областной ЦГЭ)'
  if (c === 'dep0603') return 'Отметить готовность (республиканский ЦГЭ)'
  return 'Отметить готовность'
}

function resolutionCodes(resolutions: DprResolutionRow[]): string[] {
  return resolutions.map((r) => String(r.depKindCode ?? '').trim()).filter(Boolean)
}

/** Резолюция районного уровня (TB_DEPKIND dep0601). */
function hasDistrictResolution(resolutions: DprResolutionRow[]): boolean {
  if (!Array.isArray(resolutions) || resolutions.length === 0) return false
  return resolutions.some((r) => norm(r.depKindCode) === 'dep0601')
}

/** Резолюция областного или республиканского уровня — для направления из «Новое». */
function hasRegionalResolutionForSend(resolutions: DprResolutionRow[]): boolean {
  if (!Array.isArray(resolutions) || resolutions.length === 0) return false
  return resolutions.some(
    (r) =>
      norm(r.depKindCode) === 'dep0602' ||
      norm(r.depKindCode) === 'dep0603' ||
      r.depKindId === RIGHTS_DEPKIND_REGIONAL ||
      r.depKindId === RIGHTS_DEPKIND_REPUBLIC
  )
}

/** @deprecated используйте hasRegionalResolutionForSend */
function hasRegionalResolutionDep0602(resolutions: DprResolutionRow[]): boolean {
  return hasRegionalResolutionForSend(resolutions)
}

function rightsAllowMarkReadyDraft(rightsDepKindId: number | null | undefined): boolean {
  return (
    rightsDepKindId === RIGHTS_DEPKIND_DISTRICT ||
    rightsDepKindId === RIGHTS_DEPKIND_REGIONAL ||
    rightsDepKindId === RIGHTS_DEPKIND_REPUBLIC
  )
}

/** Видимость «Отметить готовность» по ТЗ (depkindid 72/73/74, DRAFT/NEW+районная резолюция). */
function canShowOutgoingDprMarkReady(
  rightsDepKindId: number | null | undefined,
  statusCode: string,
  hasDistrictRes: boolean,
  hasRegionalDep0602: boolean
): boolean {
  const code = norm(statusCode)
  if (code === 'draft') {
    return rightsAllowMarkReadyDraft(rightsDepKindId)
  }
  if (code === 'new') {
    return (
      rightsDepKindId === RIGHTS_DEPKIND_REGIONAL &&
      hasDistrictRes &&
      !hasRegionalDep0602
    )
  }
  return false
}

const hintSendOp57 =
  'Направление сведений участникам ОП 57: после подтверждения выполняется валидация карты, затем статус «Ожидает отправки».'

const hintNewToPending =
  'Новое при резолюции областного или республиканского уровня → Ожидает отправки (направление в ОП 57 после валидации).'

const NEED_REGIONAL_OR_REPUBLICAN_HINT =
  'Ожидается резолюция областного (dep0602) или республиканского (dep0603) уровня в DPRRESOLUTION.'

const sendOp57Button: StatusButtonConfig = {
  label: 'Направление сведений',
  action: 'send',
  hint: hintSendOp57,
}

export function outgoingDprStatusButton(
  dprStatusCode: string | null | undefined,
  statusId: number | null | undefined,
  statusName: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  resolutions: DprResolutionRow[],
  userDepKindCode: string | null | undefined,
  userDepKindName: string | null | undefined,
  rightsDepKindId: number | null | undefined
): StatusButtonResult {
  const noSt = hintNoStatusRight()
  const noSend = hintNoSendRight()
  const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
  const codes = resolutionCodes(resolutions)
  const hasRegionalDep0602 = hasRegionalResolutionForSend(resolutions)
  const hasDistrictRes = hasDistrictResolution(resolutions)
  const hasResolutionOfUserLevel =
    userDepKindCode && codes.some((c) => norm(c) === norm(userDepKindCode))

  if (!hasStatusRight) {
    return { config: null, comment: noSt }
  }

  const code = norm(dprStatusCode)
  if (code) {
    if (canShowOutgoingDprMarkReady(rightsDepKindId, code, hasDistrictRes, hasRegionalDep0602)) {
      const isRegionalOnNew = code === 'new' && rightsDepKindId === RIGHTS_DEPKIND_REGIONAL
      const draftHint =
        userDepKindName && userDepKindName.trim()
          ? `Наложение резолюции уровня «${userDepKindName.trim()}» и перевод в «Новое».`
          : 'Наложение резолюции и перевод карты в статус «Новое».'
      const hintRegionalSecond =
        'Будет записана резолюция областного уровня о готовности к отправке; статус карты останется «Новое».'
      return {
        config: {
          label: resolutionLabel,
          action: 'mark_ready',
          hint: isRegionalOnNew ? hintRegionalSecond : draftHint,
        },
        comment: isRegionalOnNew ? hintRegionalSecond : draftHint,
      }
    }
    if (code === 'draft' && !rightsAllowMarkReadyDraft(rightsDepKindId)) {
      return { config: null, comment: hintRightsDepKindId() }
    }
    if (code === 'new') {
      if (hasRegionalDep0602 && hasSendRight) {
        return {
          config: { label: 'Направление сведений', action: 'send', hint: hintNewToPending },
          comment: hintNewToPending,
        }
      }
      if (hasRegionalDep0602 && !hasSendRight) {
        return { config: null, comment: noSend }
      }
      if (hasResolutionOfUserLevel && !hasRegionalDep0602) {
        return { config: null, comment: NEED_REGIONAL_OR_REPUBLICAN_HINT }
      }
      const hintNew =
        userDepKindCode && norm(userDepKindCode) === 'dep0601'
          ? NEED_REGIONAL_OR_REPUBLICAN_HINT
          : 'Наложите резолюцию своего уровня либо дождитесь резолюции областного (dep0602) или республиканского (dep0603) уровня.'
      if (rightsDepKindId === RIGHTS_DEPKIND_DISTRICT || rightsDepKindId === RIGHTS_DEPKIND_REPUBLIC) {
        return { config: null, comment: hintNew }
      }
      if (rightsDepKindId === RIGHTS_DEPKIND_REGIONAL && !hasDistrictRes) {
        return { config: null, comment: 'Нет резолюции районного ЦГЭ' }
      }
      return { config: null, comment: hintRightsDepKindId() }
    }
    if (code === 'pending' || code === 'sent') {
      return { config: null, comment: '' }
    }
    if (code === 'failed' || code === 'error') {
      if (hasSendRight) {
        return {
          config: sendOp57Button,
          comment: hintSendOp57,
        }
      }
      return { config: null, comment: noSend }
    }
    if (code === 'delivered') {
      return { config: null, comment: '' }
    }
  }

  const sid = statusId ?? -1
  const fallbackCode =
    sid === DPR_DRAFT ? 'draft' : sid === DPR_NEW ? 'new' : sid === DPR_PENDING || sid === DPR_SENT ? 'pending' : ''
  if (fallbackCode) {
    if (canShowOutgoingDprMarkReady(rightsDepKindId, fallbackCode, hasDistrictRes, hasRegionalDep0602)) {
      const isRegionalOnNew = fallbackCode === 'new' && rightsDepKindId === RIGHTS_DEPKIND_REGIONAL
      const draftHint =
        userDepKindName && userDepKindName.trim()
          ? `Наложение резолюции уровня «${userDepKindName.trim()}» и перевод в «Новое».`
          : 'Наложение резолюции и перевод карты в статус «Новое».'
      const hintRegionalSecond =
        'Будет записана резолюция областного уровня о готовности к отправке; статус карты останется «Новое».'
      return {
        config: {
          label: resolutionLabel,
          action: 'mark_ready',
          hint: isRegionalOnNew ? hintRegionalSecond : draftHint,
        },
        comment: isRegionalOnNew ? hintRegionalSecond : draftHint,
      }
    }
    if (fallbackCode === 'new' && hasRegionalDep0602 && hasSendRight) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintNewToPending },
        comment: hintNewToPending,
      }
    }
    if (fallbackCode === 'pending') {
      return { config: null, comment: '' }
    }
  }
  if (sid === DPR_PENDING || sid === DPR_SENT) {
    return { config: null, comment: '' }
  }
  if (sid === DPR_FAILED || sid === DPR_ERROR) {
    if (hasSendRight) {
      return {
        config: sendOp57Button,
        comment: hintSendOp57,
      }
    }
    return { config: null, comment: noSend }
  }
  if (sid === DPR_DELIVERED) {
    return { config: null, comment: '' }
  }

  const s = norm(statusName)
  if (s.includes('черновик')) {
    if (canShowOutgoingDprMarkReady(rightsDepKindId, 'draft', hasDistrictRes, hasRegionalDep0602)) {
      return {
        config: { label: resolutionLabel, action: 'mark_ready', hint: 'Перевод в «Новое» с резолюцией.' },
        comment: 'Черновик',
      }
    }
    return { config: null, comment: hintRightsDepKindId() }
  }
  if (s.includes('новое') || s.includes('новая')) {
    if (canShowOutgoingDprMarkReady(rightsDepKindId, 'new', hasDistrictRes, hasRegionalDep0602)) {
      return {
        config: { label: resolutionLabel, action: 'mark_ready', hint: 'Наложение резолюции областного уровня.' },
        comment: 'Новое',
      }
    }
    if (hasRegionalDep0602 && hasSendRight) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintNewToPending },
        comment: hintNewToPending,
      }
    }
    return { config: null, comment: hasRegionalDep0602 && !hasSendRight ? noSend : 'Новое' }
  }
  if (s.includes('не удалась') || s.includes('ошибка')) {
    if (hasSendRight) {
      return {
        config: sendOp57Button,
        comment: hintSendOp57,
      }
    }
    return { config: null, comment: noSend }
  }

  return { config: null, comment: '' }
}

/** Входящая DPR: завершение обработки (PROCESSING → PROCESSED), право violationDetectedOut:status ∩ PPVDEPPERMIS. */
const HINT_INCOMING_COMPLETE_NO_RIGHT =
  'Недостаточно прав: требуется violationDetectedOut:status с пересечением подразделений с доступом к связанной карте PPV (PPVDEPPERMIS).'

export function incomingDprCompleteProcessingButton(
  dprStatusCode: string | null | undefined,
  _statusId: number | null | undefined,
  statusName: string,
  hasCompleteRight: boolean
): StatusButtonResult {
  const noR = HINT_INCOMING_COMPLETE_NO_RIGHT
  if (!hasCompleteRight) {
    return { config: null, comment: noR }
  }
  const code = norm(dprStatusCode)
  const s = norm(statusName)
  const looksProcessing =
    code === 'processing' || (s.includes('обработке') && !s.includes('обработано'))
  if (looksProcessing) {
    return {
      config: {
        label: 'Завершить обработку',
        action: 'complete_processing',
        hint: 'Перевод карты входящих сведений в статус «Обработано».',
      },
      comment: '',
    }
  }
  return { config: null, comment: '' }
}
