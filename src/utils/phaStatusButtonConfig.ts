/**
 * Кнопки смены статуса для карт PHA (справочник PHASTATUS, PHA.PHASTATUSID).
 * Входящие: Получено → В обработке (при открытии); В обработке → Обработано; Обработано → Завершено.
 * Исходящие: Новое (5) / Отправка не удалась (8) / Ошибка обработки (9) → Ожидает отправки (send); DATASOURCEKINDCODE=2;
 * Отправка не удалась/Ошибка → Новое (to_new); Новое/Отправка не удалась/Ошибка/Доставлено → Завершено (close).
 * Права: publicHealthIn:status (входящие); publicHealthOut:status (закрытие, to_new), publicHealthOut:send (направление).
 */
import type { StatusButtonConfig, StatusButtonResult } from '@/utils/statusButtonConfig'

const HINT_NO_STATUS_RIGHT_IN =
  'Недостаточно прав: для смены статуса требуется право publicHealthIn:status.'
const HINT_NO_STATUS_RIGHT_OUT =
  'Недостаточно прав: для смены статуса требуется право publicHealthOut:status.'
const HINT_NO_SEND_RIGHT =
  'Недостаточно прав: для направления сведений требуется право publicHealthOut:send в пределах подразделения с доступом к карте (PHADEPPERMIS).'

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/** Заполнена ли дата закрытия ситуации (csdo:EndDate в уведомлении). */
export function phaSituationEndDateFilled(notificationEndDate: unknown): boolean {
  if (notificationEndDate == null) return false
  return String(notificationEndDate).trim() !== ''
}

/** Исходящие PHA: закрытие допускается в статусах 5, 8, 9, 10 (и по тексту статуса). */
export function phaOutgoingCloseAllowed(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  _situationEndDateFilled?: boolean
): { allowed: boolean; hint?: string } {
  if (!hasStatusRight) return { allowed: false, hint: HINT_NO_STATUS_RIGHT_OUT }
  const s = norm(status)
  const idOk = statusId === 5 || statusId === 8 || statusId === 9 || statusId === 10
  const textOk =
    (s.includes('новое') && !s.includes('ожидает')) ||
    s.includes('не удалась') ||
    s.includes('ошибка обработки') ||
    s.includes('доставлено')
  if (!idOk && !textOk) return { allowed: false }
  return { allowed: true }
}

/** Входящие DATASOURCEKINDCODE=1: закрытие — статус «Обработано» (3) и право status. */
export function phaIncomingCloseAllowed(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  _situationEndDateFilled?: boolean
): { allowed: boolean; hint?: string } {
  if (!hasStatusRight) return { allowed: false, hint: HINT_NO_STATUS_RIGHT_IN }
  const s = norm(status)
  const processed = statusId === 3 || (s.includes('обработано') && !s.includes('заверш'))
  if (!processed) return { allowed: false }
  return { allowed: true }
}

function outgoingCloseUi(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  situationEndDateFilled: boolean
): { disabled: boolean; hint: string } {
  const r = phaOutgoingCloseAllowed(statusId, status, hasStatusRight, situationEndDateFilled)
  const hint = r.hint ?? 'Переход в статус «Завершено».'
  return { disabled: !r.allowed, hint }
}

/** Входящая карта PHA по названию источника */
export function isPhaIncomingSource(source: string | undefined): boolean {
  return norm(source).includes('входящ')
}

/** Исходящая карта PHA по названию источника */
export function isPhaOutgoingSource(source: string | undefined): boolean {
  return norm(source).includes('исходящ')
}

/** Участники ОП 57: направление только из статусов NEW / FAILED / ERROR (id 5, 8, 9 или по тексту). */
export function phaOutgoingSendOp57Allowed(statusId: number | null | undefined, status: string): boolean {
  const s = norm(status)
  if (statusId === 5 || statusId === 8 || statusId === 9) return true
  return (
    (s.includes('новое') && !s.includes('ожидает')) ||
    s.includes('не удалась') ||
    s.includes('ошибка обработки')
  )
}

/**
 * Кнопка смены статуса для входящей карты PHA.
 */
export function incomingPhaStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  situationEndDateFilled?: boolean
): StatusButtonResult {
  const s = norm(status)

  if (s.includes('заверш')) {
    return {
      config: null,
      comment: 'Карта в статусе «Завершено»; дальнейшие переходы не предусмотрены.',
    }
  }

  if (s.includes('получен') && !s.includes('обработ')) {
    return {
      config: null,
      comment:
        'Статус «Получено»: при первичном открытии карты выполняется автоматический переход в «В обработке».',
    }
  }

  const isProcessing = statusId === 2 || (s.includes('обработке') && !s.includes('обработано'))
  if (isProcessing) {
    if (!hasStatusRight) {
      return { config: null, comment: HINT_NO_STATUS_RIGHT_IN }
    }
    return {
      config: {
        label: 'Завершение обработки',
        action: 'pha_complete_processing',
        hint: 'Переход карты в статус «Обработано».',
        disabled: false,
      },
      comment: 'Переход карты в статус «Обработано».',
    }
  }

  const isProcessed = statusId === 3 || (s.includes('обработано') && !s.includes('заверш'))
  if (isProcessed) {
    const canClose = phaIncomingCloseAllowed(statusId, status, hasStatusRight, situationEndDateFilled)
    if (!canClose.allowed) {
      return { config: null, comment: canClose.hint ?? HINT_NO_STATUS_RIGHT_IN }
    }
    return {
      config: {
        label: 'Закрытие карты',
        action: 'pha_close',
        hint: 'Переход карты в статус «Завершено».',
        disabled: false,
      },
      comment: 'Переход карты в статус «Завершено».',
    }
  }

  return {
    config: null,
    comment: 'Кнопка смены статуса не отображается: для текущего статуса входящей карты PHA переход не предусмотрен.',
  }
}

