/**
 * Конфигурация кнопки смены статуса по источнику карты и текущему статусу.
 * Логика по DPASTATUSID (таблица DPASTATUS). При отсутствии statusId — запасная проверка по названию.
 * Входящие (1–4): PROCESSING→Завершение обработки, PROCESSED→Закрытие карты.
 * Исходящие (5–13): DRAFT/NEW→резолюция, NEW/PENDING/FAILED/ERROR/EDITED→Направление/Закрытие, DELIVERED→Закрытие.
 */
export interface StatusButtonConfig {
  label: string
  action: string
  /** Подсказка для пользователя: что выполнит кнопка (переход в какое состояние или наложение резолюции) */
  hint?: string
  disabled?: boolean
}

export interface StatusButtonResult {
  config: StatusButtonConfig | null
  /** Комментарий: при наличии кнопки — что она выполнит; при отсутствии — почему кнопки нет */
  comment: string
  /** Вторая кнопка «Закрытие карты», когда допустимы оба действия (направление сведений и закрытие) */
  closeConfig?: StatusButtonConfig | null
}

/** DPASTATUSID: входящие 1–4, исходящие 5–13 (DRAFT=5, NEW=6, PENDING=7, SENT=8, FAILED=9, ERROR=10, DELIVERED=11, EDITED=12, COMPLETED=13) */
const INCOMING_PROCESSING = 2
const INCOMING_PROCESSED = 3
const OUTGOING_DRAFT = 5
const OUTGOING_NEW = 6
const OUTGOING_PENDING = 7
const OUTGOING_SENT = 8
const OUTGOING_FAILED = 9
const OUTGOING_ERROR = 10
const OUTGOING_DELIVERED = 11
const OUTGOING_EDITED = 12

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/** Подсказка при отсутствии права: кнопка отображается задизейбленной */
const HINT_NO_STATUS_RIGHT_IN =
  'Недостаточно прав: для смены статуса входящих сведений требуется право dangerousProductIn:status.'
const HINT_NO_STATUS_RIGHT_OUT =
  'Недостаточно прав: для смены статуса исходящих сведений (закрытие карты, отметка готовности) требуется право dangerousProductOut:status.'

/** Дата закрытия (csdo:EndDate) не влияет на доступность кнопки «Закрытие карты». */
function incomingStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasRight: boolean,
  _notificationEndDate?: string | null
): StatusButtonResult {
  if (!hasRight) {
    const s = norm(status)
    const isProcessing = statusId === INCOMING_PROCESSING || s.includes('в обработке')
    const isProcessed = statusId === INCOMING_PROCESSED || (s.includes('обработано') && !s.includes('завершено'))
    const label = isProcessing ? 'Завершение обработки' : isProcessed ? 'Закрытие карты' : 'Смена статуса'
    const action = isProcessing ? 'complete_processing' : isProcessed ? 'close' : 'complete_processing'
    return {
      config: { label, action, disabled: true, hint: HINT_NO_STATUS_RIGHT_IN },
      comment: HINT_NO_STATUS_RIGHT_IN,
    }
  }
  if (statusId === INCOMING_PROCESSING) {
    return {
      config: {
        label: 'Завершение обработки',
        action: 'complete_processing',
        hint: 'Переход карты в состояние «Обработано» (завершение обработки входящих сведений).',
      },
      comment: 'Переход карты в состояние «Обработано».',
    }
  }
  if (statusId === INCOMING_PROCESSED) {
    return {
      config: {
        label: 'Закрытие карты',
        action: 'close',
        hint: 'Переход карты в состояние «Завершено» (закрытие входящей карты).',
      },
      comment: 'Переход карты в состояние «Завершено».',
    }
  }
  const s = norm(status)
  if (s.includes('в обработке')) {
    return {
      config: {
        label: 'Завершение обработки',
        action: 'complete_processing',
        hint: 'Переход карты в состояние «Обработано».',
      },
      comment: 'Переход карты в состояние «Обработано».',
    }
  }
  if (s.includes('обработано') && !s.includes('завершено')) {
    return {
      config: {
        label: 'Закрытие карты',
        action: 'close',
        hint: 'Переход карты в состояние «Завершено».',
      },
      comment: 'Переход карты в состояние «Завершено».',
    }
  }
  return {
    config: null,
    comment: 'Кнопка смены статуса не отображается: для текущего статуса входящей карты дальнейшие переходы не предусмотрены.',
  }
}

