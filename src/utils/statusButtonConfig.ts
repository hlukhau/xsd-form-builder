/**
 * Конфигурация кнопки смены статуса по источнику карты и текущему статусу.
 * Логика по DPASTATUSID (таблица DPASTATUS). При отсутствии statusId — запасная проверка по названию.
 * Входящие (1–4): PROCESSING→Завершение обработки, PROCESSED→Закрытие карты.
 * Исходящие DPA (5–13): см. `outgoingStatusButtonDpa` — классическая логика по DPASTATUSID.
 * Исходящие PPV: см. `outgoingStatusButtonPpv` / `outgoingPpvNewStatusButtons` — переходы ТЗ (черновик: резолюция любого уровня;
 * новое: областная после районной, направление/закрытие при областной/республиканской; закрытие из AWAITING|PARTIAL|FULFIELD).
 */
export interface StatusButtonConfig {
  label: string
  action: string
  /** Подсказка для пользователя: что выполнит кнопка (переход в какое состояние или наложение резолюции) */
  hint?: string
  disabled?: boolean
}

/** Неактивные кнопки смены статуса в UI не показываются — только активные. */
export function visibleStatusButton(config: StatusButtonConfig | null | undefined): StatusButtonConfig | null {
  if (!config || config.disabled) return null
  return config
}

export interface StatusButtonResult {
  config: StatusButtonConfig | null
  /** Комментарий: при наличии кнопки — что она выполнит; при отсутствии — почему кнопки нет */
  comment: string
  /** Вторая кнопка «Закрытие карты», когда допустимы оба действия (направление сведений и закрытие) */
  closeConfig?: StatusButtonConfig | null
  /** DPR: направление в ОП57 при FAILED/ERROR (рядом с «Перевести в Новое») */
  sendOp57Config?: StatusButtonConfig | null
}

/** DPASTATUSID: входящие 1–4, исходящие 5–13 (DRAFT=5, NEW=6, PENDING=7, SENT=8, FAILED=9, ERROR=10, DELIVERED=11, EDITED=12, COMPLETED=13) */
const INCOMING_RECEIVED = 1
const INCOMING_PROCESSING = 2
const INCOMING_PROCESSED = 3
const INCOMING_COMPLETED = 4
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

/** Соответствие допуску закрытия исходящей PPV по ТЗ (запасная проверка по названию статуса). */
function outgoingPpvCloseAllowedByStatusName(status: string | undefined): boolean {
  const s = norm(status)
  if (!s) return false
  if (s.includes('ожидан') && (s.includes('ответ') || s.includes('ответов'))) return true
  if (s.includes('частич')) return true
  if (s.includes('полност') || s.includes('fulfilled') || s.includes('fulfield')) return true
  if (s.includes('все ответ') || (s.includes('все') && s.includes('ответ'))) return true
  // PROCESSED исходящих (если в справочнике отображается как «Обработано»)
  if (s === 'обработано' || (s.includes('обработан') && !s.includes('заверш'))) return true
  return false
}

/** department.depkindid в карте прав (ТЗ на отметку готовности исходящей PPV). */
const RIGHTS_DEPKIND_DISTRICT = 72
const RIGHTS_DEPKIND_REGIONAL = 73
const RIGHTS_DEPKIND_REPUBLIC = 74

function resolvePpvRightsLevel(
  userDepKindCode: string | null | undefined,
  rightsDepKindId: number | null | undefined
): number | null {
  if (rightsDepKindId === RIGHTS_DEPKIND_DISTRICT || rightsDepKindId === RIGHTS_DEPKIND_REGIONAL
      || rightsDepKindId === RIGHTS_DEPKIND_REPUBLIC) {
    return rightsDepKindId
  }
  const c = norm(userDepKindCode)
  if (c === 'dep0601') return RIGHTS_DEPKIND_DISTRICT
  if (c === 'dep0602') return RIGHTS_DEPKIND_REGIONAL
  if (c === 'dep0603') return RIGHTS_DEPKIND_REPUBLIC
  return null
}

function hintPpvRightsDepKindId(): string {
  return 'Укажите в карте прав department.depkindid: 72 — районный ЦГЭ, 73 — областной, 74 — республиканский.'
}

