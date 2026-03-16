/**
 * Ограничения полей формы по XSD (в соответствии с docs/xsd-field-constraints.md).
 * Источники: EEC_M_SimpleDataObjects_v0.4.12.xsd, EEC_M_SM_SimpleDataObjects_v0.3.9.xsd.
 */

import type { Rule } from 'antd/es/form'

export interface FieldConstraint {
  /** Максимальная длина (символов). */
  maxLength?: number
  /** Минимальная длина (символов). */
  minLength?: number
  /** Регулярное выражение для проверки (должно соответствовать всей строке). */
  pattern?: RegExp
  /** Всего цифр (для числовых полей: целая + дробная часть). */
  totalDigits?: number
  /** Знаков после запятой (для decimal). */
  fractionDigits?: number
  /** Сообщение об ошибке при превышении maxLength. */
  messageMaxLength?: string
  /** Сообщение об ошибке при несоответствии pattern. */
  messagePattern?: string
  /** Подсказка формата: показывается при ошибке и опционально под полем (например: «Формат: 2, 4, 6 или 8–10 цифр»). */
  formatHint?: string
}

/** Код ТН ВЭД ЕАЭС: 2, 4, 6 или 8–10 цифр (csdo:CommodityCodeType). Пустая строка допустима (поле необязательное). */
export const COMMODITY_CODE_PATTERN = /^$|^\d{2}$|^\d{4}$|^\d{6}$|^\d{8,10}$/

/** Десятичное число: целая часть до 18 цифр, дробная до 6 (PhysicalMeasureType). Пустая строка допустима. */
export const DECIMAL_18_6_PATTERN = /^$|^-?\d{1,18}([.,]\d{1,6})?$/

/** Маппинг ключей полей формы на ограничения XSD. */
export const XSD_FIELD_CONSTRAINTS: Record<string, FieldConstraint> = {
  // Продукция (вкладка «Продукция», блок продукции в ТСД)
  productId: { maxLength: 50, messageMaxLength: 'Не более 50 символов (csdo:Id50Type)' },
  productName: { maxLength: 300, messageMaxLength: 'Не более 300 символов (csdo:Name300Type)' },
  tradeName: { maxLength: 300, messageMaxLength: 'Не более 300 символов (csdo:Name300Type)' },
  description: { maxLength: 4000, messageMaxLength: 'Не более 4000 символов (csdo:Text4000Type)' },
  commodityCode: {
    pattern: COMMODITY_CODE_PATTERN,
    messagePattern: 'Код ТН ВЭД ЕАЭС: укажите 2, 4, 6 или 8–10 цифр',
    formatHint: 'Формат: 2, 4, 6 или 8–10 цифр (например 22, 2201, 220110, 2201101100)',
  },
  productPurpose: { maxLength: 1000, messageMaxLength: 'Не более 1000 символов (csdo:Text1000Type)' },
  applicationMethod: { maxLength: 1000, messageMaxLength: 'Не более 1000 символов (csdo:Text1000Type)' },
  releaseForm: { maxLength: 1000, messageMaxLength: 'Не более 1000 символов (csdo:Text1000Type)' },
  storageCondition: { maxLength: 1000, messageMaxLength: 'Не более 1000 символов (csdo:Text1000Type)' },
  labelText: { maxLength: 4000, messageMaxLength: 'Не более 4000 символов (csdo:Text4000Type)' },

  // Изготовитель / участник цепи поставки
  businessEntityName: { maxLength: 300, messageMaxLength: 'Не более 300 символов (csdo:Name300Type)' },
  shortName: { maxLength: 120, messageMaxLength: 'Не более 120 символов (csdo:Name120Type)' },
  organizationalForm: { maxLength: 300, messageMaxLength: 'Не более 300 символов (csdo:Name300Type)' },
  subjectIdentifier: { maxLength: 20, messageMaxLength: 'Не более 20 символов (csdo:Id20Type)' },
  taxpayerId: { maxLength: 20, messageMaxLength: 'Не более 20 символов (csdo:TaxpayerIdType)' },
  customsNumber: { maxLength: 17, messageMaxLength: 'Не более 17 символов (csdo:UniqueCustomsNumberIdType)' },
  communicationChannelId: { maxLength: 1000, messageMaxLength: 'Не более 1000 символов (csdo:CommunicationChannelIdType)' },
  communicationChannelName: { maxLength: 120, messageMaxLength: 'Не более 120 символов (csdo:Name120Type)' },

  // Адрес
  territoryCode: { maxLength: 17, messageMaxLength: 'Не более 17 символов (csdo:TerritoryCodeType)' },
  regionName: { maxLength: 120, messageMaxLength: 'Не более 120 символов (csdo:Name120Type)' },
  districtName: { maxLength: 120, messageMaxLength: 'Не более 120 символов (csdo:Name120Type)' },
  cityName: { maxLength: 120, messageMaxLength: 'Не более 120 символов (csdo:Name120Type)' },
  settlementName: { maxLength: 120, messageMaxLength: 'Не более 120 символов (csdo:Name120Type)' },
  streetName: { maxLength: 120, messageMaxLength: 'Не более 120 символов (csdo:Name120Type)' },
  buildingNumberId: { maxLength: 50, messageMaxLength: 'Не более 50 символов (csdo:Id50Type)' },
  roomNumberId: { maxLength: 50, messageMaxLength: 'Не более 50 символов (csdo:Id50Type)' },
  fullAddress: { maxLength: 1000, messageMaxLength: 'Не более 1000 символов (csdo:AddressText/Text1000Type)' },

  // Место обнаружения, прочие текстовые описания
  descriptionPlace: { maxLength: 4000, messageMaxLength: 'Не более 4000 символов (csdo:Text4000Type)' },

  // Пункт пропуска
  checkpointCode: { maxLength: 18, messageMaxLength: 'Не более 18 символов (csdo:BorderCheckpointCodeType)' },
  checkpointName: { maxLength: 300, messageMaxLength: 'Не более 300 символов (csdo:Name300Type)' },

  // Документы (соответствия, меры, уведомления)
  docKindName: { maxLength: 300, messageMaxLength: 'Не более 300 символов (csdo:Name300Type)' },
  docName: { maxLength: 300, messageMaxLength: 'Не более 300 символов (csdo:Name300Type)' },
  docId: { maxLength: 50, messageMaxLength: 'Не более 50 символов (csdo:Id50Type)' },
  docSeriesId: { maxLength: 50, messageMaxLength: 'Не более 50 символов (csdo:Id50Type)' },
  authorityName: { maxLength: 300, messageMaxLength: 'Не более 300 символов (csdo:Name300Type)' },
  authorityBriefName: { maxLength: 120, messageMaxLength: 'Не более 120 символов (csdo:Name120Type)' },
  authorityId: { maxLength: 50, messageMaxLength: 'Не более 50 символов (csdo:Id50Type)' },
  registrationNumber: { maxLength: 50, messageMaxLength: 'Не более 50 символов (csdo:Id50Type)' },

  // Меры: обоснование, описания
  measureJustification: { maxLength: 4000, messageMaxLength: 'Не более 4000 символов (csdo:Text4000Type)' },
  noteText: { maxLength: 4000, messageMaxLength: 'Не более 4000 символов (csdo:NoteText/Text4000Type)' },

  // Нарушения
  violationDescription: { maxLength: 4000, messageMaxLength: 'Не более 4000 символов (csdo:Text4000Type)' },
  technicalRegulationId: { maxLength: 50, messageMaxLength: 'Не более 50 символов', formatHint: 'Например: ТР ТС 001/2011' },
  indicatorName: { maxLength: 300, messageMaxLength: 'Не более 300 символов' },
  indicatorValue: {
    maxLength: 250,
    messageMaxLength: 'Не более 250 символов',
    pattern: DECIMAL_18_6_PATTERN,
    totalDigits: 24,
    fractionDigits: 6,
    formatHint: 'Число: до 18 цифр до запятой и до 6 после запятой (например 0,0042 или 123,456789)',
    messagePattern: 'Введите число в формате: до 18 цифр до запятой и до 6 после запятой (например 0,0042)',
  },

  // ТСД: партия, примечание
  batchId: { maxLength: 50, messageMaxLength: 'Не более 50 символов (csdo:Id50Type)' },
  note: { maxLength: 4000, messageMaxLength: 'Не более 4000 символов (csdo:NoteText/Text4000Type)' },
  consignmentId: { maxLength: 50, messageMaxLength: 'Не более 50 символов (csdo:Id50Type)' },
}