/** Подсказка, когда для действия нужна уже наложенная резолюция */
const NO_RESOLUTION_HINT =
  'Для выполнения действия необходима соответствующая резолюция (районного, областного или республиканского ЦГЭ).'

/** Текст кнопки наложения резолюции по уровню пользователя (DEPKINDCODE) */
function getResolutionButtonLabel(depKindCode: string | null | undefined): string {
  if (!depKindCode) return 'Отметка готовности'
  const c = depKindCode.trim().toLowerCase()
  if (c === 'dep0601') return 'Резолюция районного ЦГЭ'
  if (c === 'dep0602') return 'Резолюция областного ЦГЭ'
  if (c === 'dep0603') return 'Резолюция республиканского ЦГЭ'
  return 'Отметка готовности'
}

/** Подсказка при наложении резолюции в статусе «Черновик»: переход в «Новое». */
function getResolutionHintFromDraft(depKindCode: string | null | undefined): string {
  if (!depKindCode) return 'Наложение отметки готовности — переход карты в состояние «Новое».'
  const c = depKindCode.trim().toLowerCase()
  if (c === 'dep0601') return 'Наложение резолюции районного ЦГЭ — переход карты в состояние «Новое».'
  if (c === 'dep0602') return 'Наложение резолюции областного ЦГЭ — переход карты в состояние «Новое».'
  if (c === 'dep0603') return 'Наложение резолюции республиканского ЦГЭ — переход карты в состояние «Новое».'
  return 'Наложение отметки готовности — переход карты в состояние «Новое».'
}

/** Подсказка при наложении резолюции в статусе «Новое»: добавление резолюции вашего уровня, статус остаётся «Новое»; после резолюции областного или республиканского ЦГЭ станет доступно направление сведений. */
function getResolutionHintWhenAlreadyNew(depKindCode: string | null | undefined): string {
  if (!depKindCode) return 'Добавление резолюции вашего уровня. Карта остаётся в состоянии «Новое». После резолюции областного или республиканского ЦГЭ станет доступно направление сведений.'
  const c = depKindCode.trim().toLowerCase()
  if (c === 'dep0601') return 'Добавление резолюции районного ЦГЭ. Карта остаётся в состоянии «Новое».'
  if (c === 'dep0602') return 'Добавление резолюции областного ЦГЭ. Карта остаётся в состоянии «Новое»; после этого станет доступно направление сведений в ЕЭК.'
  if (c === 'dep0603') return 'Добавление резолюции республиканского ЦГЭ. Карта остаётся в состоянии «Новое»; после этого станет доступно направление сведений в ЕЭК.'
  return 'Добавление резолюции вашего уровня. Карта остаётся в состоянии «Новое».'
}

/** Подсказка для черновика: резолюций ещё нет — ожидается резолюция уровня пользователя (по коду или по названию из карты прав) */
function getResolutionHintForDraft(
  depKindCode: string | null | undefined,
  depKindName: string | null | undefined
): string {
  if (depKindCode && depKindCode.trim()) {
    const c = depKindCode.trim().toLowerCase()
    if (c === 'dep0601') return 'Ожидается резолюция районного ЦГЭ.'
    if (c === 'dep0602') return 'Ожидается резолюция областного ЦГЭ.'
    if (c === 'dep0603') return 'Ожидается резолюция республиканского ЦГЭ.'
  }
  if (depKindName && depKindName.trim()) {
    return `Ожидается резолюция: ${depKindName.trim()}.`
  }
  return 'Ожидается резолюция (уровень ЦГЭ определяется по подразделению пользователя в карте прав доступа).'
}

function outgoingStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  hasResolution: boolean,
  userDepKindCode: string | null | undefined,
  existingResolutionDepKindCodes: string[] | undefined,
  userDepKindName?: string | null,
  _notificationEndDate?: string | null
): StatusButtonResult {
  if (!hasStatusRight && !hasSendRight) {
    const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
    return {
      config: {
        label: resolutionLabel,
        action: 'mark_ready',
        disabled: true,
        hint: 'Недостаточно прав: для смены статуса требуется право dangerousProductOut:status, для направления сведений — dangerousProductOut:send.',
      },
      comment: 'Недостаточно прав: для смены статуса требуется право dangerousProductOut:status, для направления сведений — dangerousProductOut:send.',
    }
  }
  const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
  const hasResolutionOfUserLevel =
    userDepKindCode &&
    Array.isArray(existingResolutionDepKindCodes) &&
    existingResolutionDepKindCodes.some((c) => norm(c) === norm(userDepKindCode))

  const hintSend = 'Направление сведений в ЕЭК — переход карты в состояние «Ожидает отправки».'
  /** Подсказка, когда при статусе «Новое» уже есть резолюция областного/республиканского ЦГЭ — следующий шаг «Ожидает отправки». */
  const hintNewToPending = 'Новое + резолюция областного ЦГЭ → Ожидает отправки'
  const hintClose = 'Закрытие карты — переход в состояние «Завершено» (без направления в ЕЭК).'
  /** «Направление сведений» при статусе Новое разрешено только при резолюции областного или республиканского ЦГЭ. */
  const hasRegionalOrRepublicanResolution =
    Array.isArray(existingResolutionDepKindCodes) &&
    existingResolutionDepKindCodes.some((c) => {
      const x = norm(c)
      return x === 'dep0602' || x === 'dep0603'
    })
  const NEED_REGIONAL_OR_REPUBLICAN_HINT =
    'Ожидается резолюция областного или республиканского ЦГЭ.'

  // По DPASTATUSID (исходящие 5–13)
  if (statusId === OUTGOING_DRAFT) {
    if (!hasStatusRight) {
      return {
        config: {
          label: resolutionLabel,
          action: 'mark_ready',
          disabled: true,
          hint: HINT_NO_STATUS_RIGHT_OUT,
        },
        comment: HINT_NO_STATUS_RIGHT_OUT,
      }
    }
    const draftComment = getResolutionHintForDraft(userDepKindCode, userDepKindName)
    const draftButtonHint = getResolutionHintFromDraft(userDepKindCode)
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: draftButtonHint },
      comment: draftComment,
    }
  }
  if (statusId === OUTGOING_NEW) {
    // При статусе «Новое» и уже наложенной резолюции областного/республиканского ЦГЭ — следующий шаг «Направление сведений» → «Ожидает отправки»
    if (hasRegionalOrRepublicanResolution && hasSendRight) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintNewToPending },
        comment: hintNewToPending,
        closeConfig: hasStatusRight
          ? { label: 'Закрытие карты', action: 'close', hint: hintClose }
          : { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
      }
    }
    if (hasRegionalOrRepublicanResolution && !hasSendRight && hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        comment: hintClose,
      }
    }
    if (hasStatusRight && !hasResolutionOfUserLevel) {
      const hintNew = getResolutionHintWhenAlreadyNew(userDepKindCode)
      return {
        config: { label: resolutionLabel, action: 'mark_ready', hint: hintNew },
        comment: hintNew,
      }
    }
    // После резолюции районного ЦГЭ — только ожидание резолюции областного/республиканского (кнопка заблокирована)
    if (hasResolution && !hasRegionalOrRepublicanResolution) {
      return {
        config: {
          label: 'Направление сведений',
          action: 'send',
          hint: NEED_REGIONAL_OR_REPUBLICAN_HINT,
          disabled: true,
        },
        comment: NEED_REGIONAL_OR_REPUBLICAN_HINT,
      }
    }
    if (hasStatusRight && hasResolutionOfUserLevel && hasRegionalOrRepublicanResolution) {
      if (hasSendRight) {
        return {
          config: { label: 'Направление сведений', action: 'send', hint: hintSend },
          comment: hintSend,
        }
      }
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        comment: hintClose,
      }
    }
    if (!hasResolution) {
      return {
        config: {
          label: hasSendRight ? 'Направление сведений' : 'Закрытие карты',
          action: hasSendRight ? 'send' : 'close',
          hint: NO_RESOLUTION_HINT,
          disabled: true,
        },
        comment: NO_RESOLUTION_HINT,
      }
    }
    if (hasSendRight && hasRegionalOrRepublicanResolution) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintSend },
        comment: hintSend,
        closeConfig: hasStatusRight
          ? { label: 'Закрытие карты', action: 'close', hint: hintClose }
          : { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
      }
    }
    if (hasSendRight && !hasRegionalOrRepublicanResolution) {
      return {
        config: {
          label: 'Направление сведений',
          action: 'send',
          hint: NEED_REGIONAL_OR_REPUBLICAN_HINT,
          disabled: true,
        },
        comment: NEED_REGIONAL_OR_REPUBLICAN_HINT,
      }
    }
    if (hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        comment: hintClose,
      }
    }
    return {
      config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
      comment: HINT_NO_STATUS_RIGHT_OUT,
    }
  }
  if (statusId === OUTGOING_PENDING) {
    const comment =
      'Ожидает отправки в ЕЭК; следующее изменение статуса (Отправлено / Отправка не удалась / Ошибка обработки / Доставлено) выполняется системой.'
    return {
      config: {
        label: 'Смена статуса',
        action: 'pending_system',
        disabled: true,
        hint: comment,
      },
      comment,
    }
  }
  if (statusId === OUTGOING_FAILED || statusId === OUTGOING_ERROR || statusId === OUTGOING_EDITED) {
    if (hasSendRight) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintSend },
        comment: hintSend,
        closeConfig: hasStatusRight
          ? { label: 'Закрытие карты', action: 'close', hint: hintClose }
          : { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
      }
    }
    if (hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        comment: hintClose,
      }
    }
    return {
      config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
      comment: HINT_NO_STATUS_RIGHT_OUT,
    }
  }
  if (statusId === OUTGOING_DELIVERED) {
    if (!hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
        comment: HINT_NO_STATUS_RIGHT_OUT,
      }
    }
    if (!hasResolution) {
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: NO_RESOLUTION_HINT, disabled: true },
        comment: NO_RESOLUTION_HINT,
      }
    }
    return {
      config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
      comment: hintClose,
    }
  }
  if (statusId === OUTGOING_SENT || statusId === 13) {
    const comment =
      statusId === OUTGOING_SENT
        ? 'Карта уже в состоянии «Отправлено», дальнейшие переходы выполняются системой.'
        : 'Карта в состоянии «Завершено», дальнейшие переходы не предусмотрены.'
    return {
      config: {
        label: 'Смена статуса',
        action: statusId === OUTGOING_SENT ? 'sent_system' : 'completed_no_transitions',
        disabled: true,
        hint: comment,
      },
      comment,
    }
  }

  // Запасная проверка по названию (карты без statusId, например из XML)
  const s = norm(status)
  if (s.includes('черновик') || s.includes('создан')) {
    if (!hasStatusRight) {
      return {
        config: {
          label: resolutionLabel,
          action: 'mark_ready',
          disabled: true,
          hint: HINT_NO_STATUS_RIGHT_OUT,
        },
        comment: HINT_NO_STATUS_RIGHT_OUT,
      }
    }
    const draftComment = getResolutionHintForDraft(userDepKindCode, userDepKindName)
    const draftButtonHint = getResolutionHintFromDraft(userDepKindCode)
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: draftButtonHint },
      comment: draftComment,
    }
  }
  if (s.includes('новое') || s.includes('новая') || s === 'новый') {
    if (hasRegionalOrRepublicanResolution && hasSendRight) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintNewToPending },
        comment: hintNewToPending,
        closeConfig: hasStatusRight
          ? { label: 'Закрытие карты', action: 'close', hint: hintClose }
          : { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
      }
    }
    if (hasRegionalOrRepublicanResolution && !hasSendRight && hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        comment: hintClose,
      }
    }
    if (hasStatusRight && !hasResolutionOfUserLevel) {
      const hintNew = getResolutionHintWhenAlreadyNew(userDepKindCode)
      return {
        config: { label: resolutionLabel, action: 'mark_ready', hint: hintNew },
        comment: hintNew,
      }
    }
    if (hasResolution && !hasRegionalOrRepublicanResolution) {
      return {
        config: {
          label: 'Направление сведений',
          action: 'send',
          hint: NEED_REGIONAL_OR_REPUBLICAN_HINT,
          disabled: true,
        },
        comment: NEED_REGIONAL_OR_REPUBLICAN_HINT,
      }
    }
    if (hasStatusRight && hasResolutionOfUserLevel && hasRegionalOrRepublicanResolution) {
      if (hasSendRight) {
        return {
          config: { label: 'Направление сведений', action: 'send', hint: hintSend },
          comment: hintSend,
          closeConfig: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        }
      }
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        comment: hintClose,
      }
    }
    if (!hasResolution) {
      return {
        config: {
          label: hasSendRight ? 'Направление сведений' : 'Закрытие карты',
          action: hasSendRight ? 'send' : 'close',
          hint: NO_RESOLUTION_HINT,
          disabled: true,
        },
        comment: NO_RESOLUTION_HINT,
      }
    }
    if (hasSendRight && hasRegionalOrRepublicanResolution) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintSend },
        comment: hintSend,
        closeConfig: hasStatusRight
          ? { label: 'Закрытие карты', action: 'close', hint: hintClose }
          : { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
      }
    }
    if (hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        comment: hintClose,
      }
    }
    return {
      config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
      comment: HINT_NO_STATUS_RIGHT_OUT,
    }
  }
  if (s.includes('ожидает отправки')) {
    const comment = 'Ожидает отправки в ЕЭК; следующее изменение статуса выполняется системой.'
    return {
      config: {
        label: 'Смена статуса',
        action: 'pending_system',
        disabled: true,
        hint: comment,
      },
      comment,
    }
  }
  if (s.includes('отправка не удалась') || s.includes('ошибка обработки') || s.includes('отредактировано')) {
    if (hasSendRight) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: hintSend },
        comment: hintSend,
      }
    }
    if (hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        comment: hintClose,
      }
    }
    return {
      config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
      comment: HINT_NO_STATUS_RIGHT_OUT,
    }
  }
  if (s.includes('доставлено')) {
    if (!hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: HINT_NO_STATUS_RIGHT_OUT },
        comment: HINT_NO_STATUS_RIGHT_OUT,
      }
    }
    if (!hasResolution) {
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: NO_RESOLUTION_HINT, disabled: true },
        comment: NO_RESOLUTION_HINT,
      }
    }
    return {
      config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
      comment: hintClose,
    }
  }
  return {
    config: null,
    comment: 'Кнопка смены статуса не отображается: для текущего статуса исходящей карты действие не определено.',
  }
}