/** Видимость «Отметить готовность» по ТЗ (depkindid 72/73/74, черновик / новое+районная резолюция). */
export function canShowPpvOutgoingMarkReady(
  rightsDepKindId: number | null | undefined,
  userDepKindCode: string | null | undefined,
  statusCode: string,
  hasDistrictResolutionFlag: boolean,
  hasRegionalResolutionFlag: boolean
): boolean {
  const level = resolvePpvRightsLevel(userDepKindCode, rightsDepKindId)
  const code = norm(statusCode)
  if (level === RIGHTS_DEPKIND_DISTRICT) {
    return code === 'draft'
  }
  if (level === RIGHTS_DEPKIND_REGIONAL) {
    return code === 'draft' || (code === 'new' && hasDistrictResolutionFlag && !hasRegionalResolutionFlag)
  }
  if (level === RIGHTS_DEPKIND_REPUBLIC) {
    return code === 'draft'
  }
  return false
}

function hasDistrictResolution(existingResolutionDepKindCodes: string[] | undefined): boolean {
  return (
    Array.isArray(existingResolutionDepKindCodes) &&
    existingResolutionDepKindCodes.some((c) => norm(c) === 'dep0601')
  )
}

function hasRegionalResolution(existingResolutionDepKindCodes: string[] | undefined): boolean {
  return (
    Array.isArray(existingResolutionDepKindCodes) &&
    existingResolutionDepKindCodes.some((c) => norm(c) === 'dep0602')
  )
}

/** В «Новое» отметку готовности (областная резолюция) ставит только областной ЦГЭ при наличии районной. */
function canPpvMarkReadyInNew(
  userDepKindCode: string | null | undefined,
  existingResolutionDepKindCodes: string[] | undefined
): boolean {
  return (
    norm(userDepKindCode) === 'dep0602' &&
    hasDistrictResolution(existingResolutionDepKindCodes) &&
    !hasRegionalResolution(existingResolutionDepKindCodes)
  )
}

const HINT_PPV_DRAFT_ONLY_DISTRICT =
  'Отметка готовности районного ЦГЭ выполняется из статуса «Черновик».'
const HINT_PPV_DRAFT_ONLY_REPUBLICAN =
  'Отметка готовности республиканского ЦГЭ выполняется из статуса «Черновик».'
const HINT_PPV_NEW_REGIONAL_AFTER_DISTRICT =
  'Новое + резолюция районного ЦГЭ → Новое + резолюция областного ЦГЭ.'
const HINT_PPV_NEW_TO_PENDING =
  'Новое + резолюция областного или республиканского ЦГЭ → Ожидает отправки.'

