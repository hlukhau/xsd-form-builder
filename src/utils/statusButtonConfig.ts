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
}

/** DPASTATUSID: входящие 1–4, исходящие 5–13 (DRAFT=5, NEW=6, PENDING=7, SENT=8, FAILED=9, ERROR=10, DELIVERED=11, EDITED=12, COMPLETED=13) */
const INCOMING_PROCESSING = 2
const INCOMING_PROCESSED = 3
const OUTGOING_DRAFT = 5
const OUTGOING_NEW = 6
const OUTGOING_PENDING = 7
const OUTGOING_FAILED = 9
const OUTGOING_ERROR = 10
const OUTGOING_DELIVERED = 11
const OUTGOING_EDITED = 12

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function incomingStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasRight: boolean
): StatusButtonResult {
  if (!hasRight) {
    return {
      config: null,
      comment: 'Кнопка смены статуса не отображается: нет права на смену статуса по входящим картам.',
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

/** Описание перехода при наложении резолюции по уровню подразделения */
function getResolutionHint(depKindCode: string | null | undefined): string {
  if (!depKindCode) return 'Наложение отметки готовности — переход карты в состояние «Готово к направлению».'
  const c = depKindCode.trim().toLowerCase()
  if (c === 'dep0601') return 'Наложение резолюции районного ЦГЭ — переход карты в состояние «Готово к направлению» (после резолюции вашего уровня карту можно направить в ЕЭК или закрыть).'
  if (c === 'dep0602') return 'Наложение резолюции областного ЦГЭ — переход карты в состояние «Готово к направлению».'
  if (c === 'dep0603') return 'Наложение резолюции республиканского ЦГЭ — переход карты в состояние «Готово к направлению».'
  return 'Наложение отметки готовности — переход карты в состояние «Готово к направлению».'
}

function outgoingStatusButton(
  statusId: number | null | undefined,
  status: string,
  hasStatusRight: boolean,
  hasSendRight: boolean,
  hasResolution: boolean,
  userDepKindCode: string | null | undefined,
  existingResolutionDepKindCodes: string[] | undefined
): StatusButtonResult {
  if (!hasStatusRight && !hasSendRight) {
    return {
      config: null,
      comment: 'Кнопка смены статуса не отображается: нет прав ни на смену статуса, ни на направление сведений для исходящих карт.',
    }
  }
  const resolutionLabel = getResolutionButtonLabel(userDepKindCode)
  const resolutionHint = getResolutionHint(userDepKindCode)
  const hasResolutionOfUserLevel =
    userDepKindCode &&
    Array.isArray(existingResolutionDepKindCodes) &&
    existingResolutionDepKindCodes.some((c) => norm(c) === norm(userDepKindCode))

  const hintSend = 'Направление сведений в ЕЭК — переход карты в состояние «Отправлено».'
  const hintClose = 'Закрытие карты — переход в состояние «Завершено» (без направления в ЕЭК).'

  // По DPASTATUSID (исходящие 5–13)
  if (statusId === OUTGOING_DRAFT) {
    if (!hasStatusRight) {
      return {
        config: null,
        comment: 'Кнопка смены статуса не отображается: нет права на смену статуса; в состоянии «Черновик» доступна только резолюция/отметка готовности.',
      }
    }
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: resolutionHint },
      comment: resolutionHint,
    }
  }
  if (statusId === OUTGOING_NEW) {
    if (hasStatusRight && !hasResolutionOfUserLevel) {
      return {
        config: { label: resolutionLabel, action: 'mark_ready', hint: resolutionHint },
        comment: resolutionHint,
      }
    }
    if (hasStatusRight && hasResolutionOfUserLevel) {
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
  }
  if (
    statusId === OUTGOING_PENDING ||
    statusId === OUTGOING_FAILED ||
    statusId === OUTGOING_ERROR ||
    statusId === OUTGOING_EDITED
  ) {
    if (!hasResolution) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: NO_RESOLUTION_HINT, disabled: true },
        comment: NO_RESOLUTION_HINT,
      }
    }
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
      config: null,
      comment: 'Кнопка смены статуса не отображается: для состояния «Ожидает отправки» / «Ошибка» / «Отредактировано» нужны права на направление сведений или закрытие карты.',
    }
  }
  if (statusId === OUTGOING_DELIVERED) {
    if (!hasStatusRight) {
      return {
        config: null,
        comment: 'Кнопка смены статуса не отображается: в состоянии «Доставлено» доступно только закрытие карты, но нет права на смену статуса.',
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
  if (statusId === 8 || statusId === 13) {
    return {
      config: null,
      comment:
        statusId === 8
          ? 'Кнопка смены статуса не отображается: карта уже в состоянии «Отправлено», дальнейшие переходы не предусмотрены.'
          : 'Кнопка смены статуса не отображается: карта в состоянии «Завершено».',
    }
  }

  // Запасная проверка по названию (карты без statusId, например из XML)
  const s = norm(status)
  if (s.includes('черновик') || s.includes('создан')) {
    if (!hasStatusRight) {
      return {
        config: null,
        comment: 'Кнопка смены статуса не отображается: нет права на смену статуса.',
      }
    }
    return {
      config: { label: resolutionLabel, action: 'mark_ready', hint: resolutionHint },
      comment: resolutionHint,
    }
  }
  if (s.includes('новое') || s.includes('новая') || s === 'новый') {
    if (hasStatusRight && !hasResolutionOfUserLevel) {
      return {
        config: { label: resolutionLabel, action: 'mark_ready', hint: resolutionHint },
        comment: resolutionHint,
      }
    }
    if (hasStatusRight && hasResolutionOfUserLevel) {
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
  }
  if (
    s.includes('ожидает отправки') ||
    s.includes('отправка не удалась') ||
    s.includes('ошибка обработки') ||
    s.includes('отредактировано')
  ) {
    if (!hasResolution) {
      return {
        config: { label: 'Направление сведений', action: 'send', hint: NO_RESOLUTION_HINT, disabled: true },
        comment: NO_RESOLUTION_HINT,
      }
    }
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
  }
  if (s.includes('доставлено')) {
    if (!hasStatusRight) {
      return {
        config: null,
        comment: 'Кнопка смены статуса не отображается: в состоянии «Доставлено» доступно только закрытие, но нет права на смену статуса.',
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
  datasourceKindCode?: string | null
): StatusButtonResult {
  const code = datasourceKindCode != null ? String(datasourceKindCode).trim() : ''
  const src = norm(source)

  // Тип карты по метаданным DATASOURCEKINDCODE
  if (code === '2') {
    return outgoingStatusButton(
      statusId,
      status ?? '',
      hasStatusRight,
      hasSendRight ?? false,
      hasResolution ?? false,
      userDepKindCode ?? null,
      existingResolutionDepKindCodes ?? []
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
      existingResolutionDepKindCodes ?? []
    )
  }
  if (src.includes('входящ')) {
    return incomingStatusButton(statusId, status ?? '', hasStatusRight)
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
