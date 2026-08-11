/**
 * Кнопки смены статуса для исходящей карты SMR.
 * Предпочтительно по {@code smrStatusCode}; иначе запасной разбор по {@code smrStatusId} / названию.
 */
import type { StatusButtonConfig, StatusButtonResult } from '@/utils/statusButtonConfig'
import type { SmrResolutionRow } from '@/types/smrCard'

const SMR_DRAFT = 4
const SMR_NEW = 5
const SMR_PENDING = 6
const SMR_SENT = 7
const SMR_FAILED = 8
const SMR_ERROR = 9
const SMR_DELIVERED = 10

const RIGHTS_DEPKIND_DISTRICT = 72
const RIGHTS_DEPKIND_REGIONAL = 73
const RIGHTS_DEPKIND_REPUBLIC = 74

function norm(c: string | null | undefined): string {
  return String(c ?? '')
    .trim()
    .toLowerCase()
}

function hintNoStatusRight(): string {
  return 'Недостаточно прав: требуется sanitaryMeasureIn:status с пересечением подразделений с доступом к SMD (SMDDEPPERMIS).'
}

function hintNoSendRight(): string {
  return 'Направление сведений недоступно: нет права sanitaryMeasureIn:status с пересечением SMDDEPPERMIS или неверный статус карты (нужны «Новое», «Отправка не удалась» или «Ошибка обработки»).'
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

function hasDistrictResolution(resolutions: SmrResolutionRow[]): boolean {
  if (!Array.isArray(resolutions) || resolutions.length === 0) return false
  return resolutions.some((r) => norm(r.depKindCode) === 'dep0601')
}

function hasRegionalResolutionForSend(resolutions: SmrResolutionRow[]): boolean {
  if (!Array.isArray(resolutions) || resolutions.length === 0) return false
  return resolutions.some(
    (r) => norm(r.depKindCode) === 'dep0602' || r.depKindId === RIGHTS_DEPKIND_REGIONAL
  )
}

function rightsAllowMarkReadyDraft(rightsDepKindId: number | null | undefined): boolean {
  return (
    rightsDepKindId === RIGHTS_DEPKIND_DISTRICT ||
    rightsDepKindId === RIGHTS_DEPKIND_REGIONAL ||
    rightsDepKindId === RIGHTS_DEPKIND_REPUBLIC
  )
}

function canShowOutgoingSmrMarkReady(
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
  'Направление сведений участникам ОП 58: после подтверждения выполняется валидация карты, затем статус «Ожидает отправки».'

const hintNewToPending =
  'Новое → Ожидает отправки (направление в ОП 58 после валидации).'

const sendOp57Button: StatusButtonConfig = {
  label: 'Направление сведений',
  action: 'send',
  hint: hintSendOp57,
}

export function outgoingSmrStatusButton(
  smrStatusCode: string | null | undefined,
  statusId: number | null | undefined,
  statusName: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  resolutions: SmrResolutionRow[],
  userDepKindCode: string | null | undefined,
  userDepKindName: string | null | undefined,
  rightsDepKindId: number | null | undefined
): StatusButtonResult {
  const noSt = hintNoStatusRight()
  const noSend = hintNoSendRight()
  const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
  const hasRegionalDep0602 = hasRegionalResolutionForSend(resolutions)
  const hasDistrictRes = hasDistrictResolution(resolutions)

  if (!hasStatusRight) {
    return { config: null, comment: noSt }
  }

  const code = norm(smrStatusCode)
  if (code) {
    if (code === 'new' || code === 'failed' || code === 'error') {
      if (hasSendRight) {
        return {
          config: code === 'new'
            ? { label: 'Направление сведений', action: 'send', hint: hintNewToPending }
            : sendOp57Button,
          comment: code === 'new' ? hintNewToPending : hintSendOp57,
        }
      }
      if (code === 'new' && canShowOutgoingSmrMarkReady(rightsDepKindId, code, hasDistrictRes, hasRegionalDep0602)) {
        const isRegionalOnNew = rightsDepKindId === RIGHTS_DEPKIND_REGIONAL
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
      return { config: null, comment: noSend }
    }
    if (canShowOutgoingSmrMarkReady(rightsDepKindId, code, hasDistrictRes, hasRegionalDep0602)) {
      const draftHint =
        userDepKindName && userDepKindName.trim()
          ? `Наложение резолюции уровня «${userDepKindName.trim()}» и перевод в «Новое».`
          : 'Наложение резолюции и перевод карты в статус «Новое».'
      return {
        config: {
          label: resolutionLabel,
          action: 'mark_ready',
          hint: draftHint,
        },
        comment: draftHint,
      }
    }
    if (code === 'draft' && !rightsAllowMarkReadyDraft(rightsDepKindId)) {
      return { config: null, comment: hintRightsDepKindId() }
    }
    if (code === 'pending' || code === 'sent') {
      return { config: null, comment: '' }
    }
    if (code === 'delivered') {
      return { config: null, comment: '' }
    }
  }

  const sid = statusId ?? -1
  const fallbackCode =
    sid === SMR_DRAFT
      ? 'draft'
      : sid === SMR_NEW
        ? 'new'
        : sid === SMR_FAILED
          ? 'failed'
          : sid === SMR_ERROR
            ? 'error'
            : sid === SMR_PENDING || sid === SMR_SENT
              ? 'pending'
              : ''
  if (fallbackCode === 'new' || fallbackCode === 'failed' || fallbackCode === 'error') {
    if (hasSendRight) {
      return {
        config: fallbackCode === 'new'
          ? { label: 'Направление сведений', action: 'send', hint: hintNewToPending }
          : sendOp57Button,
        comment: fallbackCode === 'new' ? hintNewToPending : hintSendOp57,
      }
    }
    return { config: null, comment: noSend }
  }
  if (fallbackCode) {
    if (canShowOutgoingSmrMarkReady(rightsDepKindId, fallbackCode, hasDistrictRes, hasRegionalDep0602)) {
      const draftHint =
        userDepKindName && userDepKindName.trim()
          ? `Наложение резолюции уровня «${userDepKindName.trim()}» и перевод в «Новое».`
          : 'Наложение резолюции и перевод карты в статус «Новое».'
      return {
        config: {
          label: resolutionLabel,
          action: 'mark_ready',
          hint: draftHint,
        },
        comment: draftHint,
      }
    }
    if (fallbackCode === 'pending') {
      return { config: null, comment: '' }
    }
  }
  if (sid === SMR_PENDING || sid === SMR_SENT) {
    return { config: null, comment: '' }
  }
  if (sid === SMR_FAILED || sid === SMR_ERROR) {
    if (hasSendRight) {
      return {
        config: sendOp57Button,
        comment: hintSendOp57,
      }
    }
    return { config: null, comment: noSend }
  }
  if (sid === SMR_DELIVERED) {
    return { config: null, comment: '' }
  }

  const s = norm(statusName)
  if (s.includes('черновик')) {
    if (canShowOutgoingSmrMarkReady(rightsDepKindId, 'draft', hasDistrictRes, hasRegionalDep0602)) {
      return {
        config: { label: resolutionLabel, action: 'mark_ready', hint: 'Перевод в «Новое» с резолюцией.' },
        comment: 'Черновик',
      }
    }
    return { config: null, comment: hintRightsDepKindId() }
  }
  if (s.includes('новое') || s.includes('новая')) {
    if (hasSendRight) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintNewToPending },
        comment: hintNewToPending,
      }
    }
    if (canShowOutgoingSmrMarkReady(rightsDepKindId, 'new', hasDistrictRes, hasRegionalDep0602)) {
      return {
        config: { label: resolutionLabel, action: 'mark_ready', hint: 'Наложение резолюции областного уровня.' },
        comment: 'Новое',
      }
    }
    return { config: null, comment: noSend }
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

const HINT_INCOMING_COMPLETE_NO_RIGHT =
  'Недостаточно прав: требуется sanitaryMeasureOut:status с пересечением подразделений с доступом к связанной карте SMD (SMDDEPPERMIS).'

export function incomingSmrCompleteProcessingButton(
  smrStatusCode: string | null | undefined,
  _statusId: number | null | undefined,
  statusName: string,
  hasCompleteRight: boolean
): StatusButtonResult {
  const noR = HINT_INCOMING_COMPLETE_NO_RIGHT
  if (!hasCompleteRight) {
    return { config: null, comment: noR }
  }
  const code = norm(smrStatusCode)
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
