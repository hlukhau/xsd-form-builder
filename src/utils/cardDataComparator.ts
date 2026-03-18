import type { CardData } from '@/types/card'
import { getAddressListFromParty, getDefaultAddressKindName } from '@/utils/addressFormatUtils'

/** Код страны и варианты названия — для нормализации при сравнении (country в XML = код, в метаданных БД = название) */
const COUNTRY_NORMALIZE: Record<string, string[]> = {
  BY: ['BY', 'БЕЛАРУСЬ', 'Беларусь', 'Belarus'],
  RU: ['RU', 'РОССИЯ', 'Россия', 'Russia'],
  KZ: ['KZ', 'КАЗАХСТАН', 'Казахстан', 'Kazakhstan'],
  AM: ['AM', 'АРМЕНИЯ', 'Армения', 'Armenia'],
  KG: ['KG', 'КИРГИЗИЯ', 'Киргизия', 'Kyrgyzstan'],
}

/** Пути, по которым не предупреждать об отсутствии в экспорте (поля пока не заполняем) */
const IGNORE_MISSING_IN_EXPORT = [
  'authorityId',
  'authority.authorityId',
  'identityDoc.authorityId',
]

function shouldIgnoreMissingExport(path: string): boolean {
  return IGNORE_MISSING_IN_EXPORT.some((s) => path.endsWith(s) || path.includes('.authorityId'))
}

/** Краткое описание адреса для отчёта сравнения (вид, страна, город, улица, дом и т.д.) */
function formatAddressShort(addr: unknown): string {
  if (addr == null || typeof addr !== 'object') return ''
  const a = addr as Record<string, unknown>
  const kind = getDefaultAddressKindName(a.addressKindCode as string) || 'адрес'
  const parts: string[] = []
  if (a.country) parts.push(String(a.country))
  if (a.postCode) parts.push(String(a.postCode))
  if (a.regionName) parts.push(String(a.regionName))
  if (a.districtName) parts.push(String(a.districtName))
  if (a.cityName) parts.push(String(a.cityName))
  if (a.settlementName) parts.push(String(a.settlementName))
  if (a.streetName) parts.push(String(a.streetName))
  if (a.buildingNumberId) {
    const b = String(a.buildingNumberId)
    const r = a.roomNumberId ? `${b} - ${a.roomNumberId}` : b
    parts.push(r)
  } else if (a.roomNumberId) parts.push(String(a.roomNumberId))
  if (a.postOfficeBoxId) parts.push(String(a.postOfficeBoxId))
  const rest = parts.filter(Boolean).join(', ')
  return rest ? `${kind} — ${rest}` : kind
}

function isEmptyValue(val: unknown): boolean {
  if (val == null) return true
  if (typeof val === 'string') return val.trim() === ''
  if (Array.isArray(val)) return val.length === 0
  if (typeof val === 'object') return Object.keys(val).length === 0
  return false
}

function normalizeCountry(val: string): string {
  if (!val || !val.trim()) return val
  const v = val.trim()
  for (const [code, variants] of Object.entries(COUNTRY_NORMALIZE)) {
    if (variants.some((x) => x.toLowerCase() === v.toLowerCase())) return code
  }
  return v
}

/**
 * Сравнивает два объекта CardData и возвращает список различий
 */
