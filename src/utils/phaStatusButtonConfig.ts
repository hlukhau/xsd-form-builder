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
const HINT_END_DATE_CLOSE_IN =
  'Укажите дату закрытия (архивации) нежелательной ситуации (csdo:EndDate) во вкладке «Уведомление».'
const HINT_END_DATE_CLOSE_OUT_DELIVERED =
  'При статусе «Доставлено» для закрытия карты укажите дату закрытия (архивации) нежелательной ситуации (csdo:EndDate).'

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/** Заполнена ли дата закрытия ситуации (csdo:EndDate в уведомлении). */
export function phaSituationEndDateFilled(notificationEndDate: unknown): boolean {
  if (notificationEndDate == null) return false
  return String(notificationEndDate).trim() !== ''
}

/** Исходящие PHA: закрытие допускается в статусах 5, 8, 9, 10 (и по тексту); при «Доставлено»/10 — нужна EndDate. */
export function phaOutgoingCloseAllowed(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  situationEndDateFilled: boolean
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
  const needsEndDate = statusId === 10 || (s.includes('доставлено') && !s.includes('заверш'))
  if (needsEndDate && !situationEndDateFilled) {
    return { allowed: false, hint: HINT_END_DATE_CLOSE_OUT_DELIVERED }
  }
  return { allowed: true }
}

/** Входящие: закрытие — статус «Обработано» (3) и указана EndDate. */
export function phaIncomingCloseAllowed(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  situationEndDateFilled: boolean
): { allowed: boolean; hint?: string } {
  if (!hasStatusRight) return { allowed: false, hint: HINT_NO_STATUS_RIGHT_IN }
  const s = norm(status)
  const processed = statusId === 3 || (s.includes('обработано') && !s.includes('заверш'))
  if (!processed) return { allowed: false }
  if (!situationEndDateFilled) return { allowed: false, hint: HINT_END_DATE_CLOSE_IN }
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
    return {
      config: {
        label: 'Завершение обработки',
        action: 'pha_complete_processing',
        hint: 'Переход карты в статус «Обработано».',
        disabled: !hasStatusRight,
      },
      comment: hasStatusRight
        ? 'Переход карты в статус «Обработано».'
        : HINT_NO_STATUS_RIGHT_IN,
    }
  }

  const isProcessed = statusId === 3 || (s.includes('обработано') && !s.includes('заверш'))
  if (isProcessed) {
    const endFilled = situationEndDateFilled === true
    const canClose = phaIncomingCloseAllowed(statusId, status, hasStatusRight, endFilled)
    return {
      config: {
        label: 'Закрытие карты',
        action: 'pha_close',
        hint: canClose.hint ?? 'Переход карты в статус «Завершено».',
        disabled: !canClose.allowed,
      },
      comment: canClose.allowed
        ? 'Переход карты в статус «Завершено».'
        : canClose.hint ?? HINT_NO_STATUS_RIGHT_IN,
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

  if (canToNew) {
    const cu = closeUi()
    return {
      config: {
        label: 'Перевести в Новое',
        action: 'pha_to_new',
        hint: 'Перевод в статус «Новое» после редактирования сведений.',
        disabled: !hasStatusRight,
      },
      comment: hasStatusRight ? 'Перевести в Новое после редактирования.' : HINT_NO_STATUS_RIGHT_OUT,
      closeConfig: canSend
        ? {
            label: 'Направить сведения',
            action: 'pha_send',
            hint: 'Направить сведения участникам ОП 57 (статус «Ожидает отправки»).',
            disabled: !hasSendRight,
          }
        : canClose
          ? {
              label: 'Закрытие карты',
              action: 'pha_close',
              hint: cu.hint,
              disabled: cu.disabled,
            }
          : undefined,
    }
  }

  if (canSend && canClose) {
    const cu = closeUi()
    return {
      config: {
        label: 'Направить сведения',
        action: 'pha_send',
        hint: 'Направить сведения участникам ОП 57 (переход в «Ожидает отправки»).',
        disabled: !hasSendRight,
      },
      comment: hasSendRight ? 'Направить сведения участникам ОП 57.' : HINT_NO_SEND_RIGHT,
      closeConfig: {
        label: 'Закрытие карты',
        action: 'pha_close',
        hint: cu.hint,
        disabled: cu.disabled,
      },
    }
  }

  if (canSend) {
    return {
      config: {
        label: 'Направить сведения',
        action: 'pha_send',
        hint: 'Направить сведения участникам ОП 57 (переход в «Ожидает отправки»).',
        disabled: !hasSendRight,
      },
      comment: hasSendRight ? 'Направить сведения участникам ОП 57.' : HINT_NO_SEND_RIGHT,
    }
  }

  if (canClose) {
    const cu = closeUi()
    return {
      config: {
        label: 'Закрытие карты',
        action: 'pha_close',
        hint: cu.hint,
        disabled: cu.disabled,
      },
      comment: cu.disabled ? cu.hint ?? HINT_NO_STATUS_RIGHT_OUT : 'Закрытие карты.',
    }
  }

  return {
    config: null,
    comment: 'Кнопка смены статуса не отображается: для текущего статуса исходящей карты PHA переход не предусмотрен.',
  }
}