/**
 * Кнопки смены статуса для исходящей карты PHA.
 * send — publicHealthOut:send; close, to_new — publicHealthOut:status.
 */
export function outgoingPhaStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  situationEndDateFilled?: boolean
): StatusButtonResult {
  const s = norm(status)
  const endFilled = situationEndDateFilled === true

  if (s.includes('заверш')) {
    return {
      config: null,
      comment: 'Карта в статусе «Завершено»; дальнейшие переходы не предусмотрены.',
    }
  }

  if (s.includes('ожидает отправки') || s.includes('отправлено')) {
    return {
      config: null,
      comment:
        s.includes('ожидает')
          ? 'Ожидает отправки в Комиссию и УО ЕАЭС; переход выполняется системой.'
          : 'Статус «Отправлено»; дальнейшие переходы выполняются системой (ответ Комиссии).',
    }
  }

  const canSend = phaOutgoingSendOp57Allowed(statusId, status)
  const canClose =
    statusId === 5 ||
    statusId === 8 ||
    statusId === 9 ||
    statusId === 10 ||
    (s.includes('новое') && !s.includes('ожидает')) ||
    s.includes('не удалась') ||
    s.includes('ошибка обработки') ||
    s.includes('доставлено')
  const canToNew = s.includes('не удалась') || s.includes('ошибка обработки')
  const closeUi = () => outgoingCloseUi(statusId, status, hasStatusRight, endFilled)

  const sendCfg = (): StatusButtonConfig => ({
    label: 'Направить сведения',
    action: 'pha_send',
    hint: 'Направить сведения участникам ОП 57 (переход в «Ожидает отправки»).',
    disabled: false,
  })

  const closeCfg = (hint: string): StatusButtonConfig => ({
    label: 'Закрытие карты',
    action: 'pha_close',
    hint,
    disabled: false,
  })

  if (canToNew) {
    const cu = closeUi()
    const toNewBtn: StatusButtonConfig | null = hasStatusRight
      ? {
          label: 'Перевести в Новое',
          action: 'pha_to_new',
          hint: 'Перевод в статус «Новое» после редактирования сведений.',
          disabled: false,
        }
      : null
    const closeSecondary =
      canClose && !cu.disabled && hasStatusRight ? closeCfg(cu.hint) : undefined

    let comment: string
    if (toNewBtn && closeSecondary) {
      comment = 'Доступны перевод в «Новое» и закрытие карты.'
    } else if (toNewBtn) {
      comment = 'Перевести в Новое после редактирования.'
    } else if (closeSecondary) {
      comment = 'Закрытие карты.'
    } else {
      comment = cu.disabled ? (cu.hint ?? HINT_NO_STATUS_RIGHT_OUT) : HINT_NO_STATUS_RIGHT_OUT
    }
    return {
      config: toNewBtn,
      closeConfig: closeSecondary,
      comment,
    }
  }

  if (canSend && canClose) {
    const cu = closeUi()
    const showSend = hasSendRight
    const showClose = !cu.disabled
    if (showSend && showClose) {
      return {
        config: sendCfg(),
        closeConfig: closeCfg(cu.hint),
        comment: 'Направить сведения участникам ОП 57; доступно закрытие карты.',
      }
    }
    if (showSend) {
      return {
        config: sendCfg(),
        comment: 'Направить сведения участникам ОП 57.',
      }
    }
    if (showClose) {
      return {
        config: closeCfg(cu.hint),
        comment: 'Закрытие карты.',
      }
    }
    return {
      config: null,
      comment: cu.disabled ? cu.hint ?? HINT_NO_STATUS_RIGHT_OUT : HINT_NO_SEND_RIGHT,
    }
  }

  if (canSend) {
    if (!hasSendRight) return { config: null, comment: HINT_NO_SEND_RIGHT }
    return {
      config: sendCfg(),
      comment: 'Направить сведения участникам ОП 57.',
    }
  }

  if (canClose) {
    const cu = closeUi()
    if (cu.disabled) return { config: null, comment: cu.hint ?? HINT_NO_STATUS_RIGHT_OUT }
    return {
      config: closeCfg(cu.hint),
      comment: 'Закрытие карты.',
    }
  }

  return {
    config: null,
    comment: 'Кнопка смены статуса не отображается: для текущего статуса исходящей карты PHA переход не предусмотрен.',
  }
}