export function compareCardData(original: CardData, exported: CardData): {
  isIdentical: boolean
  differences: string[]
  warnings: string[]
  added: string[]
} {
  const differences: string[] = []
  const warnings: string[] = []
  const added: string[] = []

  // Функция для глубокого сравнения значений
  const compareValue = (path: string, originalVal: any, exportedVal: any) => {
    if (originalVal === exportedVal) return true

    // Поля country: код (BY) и название (БЕЛАРУСЬ) из БД считаем совпадающими
    if (path === 'country' || path.endsWith('.country')) {
      const o = originalVal != null ? String(originalVal).trim() : ''
      const e = exportedVal != null ? String(exportedVal).trim() : ''
      if (normalizeCountry(o) === normalizeCountry(e)) return true
    }
    
    // Обработка null/undefined
    if (originalVal == null && exportedVal == null) return true
    if (originalVal == null) {
      // В экспорте подставляется значение по умолчанию — не считать добавленным
      if (path.endsWith('.addressKindCode') && exportedVal === '1') return false
      // В экспорте есть значение — атрибут не был задан в оригинале, считаем добавленным
      if (exportedVal != null && (typeof exportedVal !== 'string' || String(exportedVal).trim() !== '')) {
        const displayVal = typeof exportedVal === 'string' ? exportedVal : JSON.stringify(exportedVal)
        added.push(`Добавлен атрибут ${path}: ${displayVal}`)
        return false
      }
      warnings.push(`Отсутствует значение в исходных данных: ${path}`)
      return false
    }
    if (exportedVal == null) {
      if (shouldIgnoreMissingExport(path)) return false
      if (isEmptyValue(originalVal)) return false
      warnings.push(`Отсутствует значение в экспортированных данных: ${path}`)
      return false
    }
    
    // Обработка массивов
    if (Array.isArray(originalVal) && Array.isArray(exportedVal)) {
      if (originalVal.length !== exportedVal.length) {
        differences.push(`Разная длина массива на пути ${path}: ${originalVal.length} vs ${exportedVal.length}`)
      }
      
      // Если массив объектов, сравниваем по содержимому (сопоставление по отпечаткам)
      if (originalVal.length > 0 && typeof originalVal[0] === 'object' && originalVal[0] !== null) {
        const isViolationsArray = /\.violations$/.test(path)
        if (isViolationsArray && originalVal.length !== exportedVal.length) {
          // Сначала сравниваем общие по индексу элементы (0..min-1), чтобы не терять изменения
          // внутри существующих нарушений (например indicatorValue в violatedIndicators).
          const commonLen = Math.min(originalVal.length, exportedVal.length)
          for (let i = 0; i < commonLen; i++) {
            compareValue(`${path}[${i}]`, originalVal[i], exportedVal[i])
          }
          for (let i = originalVal.length; i < exportedVal.length; i++) {
            const item = exportedVal[i]
            const desc = item && typeof item === 'object' && typeof (item as Record<string, unknown>).generalDescription === 'string'
              ? String((item as Record<string, unknown>).generalDescription).trim()
              : ''
            added.push(`${path}[${i}] — добавлен: нарушение${desc ? ` (${desc})` : ''}`)
          }
          for (let i = exportedVal.length; i < originalVal.length; i++) {
            warnings.push(`Отсутствует в экспорте: ${path}[${i}] (нарушение)`)
          }
          return true
        }
        const originalFingerprints = originalVal.map((item, idx) => {
          const keyFields = Object.keys(item).filter(k => {
            const val = item[k]
            return val != null && typeof val !== 'object' && !Array.isArray(val)
          })
          const fingerprint = keyFields.map(k => `${k}:${item[k]}`).join('|')
          return { fingerprint, index: idx, item }
        })
        
        const exportedFingerprints = exportedVal.map((item, idx) => {
          const keyFields = Object.keys(item).filter(k => {
            const val = item[k]
            return val != null && typeof val !== 'object' && !Array.isArray(val)
          })
          const fingerprint = keyFields.map(k => `${k}:${item[k]}`).join('|')
          return { fingerprint, index: idx, item }
        })
        
        const usedExported = new Set<number>()
        for (const orig of originalFingerprints) {
          const match = exportedFingerprints.find((exp, idx) =>
            !usedExported.has(idx) && exp.fingerprint === orig.fingerprint
          )
          if (match) {
            usedExported.add(match.index)
            compareValue(`${path}[${orig.index}]`, orig.item, match.item)
          } else {
            const bestMatch = exportedFingerprints.find((exp, idx) => !usedExported.has(idx))
            if (bestMatch) {
              usedExported.add(bestMatch.index)
              compareValue(`${path}[${orig.index}]`, orig.item, bestMatch.item)
            } else {
              const desc = formatAddressShort(orig.item)
              warnings.push(`Отсутствует в экспорте: ${path}[${orig.index}]${desc ? ` (${desc})` : ''}`)
            }
          }
        }
        
        for (let i = 0; i < exportedFingerprints.length; i++) {
          if (!usedExported.has(i)) {
            const desc = formatAddressShort(exportedFingerprints[i].item)
            added.push(`${path}[${i}]${desc ? ` — добавлен: ${desc}` : ` — добавлен`}`)
          }
        }
      } else {
        for (let i = 0; i < Math.min(originalVal.length, exportedVal.length); i++) {
          compareValue(`${path}[${i}]`, originalVal[i], exportedVal[i])
        }
        if (exportedVal.length > originalVal.length) {
          for (let i = originalVal.length; i < exportedVal.length; i++) {
            added.push(`${path}[${i}] = ${typeof exportedVal[i] === 'string' ? `"${exportedVal[i]}"` : JSON.stringify(exportedVal[i])}`)
          }
        }
        if (originalVal.length > exportedVal.length) {
          for (let i = exportedVal.length; i < originalVal.length; i++) {
            warnings.push(`Отсутствует в экспорте: ${path}[${i}]`)
          }
        }
      }
      return true
    }
    
    // Обработка объектов
    if (typeof originalVal === 'object' && typeof exportedVal === 'object') {
      const originalKeys = new Set(Object.keys(originalVal))
      const exportedKeys = new Set(Object.keys(exportedVal))
      const ADDRESS_KEYS = ['registrationAddress', 'actualAddress', 'mailingAddress', 'addresses']
      const isPartyLike = (o: unknown) =>
        o != null &&
        typeof o === 'object' &&
        (Object.prototype.hasOwnProperty.call(o, 'registrationAddress') ||
          Object.prototype.hasOwnProperty.call(o, 'actualAddress') ||
          Object.prototype.hasOwnProperty.call(o, 'mailingAddress') ||
          (Object.prototype.hasOwnProperty.call(o, 'addresses') && Array.isArray((o as { addresses?: unknown[] }).addresses) && (o as { addresses: unknown[] }).addresses.length > 0))
      // Для контрагентов (manufacturer, organization, supplyChainParties): сравниваем по единому списку адресов, не по полям reg/actual/mail
      if (isPartyLike(originalVal) || isPartyLike(exportedVal)) {
        const origList = getAddressListFromParty(originalVal as Parameters<typeof getAddressListFromParty>[0])
        const expList = getAddressListFromParty(exportedVal as Parameters<typeof getAddressListFromParty>[0])
        const addrPath = path ? `${path}.addresses` : 'addresses'
        compareValue(addrPath, origList, expList)
      }
      // Проверяем отсутствующие ключи (кроме адресов — уже сравнили списком)
      for (const key of originalKeys) {
        if (ADDRESS_KEYS.includes(key)) continue
        if (!exportedKeys.has(key)) {
          const subPath = path ? `${path}.${key}` : key
          if (shouldIgnoreMissingExport(subPath)) continue
          if (isEmptyValue(originalVal[key])) continue
          warnings.push(`Отсутствует поле в экспортированных данных: ${subPath}`)
        }
      }
      // Сравниваем общие ключи (кроме адресов)
      for (const key of originalKeys) {
        if (ADDRESS_KEYS.includes(key)) continue
        if (exportedKeys.has(key)) {
          compareValue(`${path}.${key}`, originalVal[key], exportedVal[key])
        }
      }
      // Ключи только в экспорте (кроме адресов)
      for (const key of exportedKeys) {
        if (ADDRESS_KEYS.includes(key)) continue
        if (!originalKeys.has(key)) {
          compareValue(`${path}.${key}`, undefined, exportedVal[key])
        }
      }
      return true
    }
    
    // Простое сравнение примитивов
    const o = String(originalVal).trim()
    const e = String(exportedVal).trim()
    if (o === e) return true
    // Не выводить различия, где одна из сторон пустая — не засорять список
    if (o === '' || e === '') return true
    // Если значения совпадают при замене запятой на точку — несоответствие из-за разделителя дробной части
    const oNorm = o.replace(/,/g, '.')
    const eNorm = e.replace(/,/g, '.')
    const isDecimalSeparatorMismatch = oNorm === eNorm && (o.includes(',') || e.includes(','))
    if (isDecimalSeparatorMismatch) {
      differences.push(`Разное значение на пути ${path}: "${originalVal}" vs "${exportedVal}". Несоответствие: в числовом поле использована запятая как разделитель дробной части; допускается только точка.`)
    } else {
      differences.push(`Разное значение на пути ${path}: "${originalVal}" vs "${exportedVal}"`)
    }
    return false
  }

  // Сравниваем основные поля
  compareValue('country', original.country, exported.country)
  compareValue('registrationNumber', original.registrationNumber, exported.registrationNumber)
  compareValue('version', original.version, exported.version)
  
  // Сравниваем notification
  compareValue('notification', original.notification, exported.notification)
  
  // Сравниваем product
  compareValue('product', original.product, exported.product)
  
  // Сравниваем tsd (по XSD нарушения и документы соответствия только внутри tsd.batches[])
  compareValue('tsd', original.tsd, exported.tsd)
  
  // Сравниваем detectionPlace
  compareValue('detectionPlace', original.detectionPlace, exported.detectionPlace)
  // Сравниваем spreadingZone (PHA)
  compareValue('spreadingZone', original.spreadingZone, exported.spreadingZone)
  
  // Сравниваем measures
  compareValue('measures', original.measures, exported.measures)
  
  // Сравниваем electronicDocument
  compareValue('electronicDocument', original.electronicDocument, exported.electronicDocument)
  
  // Сравниваем statusHistory
  compareValue('statusHistory', original.statusHistory, exported.statusHistory)
  
  // Сравниваем accessList
  compareValue('accessList', original.accessList, exported.accessList)

  return {
    isIdentical: differences.length === 0 && warnings.length === 0 && added.length === 0,
    differences: [...new Set(differences)],
    warnings: [...new Set(warnings)],
    added: [...new Set(added)],
  }
}