/**
 * Возвращает ограничение по ключу поля или undefined.
 */
export function getFieldConstraint(fieldKey: string): FieldConstraint | undefined {
  return XSD_FIELD_CONSTRAINTS[fieldKey]
}

/**
 * Возвращает maxLength для поля (для передачи в Input/TextArea).
 */
export function getMaxLength(fieldKey: string): number | undefined {
  return XSD_FIELD_CONSTRAINTS[fieldKey]?.maxLength
}

/**
 * Возвращает подсказку по формату поля (для отображения при ошибке или под полем).
 */
export function getFormatHint(fieldKey: string): string | undefined {
  return XSD_FIELD_CONSTRAINTS[fieldKey]?.formatHint
}

/**
 * Формирует правила валидации Ant Design Form по ключу поля.
 * Учитывает только длину и pattern; required добавляется отдельно при необходимости.
 */
export function getFormRules(fieldKey: string, options?: { required?: boolean }): Rule[] {
  const c = XSD_FIELD_CONSTRAINTS[fieldKey]
  if (!c) return options?.required ? [{ required: true, message: 'Обязательное поле' }] : []

  const rules: Rule[] = []

  if (options?.required) {
    rules.push({ required: true, message: 'Обязательное поле' })
  }

  if (c.maxLength != null) {
    rules.push({
      max: c.maxLength,
      message: c.messageMaxLength ?? `Не более ${c.maxLength} символов`,
      type: 'string',
    })
  }

  if (c.pattern) {
    rules.push({
      pattern: c.pattern,
      message: c.messagePattern ?? c.formatHint ?? 'Неверный формат. Ожидаемый формат см. в подсказке под полем.',
      validateTrigger: ['onBlur', 'onChange'],
    })
  }

  return rules
}

/**
 * Валидирует значение по ограничениям поля. Возвращает сообщение об ошибке или null.
 */
export function validateFieldValue(fieldKey: string, value: string | undefined): string | null {
  if (value == null || value === '') return null
  const c = XSD_FIELD_CONSTRAINTS[fieldKey]
  if (!c) return null
  if (c.maxLength != null && value.length > c.maxLength) {
    return c.messageMaxLength ?? `Не более ${c.maxLength} символов`
  }
  if (c.pattern && !c.pattern.test(value)) {
    return c.messagePattern ?? 'Неверный формат'
  }
  return null
}