/** Кнопки для статуса «Новое» (исходящая PPV) — по переходам ТЗ. */
function outgoingPpvNewStatusButtons(
  hasStatusRight: boolean,
  hasSendRight: boolean,
  userDepKindCode: string | null | undefined,
  existingResolutionDepKindCodes: string[] | undefined,
  resolutionLabel: string,
  noSt: string,
  noSn: string,
  hintClose: string,
  rightsDepKindId?: number | null
): StatusButtonResult {
  const hasDistrictRes = hasDistrictResolution(existingResolutionDepKindCodes)
  const hasRegionalRes = hasRegionalResolution(existingResolutionDepKindCodes)
  const hasRegionalOrRepublican =
    hasRegionalRes ||
    (Array.isArray(existingResolutionDepKindCodes) &&
      existingResolutionDepKindCodes.some((c) => norm(c) === 'dep0603'))
  const NEED_REGIONAL_OR_REPUBLICAN_HINT =
    'Ожидается резолюция областного или республиканского ЦГЭ.'

  const closeCfg = (enabled: boolean): StatusButtonConfig | null =>
    enabled
      ? { label: 'Закрытие карты', action: 'close', hint: hintClose }
      : { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt }

  // Направление / закрытие при резолюции областного или республиканского ЦГЭ
  if (hasRegionalOrRepublican) {
    if (hasSendRight) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: HINT_PPV_NEW_TO_PENDING },
        comment: HINT_PPV_NEW_TO_PENDING,
        closeConfig: closeCfg(hasStatusRight),
      }
    }
    if (hasStatusRight) {
      return {
        config: {
          label: 'Направление сведений',
          action: 'send',
          disabled: true,
          hint: noSn,
        },
        comment: noSn,
        closeConfig: closeCfg(true),
      }
    }
    return {
      config: {
        label: 'Направление сведений',
        action: 'send',
        disabled: true,
        hint: noSn,
      },
      comment: noSn,
      closeConfig: closeCfg(false),
    }
  }

  // Областной: наложение резолюции при «Новое» + районная резолюция
  if (canPpvMarkReadyInNew(userDepKindCode, existingResolutionDepKindCodes)) {
    if (!hasStatusRight) {
      return {
        config: { label: resolutionLabel, action: 'mark_ready', disabled: true, hint: noSt },
        comment: noSt,
      }
    }
    if (!canShowPpvOutgoingMarkReady(rightsDepKindId, userDepKindCode, 'new', hasDistrictRes, hasRegionalRes)) {
      return { config: null, comment: hintPpvRightsDepKindId() }
    }
    return {
      config: {
        label: resolutionLabel,
        action: 'mark_ready',
        hint: HINT_PPV_NEW_REGIONAL_AFTER_DISTRICT,
      },
      comment: HINT_PPV_NEW_REGIONAL_AFTER_DISTRICT,
    }
  }

  // Только районная резолюция — ждём областную/республиканскую
  if (hasDistrictResolution(existingResolutionDepKindCodes)) {
    const userLevel = norm(userDepKindCode)
    if (userLevel === 'dep0601' && hasStatusRight) {
      return {
        config: {
          label: resolutionLabel,
          action: 'mark_ready',
          disabled: true,
          hint: HINT_PPV_DRAFT_ONLY_DISTRICT,
        },
        comment: HINT_PPV_DRAFT_ONLY_DISTRICT,
      }
    }
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

  // «Новое» без резолюций (редко)
  if (norm(userDepKindCode) === 'dep0603' && hasStatusRight) {
    return {
      config: {
        label: resolutionLabel,
        action: 'mark_ready',
        disabled: true,
        hint: HINT_PPV_DRAFT_ONLY_REPUBLICAN,
      },
      comment: HINT_PPV_DRAFT_ONLY_REPUBLICAN,
    }
  }
  return {
    config: {
      label: hasSendRight ? 'Направление сведений' : resolutionLabel,
      action: hasSendRight ? 'send' : 'mark_ready',
      hint: NO_RESOLUTION_HINT,
      disabled: true,
    },
    comment: NO_RESOLUTION_HINT,
  }
}

/** Кнопка «Закрытие карты» для статусов AWAITING / PARTIAL / FULFIELD (исходящая PPV). */
function outgoingPpvCloseOnlyResult(
  status: string,
  hasStatusRight: boolean,
  noSt: string,
  hintClose: string
): StatusButtonResult | null {
  if (!outgoingPpvCloseAllowedByStatusName(status)) return null
  if (!hasStatusRight) {
    return {
      config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
      comment: noSt,
    }
  }
  return {
    config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
    comment: hintClose,
  }
}

/** DPASTATUSID из карты/метаданных (иногда строка с JSON) */
function incomingDpStatusId(statusId: number | null | undefined): number | undefined {
  if (statusId == null) return undefined
  const n = Number(statusId)
  return Number.isFinite(n) ? n : undefined
}

/** Подсказка при отсутствии права: кнопка отображается задизейбленной */
const HINT_NO_STATUS_RIGHT_IN =
  'Недостаточно прав: для смены статуса входящих сведений требуется право dangerousProductIn:status.'
const HINT_NO_STATUS_RIGHT_OUT =
  'Недостаточно прав: для смены статуса исходящих сведений (закрытие карты, отметка готовности) требуется право dangerousProductOut:status.'
const HINT_NO_SEND_RIGHT_OUT =
  'Недостаточно прав: для направления исходящих сведений требуется право dangerousProductOut:send.'

function hintNoStatusRightIn(forPpv: boolean): string {
  return forPpv
    ? 'Недостаточно прав: для смены статуса входящих сведений требуется право violationDetectedIn:status.'
    : HINT_NO_STATUS_RIGHT_IN
}

function hintNoStatusRightOut(forPpv: boolean): string {
  return forPpv
    ? 'Недостаточно прав: для смены статуса исходящих сведений (закрытие карты, отметка готовности) требуется право violationDetectedOut:status.'
    : HINT_NO_STATUS_RIGHT_OUT
}

function hintNoSendRightOut(forPpv: boolean): string {
  return forPpv
    ? 'Недостаточно прав: для направления исходящих сведений требуется право violationDetectedOut:send.'
    : HINT_NO_SEND_RIGHT_OUT
}