/** Проверяет, есть ли у значения содержимое (не пустое) */
function hasValue(val: unknown): boolean {
  if (val == null) return false
  if (typeof val === 'string') return val.trim() !== ''
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'object') return Object.keys(val).length > 0
  return true
}

/**
 * Для нового документа: возвращает списки путей «заполнено» и «не заполнено» (без сравнения с исходным).
 */
export function getCardDataReview(data: CardData): { filled: string[]; unfilled: string[] } {
  const filled: string[] = []
  const unfilled: string[] = []

  const walk = (path: string, val: unknown) => {
    if (val == null) {
      unfilled.push(path)
      return
    }
    if (typeof val === 'string') {
      if (val.trim() !== '') filled.push(path)
      else unfilled.push(path)
      return
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        unfilled.push(path)
        return
      }
      val.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          Object.entries(item).forEach(([k, v]) => walk(`${path}[${i}].${k}`, v))
        } else {
          walk(`${path}[${i}]`, item)
        }
      })
      return
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val)
      if (entries.length === 0) {
        unfilled.push(path)
        return
      }
      for (const [k, v] of entries) {
        walk(path ? `${path}.${k}` : k, v)
      }
      return
    }
    filled.push(path)
  }

  walk('country', data.country)
  walk('registrationNumber', data.registrationNumber)
  walk('notification', data.notification)
  walk('product', data.product)
  walk('tsd', data.tsd)
  walk('detectionPlace', data.detectionPlace)
  walk('spreadingZone', data.spreadingZone)
  walk('measures', data.measures)
  walk('electronicDocument', data.electronicDocument)
  walk('statusHistory', data.statusHistory)

  return { filled, unfilled }
}

