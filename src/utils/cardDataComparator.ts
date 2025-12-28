import type { CardData } from '@/types/card'

/**
 * Сравнивает два объекта CardData и возвращает список различий
 */
export function compareCardData(original: CardData, exported: CardData): {
  isIdentical: boolean
  differences: string[]
  warnings: string[]
} {
  const differences: string[] = []
  const warnings: string[] = []

  // Функция для глубокого сравнения значений
  const compareValue = (path: string, originalVal: any, exportedVal: any) => {
    if (originalVal === exportedVal) return true
    
    // Обработка null/undefined
    if (originalVal == null && exportedVal == null) return true
    if (originalVal == null) {
      warnings.push(`Отсутствует значение в исходных данных: ${path}`)
      return false
    }
    if (exportedVal == null) {
      warnings.push(`Отсутствует значение в экспортированных данных: ${path}`)
      return false
    }
    
    // Обработка массивов
    if (Array.isArray(originalVal) && Array.isArray(exportedVal)) {
      if (originalVal.length !== exportedVal.length) {
        differences.push(`Разная длина массива на пути ${path}: ${originalVal.length} vs ${exportedVal.length}`)
        return false
      }
      
      // Если массив объектов, сравниваем по содержимому, а не по порядку
      if (originalVal.length > 0 && typeof originalVal[0] === 'object' && originalVal[0] !== null) {
        // Создаем набор "отпечатков" для каждого элемента
        const originalFingerprints = originalVal.map((item, idx) => {
          // Создаем простой отпечаток на основе ключевых полей
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
        
        // Сопоставляем элементы по отпечаткам
        const usedExported = new Set<number>()
        for (const orig of originalFingerprints) {
          const match = exportedFingerprints.find((exp, idx) => 
            !usedExported.has(idx) && exp.fingerprint === orig.fingerprint
          )
          
          if (match) {
            usedExported.add(match.index)
            compareValue(`${path}[${orig.index}]`, orig.item, match.item)
          } else {
            // Ищем наиболее похожий элемент
            const bestMatch = exportedFingerprints.find((exp, idx) => !usedExported.has(idx))
            if (bestMatch) {
              usedExported.add(bestMatch.index)
              compareValue(`${path}[${orig.index}]`, orig.item, bestMatch.item)
            } else {
              warnings.push(`Не найден соответствующий элемент в экспортированных данных: ${path}[${orig.index}]`)
            }
          }
        }
        
        // Проверяем неиспользованные элементы в экспортированном массиве
        for (let i = 0; i < exportedFingerprints.length; i++) {
          if (!usedExported.has(i)) {
            warnings.push(`Лишний элемент в экспортированных данных: ${path}[${i}]`)
          }
        }
      } else {
        // Для примитивных массивов сравниваем по порядку
        for (let i = 0; i < originalVal.length; i++) {
          compareValue(`${path}[${i}]`, originalVal[i], exportedVal[i])
        }
      }
      return true
    }
    
    // Обработка объектов
    if (typeof originalVal === 'object' && typeof exportedVal === 'object') {
      const originalKeys = new Set(Object.keys(originalVal))
      const exportedKeys = new Set(Object.keys(exportedVal))
      
      // Проверяем отсутствующие ключи
      for (const key of originalKeys) {
        if (!exportedKeys.has(key)) {
          warnings.push(`Отсутствует поле в экспортированных данных: ${path}.${key}`)
        }
      }
      for (const key of exportedKeys) {
        if (!originalKeys.has(key)) {
          warnings.push(`Отсутствует поле в исходных данных: ${path}.${key}`)
        }
      }
      
      // Сравниваем общие ключи
      for (const key of originalKeys) {
        if (exportedKeys.has(key)) {
          compareValue(`${path}.${key}`, originalVal[key], exportedVal[key])
        }
      }
      return true
    }
    
    // Простое сравнение примитивов
    if (String(originalVal).trim() !== String(exportedVal).trim()) {
      differences.push(`Разное значение на пути ${path}: "${originalVal}" vs "${exportedVal}"`)
      return false
    }
    
    return true
  }

  // Сравниваем основные поля
  compareValue('country', original.country, exported.country)
  compareValue('registrationNumber', original.registrationNumber, exported.registrationNumber)
  compareValue('version', original.version, exported.version)
  
  // Сравниваем notification
  compareValue('notification', original.notification, exported.notification)
  
  // Сравниваем product
  compareValue('product', original.product, exported.product)
  
  // Сравниваем tsd
  compareValue('tsd', original.tsd, exported.tsd)
  
  // Сравниваем violations
  compareValue('violations', original.violations, exported.violations)
  
  // Сравниваем complianceDocuments
  compareValue('complianceDocuments', original.complianceDocuments, exported.complianceDocuments)
  
  // Сравниваем detectionPlace
  compareValue('detectionPlace', original.detectionPlace, exported.detectionPlace)
  
  // Сравниваем measures
  compareValue('measures', original.measures, exported.measures)
  
  // Сравниваем electronicDocument
  compareValue('electronicDocument', original.electronicDocument, exported.electronicDocument)
  
  // Сравниваем statusHistory
  compareValue('statusHistory', original.statusHistory, exported.statusHistory)
  
  // Сравниваем accessList
  compareValue('accessList', original.accessList, exported.accessList)

  return {
    isIdentical: differences.length === 0 && warnings.length === 0,
    differences: [...new Set(differences)],
    warnings: [...new Set(warnings)],
  }
}