function hintNoStatusAndSendOut(forPpv: boolean): string {
  return forPpv
    ? 'Недостаточно прав: для смены статуса требуется право violationDetectedOut:status, для направления сведений — violationDetectedOut:send.'
    : 'Недостаточно прав: для смены статуса требуется право dangerousProductOut:status, для направления сведений — dangerousProductOut:send.'
}

/** Дата закрытия (csdo:EndDate) не влияет на доступность кнопки «Закрытие карты». */
function incomingStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasRight: boolean,
  _notificationEndDate: string | null | undefined,
  forPpvRightsHints: boolean
): StatusButtonResult {
  const sid = incomingDpStatusId(statusId)
  const s = norm(status)

  /** «Получено» / «Завершено»: переходы с формы не показываем (для «Получено» — только автоматически при открытии). */
  const isReceivedOrCompleted =
    sid === INCOMING_RECEIVED ||
    sid === INCOMING_COMPLETED ||
    (sid === undefined && s.includes('получено') && !s.includes('обработ')) ||
    (sid === undefined && s.includes('завершено'))
  if (isReceivedOrCompleted) {
    return {
      config: null,
      comment:
        'Кнопка смены статуса не отображается для входящих сведений в статусе «Получено» или «Завершено».',
    }
  }

  if (!hasRight) {
    const isProcessing = sid === INCOMING_PROCESSING || s.includes('в обработке')
    const isProcessed = sid === INCOMING_PROCESSED || (s.includes('обработано') && !s.includes('завершено'))
    const label = isProcessing ? 'Завершение обработки' : isProcessed ? 'Закрытие карты' : 'Смена статуса'
    const action = isProcessing ? 'complete_processing' : isProcessed ? 'close' : 'complete_processing'
    const hin = hintNoStatusRightIn(forPpvRightsHints)
    return {
      config: { label, action, disabled: true, hint: hin },
      comment: hin,
    }
  }
  if (sid === INCOMING_PROCESSING) {
    return {
      config: {
        label: 'Завершение обработки',
        action: 'complete_processing',
        hint: 'Переход карты в состояние «Обработано» (завершение обработки входящих сведений).',
      },
      comment: 'Переход карты в состояние «Обработано».',
    }
  }
  if (sid === INCOMING_PROCESSED) {
    return {
      config: {
        label: 'Закрытие карты',
        action: 'close',
        hint: 'Переход карты в состояние «Завершено» (закрытие входящей карты).',
      },
      comment: 'Переход карты в состояние «Завершено».',
    }
  }
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
  if (c === 'dep0601') return 'Согласование районного ЦГЭ'
  if (c === 'dep0602') return 'Согласование областного ЦГЭ'
  if (c === 'dep0603') return 'Согласование республиканского ЦГЭ'
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

function outgoingStatusButtonDpa(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  hasResolution: boolean,
  userDepKindCode: string | null | undefined,
  existingResolutionDepKindCodes: string[] | undefined,
  userDepKindName: string | null | undefined,
  _notificationEndDate: string | null | undefined,
  forPpvRightsHints: boolean
): StatusButtonResult {
  const noSt = hintNoStatusRightOut(forPpvRightsHints)
  const noSn = hintNoSendRightOut(forPpvRightsHints)
  const noBoth = hintNoStatusAndSendOut(forPpvRightsHints)
  if (!hasStatusRight && !hasSendRight) {
    const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
    return {
      config: {
        label: resolutionLabel,
        action: 'mark_ready',
        disabled: true,
        hint: noBoth,
      },
      comment: noBoth,
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
          hint: noSt,
        },
        comment: noSt,
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
          : { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
      }
    }
    if (hasRegionalOrRepublicanResolution && !hasSendRight && hasStatusRight) {
      return {
        config: {
          label: 'Направление сведений',
          action: 'send',
          disabled: true,
          hint: noSn,
        },
        comment: noSn,
        closeConfig: { label: 'Закрытие карты', action: 'close', hint: hintClose },
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
        config: {
          label: 'Направление сведений',
          action: 'send',
          disabled: true,
          hint: noSn,
        },
        comment: noSn,
        closeConfig: { label: 'Закрытие карты', action: 'close', hint: hintClose },
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
          : { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
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
      config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
      comment: noSt,
    }
  }
  if (statusId === OUTGOING_PENDING) {
    return { config: null, comment: '' }
  }
  // Статус «Отредактировано» (12) более не используется: переходы из него отключены; сохраните карту — статус изменится на «Новое».
  if (statusId === OUTGOING_EDITED) {
    const obsoleteHint = 'Статус «Отредактировано» более не используется. Сохраните карту — статус изменится на «Новое».'
    return {
      config: {
        label: 'Направление сведений',
        action: 'send',
        disabled: true,
        hint: obsoleteHint,
      },
      comment: obsoleteHint,
      closeConfig: { label: 'Закрытие карты', action: 'close', disabled: true, hint: obsoleteHint },
    }
  }
  if (statusId === OUTGOING_FAILED || statusId === OUTGOING_ERROR) {
    const toNewHint = 'Перевод карты в статус «Новое»; после этого станет доступно направление сведений при наличии резолюции областного или республиканского ЦГЭ.'
    if (hasStatusRight) {
      return {
        config: { label: 'Перевести в Новое', action: 'to_new', hint: toNewHint },
        comment: toNewHint,
        closeConfig: { label: 'Закрытие карты', action: 'close', hint: hintClose },
      }
    }
    return {
      config: { label: 'Перевести в Новое', action: 'to_new', disabled: true, hint: noSt },
      comment: noSt,
      closeConfig: { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
    }
  }
  if (statusId === OUTGOING_DELIVERED) {
    if (!hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
        comment: noSt,
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
    return { config: null, comment: '' }
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
          hint: noSt,
        },
        comment: noSt,
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
          : { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
      }
    }
    if (hasRegionalOrRepublicanResolution && !hasSendRight && hasStatusRight) {
      return {
        config: {
          label: 'Направление сведений',
          action: 'send',
          disabled: true,
          hint: noSn,
        },
        comment: noSn,
        closeConfig: { label: 'Закрытие карты', action: 'close', hint: hintClose },
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
        config: {
          label: 'Направление сведений',
          action: 'send',
          disabled: true,
          hint: noSn,
        },
        comment: noSn,
        closeConfig: { label: 'Закрытие карты', action: 'close', hint: hintClose },
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
          : { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
      }
    }
    if (hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', hint: hintClose },
        comment: hintClose,
      }
    }
    return {
      config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
      comment: noSt,
    }
  }
  if (s.includes('ожидает отправки')) {
    return { config: null, comment: '' }
  }
  if (s.includes('отредактировано')) {
    const obsoleteHint = 'Статус «Отредактировано» более не используется. Сохраните карту — статус изменится на «Новое».'
    return {
      config: {
        label: 'Направление сведений',
        action: 'send',
        disabled: true,
        hint: obsoleteHint,
      },
      comment: obsoleteHint,
      closeConfig: { label: 'Закрытие карты', action: 'close', disabled: true, hint: obsoleteHint },
    }
  }
  if (s.includes('отправка не удалась') || s.includes('ошибка обработки')) {
    const toNewHint = 'Перевод карты в статус «Новое»; после этого станет доступно направление сведений при наличии резолюции областного или республиканского ЦГЭ.'
    if (hasStatusRight) {
      return {
        config: { label: 'Перевести в Новое', action: 'to_new', hint: toNewHint },
        comment: toNewHint,
        closeConfig: { label: 'Закрытие карты', action: 'close', hint: hintClose },
      }
    }
    return {
      config: { label: 'Перевести в Новое', action: 'to_new', disabled: true, hint: noSt },
      comment: noSt,
      closeConfig: { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
    }
  }
  if (s.includes('доставлено')) {
    if (!hasStatusRight) {
      return {
        config: { label: 'Закрытие карты', action: 'close', disabled: true, hint: noSt },
        comment: noSt,
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
  if (s === 'отправлено') {
    return { config: null, comment: '' }
  }
  if (s === 'завершено') {
    return { config: null, comment: '' }
  }
  return {
    config: null,
    comment: 'Кнопка смены статуса не отображается: для текущего статуса исходящей карты действие не определено.',
  }
}

function outgoingStatusButtonPpv(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  hasResolution: boolean,
  userDepKindCode: string | null | undefined,
  existingResolutionDepKindCodes: string[] | undefined,
  userDepKindName: string | null | undefined,
  _notificationEndDate: string | null | undefined,
  forPpvRightsHints: boolean,
  rightsDepKindId?: number | null
): StatusButtonResult {
  const noSt = hintNoStatusRightOut(forPpvRightsHints)
  const noSn = hintNoSendRightOut(forPpvRightsHints)
  const noBoth = hintNoStatusAndSendOut(forPpvRightsHints)
  if (!hasStatusRight && !hasSendRight) {
    const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
    return {
      config: {
        label: resolutionLabel,
        action: 'mark_ready',
        disabled: true,
        hint: noBoth,
      },
      comment: noBoth,
    }
  }
  const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
  const hintClose = 'Закрытие карты — переход в состояние «Завершено» (без направления в ЕЭК).'
  const hasDistrictRes = hasDistrictResolution(existingResolutionDepKindCodes)
  const hasRegionalRes = hasRegionalResolution(existingResolutionDepKindCodes)

  // По DPASTATUSID (исходящие 5–13)
  if (statusId === OUTGOING_DRAFT) {
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
    if (!canShowPpvOutgoingMarkReady(rightsDepKindId, userDepKindCode, 'draft', hasDistrictRes, hasRegionalRes)) {
      return { config: null, comment: hintPpvRightsDepKindId() }
    }
    const draftComment = getResolutionHintForDraft(userDepKindCode, userDepKindName)
    const draftButtonHint = getResolutionHintFromDraft(userDepKindCode)
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: draftButtonHint },
      comment: draftComment,
    }
  }
  if (statusId === OUTGOING_NEW) {
    return outgoingPpvNewStatusButtons(
      hasStatusRight,
      hasSendRight,
      userDepKindCode,
      existingResolutionDepKindCodes,
      resolutionLabel,
      noSt,
      noSn,
      hintClose,
      rightsDepKindId
    )
  }
  if (statusId === OUTGOING_PENDING) {
    return { config: null, comment: '' }
  }
  {
    const closeOnly = outgoingPpvCloseOnlyResult(status, hasStatusRight, noSt, hintClose)
    if (closeOnly) return closeOnly
  }
  // Статус «Отредактировано» (12) более не используется: переходы из него отключены; сохраните карту — статус изменится на «Новое».
  if (statusId === OUTGOING_EDITED) {
    const obsoleteHint = 'Статус «Отредактировано» более не используется. Сохраните карту — статус изменится на «Новое».'
    return {
      config: {
        label: 'Направление сведений',
        action: 'send',
        disabled: true,
        hint: obsoleteHint,
      },
      comment: obsoleteHint,
      closeConfig: { label: 'Закрытие карты', action: 'close', disabled: true, hint: obsoleteHint },
    }
  }
  if (statusId === OUTGOING_FAILED || statusId === OUTGOING_ERROR) {
    const toNewHint = 'Перевод карты в статус «Новое»; после этого станет доступно направление сведений при наличии резолюции областного или республиканского ЦГЭ.'
    if (hasStatusRight) {
      return {
        config: { label: 'Перевести в Новое', action: 'to_new', hint: toNewHint },
        comment: toNewHint,
      }
    }
    return {
      config: { label: 'Перевести в Новое', action: 'to_new', disabled: true, hint: noSt },
      comment: noSt,
    }
  }
  if (statusId === OUTGOING_DELIVERED) {
    return {
      config: null,
      comment:
        'Закрытие карты в статусе «Доставлено» не предусмотрено: закрытие доступно из «Новое» (с резолюцией областного или республиканского ЦГЭ) или из статусов ожидания/частичных/полных ответов.',
    }
  }
  if (statusId === OUTGOING_SENT || statusId === 13) {
    return { config: null, comment: '' }
  }

  // Запасная проверка по названию (карты без statusId, например из XML)
  const s = norm(status)
  {
    const closeOnly = outgoingPpvCloseOnlyResult(status, hasStatusRight, noSt, hintClose)
    if (closeOnly) return closeOnly
  }
  if (s.includes('черновик') || s.includes('создан')) {
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
    if (!canShowPpvOutgoingMarkReady(rightsDepKindId, userDepKindCode, 'draft', hasDistrictRes, hasRegionalRes)) {
      return { config: null, comment: hintPpvRightsDepKindId() }
    }
    const draftComment = getResolutionHintForDraft(userDepKindCode, userDepKindName)
    const draftButtonHint = getResolutionHintFromDraft(userDepKindCode)
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: draftButtonHint },
      comment: draftComment,
    }
  }
  if (s.includes('новое') || s.includes('новая') || s === 'новый') {
    return outgoingPpvNewStatusButtons(
      hasStatusRight,
      hasSendRight,
      userDepKindCode,
      existingResolutionDepKindCodes,
      resolutionLabel,
      noSt,
      noSn,
      hintClose,
      rightsDepKindId
    )
  }
  if (s.includes('ожидает отправки')) {
    return { config: null, comment: '' }
  }
  if (s.includes('отредактировано')) {
    const obsoleteHint = 'Статус «Отредактировано» более не используется. Сохраните карту — статус изменится на «Новое».'
    return {
      config: {
        label: 'Направление сведений',
        action: 'send',
        disabled: true,
        hint: obsoleteHint,
      },
      comment: obsoleteHint,
      closeConfig: { label: 'Закрытие карты', action: 'close', disabled: true, hint: obsoleteHint },
    }
  }
  if (s.includes('отправка не удалась') || s.includes('ошибка обработки')) {
    const toNewHint = 'Перевод карты в статус «Новое»; после этого станет доступно направление сведений при наличии резолюции областного или республиканского ЦГЭ.'
    if (hasStatusRight) {
      return {
        config: { label: 'Перевести в Новое', action: 'to_new', hint: toNewHint },
        comment: toNewHint,
      }
    }
    return {
      config: { label: 'Перевести в Новое', action: 'to_new', disabled: true, hint: noSt },
      comment: noSt,
    }
  }
  if (s.includes('доставлено')) {
    return {
      config: null,
      comment:
        'Закрытие карты в статусе «Доставлено» не предусмотрено: закрытие доступно из «Новое» (с резолюцией областного или республиканского ЦГЭ) или из статусов ожидания/частичных/полных ответов.',
    }
  }
  if (s === 'отправлено') {
    return { config: null, comment: '' }
  }
  if (s === 'завершено') {
    return { config: null, comment: '' }
  }
  return {
    config: null,
    comment: 'Кнопка смены статуса не отображается: для текущего статуса исходящей карты действие не определено.',
  }
}

function outgoingStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  hasResolution: boolean,
  userDepKindCode: string | null | undefined,
  existingResolutionDepKindCodes: string[] | undefined,
  userDepKindName: string | null | undefined,
  _notificationEndDate: string | null | undefined,
  forPpvRightsHints: boolean,
  rightsDepKindId?: number | null
): StatusButtonResult {
  if (forPpvRightsHints) {
    return outgoingStatusButtonPpv(
      statusId,
      status,
      hasStatusRight,
      hasSendRight,
      hasResolution,
      userDepKindCode,
      existingResolutionDepKindCodes,
      userDepKindName,
      _notificationEndDate,
      forPpvRightsHints,
      rightsDepKindId
    )
  }
  return outgoingStatusButtonDpa(
    statusId,
    status,
    hasStatusRight,
    hasSendRight,
    hasResolution,
    userDepKindCode,
    existingResolutionDepKindCodes,
    userDepKindName,
    _notificationEndDate,
    forPpvRightsHints
  )
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
  notificationEndDate?: string | null,
  /** PPV: в подсказках указывать violationDetected* вместо dangerousProduct* */
  usePpvRightsHints?: boolean,
  /** department.depkindid из карты прав (72/73/74) — отметка готовности исходящей PPV */
  rightsDepKindId?: number | null
): StatusButtonResult {
  const code = datasourceKindCode != null ? String(datasourceKindCode).trim() : ''
  const src = norm(source)
  const ppvHints = usePpvRightsHints === true

  // Тип карты по метаданным DATASOURCEKINDCODE (1 = входящие, 2 = исходящие)
  if (code === '1') {
    return incomingStatusButton(statusId, status ?? '', hasStatusRight, notificationEndDate ?? null, ppvHints)
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
      notificationEndDate ?? null,
      ppvHints,
      rightsDepKindId
    )
  }
  if (code === '3') {
    return {
      config: null,
      comment: 'Кнопка смены статуса не отображается: для карт из БД ЕЭК смена статуса не предусмотрена.',
    }
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
      notificationEndDate ?? null,
      ppvHints,
      rightsDepKindId
    )
  }
  if (src.includes('входящ')) {
    return incomingStatusButton(statusId, status ?? '', hasStatusRight, notificationEndDate ?? null, ppvHints)
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