/**
 * Возвращает конфигурацию кнопки смены статуса и комментарий для подсказки.
 * Тип карты определяется по метаданным DATASOURCEKINDCODE: "2" = исходящие (код 3 — из БД ЕЭК).
 * comment: при наличии кнопки — что выполнит кнопка для пользователя данного подразделения;
 * при отсутствии кнопки — почему она не отображается.
 */
export function getStatusButtonConfig(
  source: string | undefined,
  status: string | undefined,
  hasStatusRight: boolean,
  hasSendRight?: boolean,
  hasResolution?: boolean,
  userDepKindCode?: string | null,
  existingResolutionDepKindCodes?: string[],
  statusId?: number | null,
  /** Код типа источника из DPA (DATASOURCEKINDCODE); "2" = исходящие. Приоритет над текстом source. */
  datasourceKindCode?: string | null,
  /** Название уровня ЦГЭ пользователя (из текущего пользователя / карты прав) для подсказки в черновике */
  userDepKindName?: string | null,
  /** Дата закрытия (архивации) csdo:EndDate — на доступность кнопки «Закрытие карты» не влияет */
  notificationEndDate?: string | null
): StatusButtonResult {
  const code = datasourceKindCode != null ? String(datasourceKindCode).trim() : ''
  const src = norm(source)

  // Тип карты по метаданным DATASOURCEKINDCODE (1 = входящие, 2 = исходящие)
  if (code === '1') {
    return incomingStatusButton(statusId, status ?? '', hasStatusRight, notificationEndDate ?? null)
  }
  if (code === '2') {
    return outgoingStatusButton(
      statusId,
      status ?? '',
      hasStatusRight,
      hasSendRight ?? false,
      hasResolution ?? false,
      userDepKindCode ?? null,
      existingResolutionDepKindCodes ?? [],
      userDepKindName ?? null,
      notificationEndDate ?? null
    )
  }

  // Иначе — по названию источника (для карт без кода или до сохранения)
  if (src.includes('исходящ')) {
    return outgoingStatusButton(
      statusId,
      status ?? '',
      hasStatusRight,
      hasSendRight ?? false,
      hasResolution ?? false,
      userDepKindCode ?? null,
      existingResolutionDepKindCodes ?? [],
      userDepKindName ?? null,
      notificationEndDate ?? null
    )
  }
  if (src.includes('входящ')) {
    return incomingStatusButton(statusId, status ?? '', hasStatusRight, notificationEndDate ?? null)
  }
  if (src.includes('еэк')) {
    return {
      config: null,
      comment: 'Кнопка смены статуса не отображается: для карт из ЕЭК смена статуса не предусмотрена.',
    }
  }
  return {
    config: null,
    comment: 'Кнопка смены статуса не отображается: источник карты не определён (по DATASOURCEKINDCODE или названию).',
  }
}
