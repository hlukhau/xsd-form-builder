import type {
  CardData,
  ElectronicDocument,
  Notification,
  ProductData,
  ProductDetails,
  SupplyChainPartyDetails,
  AddressDetails,
  ContactDetails,
  TechnicalDocument,
  TSDData,
  ProductBatchDetails,
  ShippingDocument,
  MeasureWithUnit,
  ComplianceDocumentsData,
  ComplianceDocument,
  UnifiedAuthorityDetails,
  ViolationsData,
  ViolatedRequirement,
  ViolatedIndicator,
  DocStructuralElement,
  DetectionPlaceData,
  BusinessEntityDetails,
  BorderCheckpointDetails,
  GeoCoordinateDetails,
  MeasuresData,
  SanitaryMeasure,
  MeasureDocDetails,
  MeasureInitiationBasisItem,
  MeasureImplementationItem,
  SubjectDetails,
  IdentityDocDetails,
  DocumentReferenceDetails,
  MeasurePlaceDetails,
} from '@/types/card'
import { SANITARY_MEASURE_START_DATE_XML_PLACEHOLDER } from '@/constants/measureXml'
import { getIncidentAlertKindNameByCode, checkIncidentAlertKindExists, getIncidentAlertKindOptions, checkSanitaryProdTypeExists, getSanitaryProdTypeOptions, checkShipDocKindExists, checkSupplyChainPartyKindExists, checkSanitaryMeasureObjKindExists } from '@/utils/referenceDataApi'
import { DPA_CANONICAL_XML_NAMESPACES, normalizeXmlNamespaces } from '@/utils/xmlNamespaceNormalizer'

/**
 * Парсит XML документ и преобразует его в структуру CardData
 */
export function parseXMLToCardData(xmlText: string): CardData {
  const xmlTextNormalized = normalizeXmlNamespaces(xmlText, DPA_CANONICAL_XML_NAMESPACES)
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlTextNormalized, 'text/xml')

  // Проверка на ошибки парсинга
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    const errorText = parserError.textContent || 'Неизвестная ошибка'
    console.error('Ошибка парсинга XML:', errorText)
    throw new Error(`Ошибка парсинга XML: ${errorText}`)
  }

  // Проверка наличия корневого элемента
  const rootElement = xmlDoc.documentElement
  if (!rootElement) {
    throw new Error('XML документ не содержит корневого элемента')
  }

  console.log('XML успешно распарсен, корневой элемент:', rootElement.tagName)

  // Извлечение данных из EDocHeader
  // Ищем с учетом namespace - используем getElementsByTagNameNS или поиск по локальному имени
  let edocHeader: Element | null = null
  
  // Пробуем найти через getElementsByTagName с namespace
  try {
    const elements = xmlDoc.getElementsByTagName('ccdo:EDocHeader')
    if (elements.length > 0) {
      edocHeader = elements[0]
      console.log('Найден EDocHeader через namespace ccdo:EDocHeader')
    }
  } catch (e) {
    // Игнорируем ошибку
  }
  
  // Если не нашли, ищем по локальному имени
  if (!edocHeader) {
    const allElements = xmlDoc.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'edocheader') {
        edocHeader = el
        console.log('Найден EDocHeader по локальному имени')
        break
      }
    }
  }
  
  if (!edocHeader) {
    console.warn('EDocHeader не найден, используем значения по умолчанию')
  } else {
    console.log('EDocHeader найден:', edocHeader.tagName)
  }
  
  const electronicDocument: ElectronicDocument = {
    messageCode: getTextContent(edocHeader, 'InfEnvelopeCode') || '',
    documentCode: getTextContent(edocHeader, 'EDocCode') || '',
    documentId: getTextContent(edocHeader, 'EDocId') || '',
    documentDate: getTextContent(edocHeader, 'EDocDateTime') || '',
    language: getTextContent(edocHeader, 'LanguageCode') || 'ru',
    sourceDocumentId: getTextContent(edocHeader, 'EDocRefId') || '',
    validityPeriod: {
      start: '',
      end: '',
    },
    updateDateTime: '',
  }

  // Извлечение данных из DangerousProductAlertDetails
  // Ищем с учетом namespace
  let alertDetails: Element | null = null
  
  // Пробуем найти через getElementsByTagName с namespace
  try {
    const elements = xmlDoc.getElementsByTagName('smcdo:DangerousProductAlertDetails')
    if (elements.length > 0) {
      alertDetails = elements[0]
    }
  } catch (e) {
    // Игнорируем ошибку
  }
  
  // Если не нашли, ищем по локальному имени
  if (!alertDetails) {
    const allElements = xmlDoc.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'dangerousproductalertdetails') {
        alertDetails = el
        break
      }
    }
  }
  
  if (!alertDetails) {
    throw new Error('Не найден элемент DangerousProductAlertDetails в XML')
  }
  
  console.log('Найден DangerousProductAlertDetails')
  
  const country = getTextContent(alertDetails, 'UnifiedCountryCode') || ''
  const registrationNumber = getTextContent(alertDetails, 'IncidentId') || ''
  const incidentKindCode = getTextContent(alertDetails, 'IncidentKindCode') || ''
  const docCreationDate = getTextContent(alertDetails, 'DocCreationDate') || ''
  
  console.log('Извлеченные данные:', { country, registrationNumber, incidentKindCode, docCreationDate })

  // Уполномоченный орган - ищем по namespace и локальному имени
  let authority: Element | null = null
  try {
    const authorityElements = alertDetails.getElementsByTagName('ccdo:UnifiedAuthorityDetails')
    if (authorityElements.length > 0) {
      authority = authorityElements[0]
      console.log('[parseXMLToCardData] Найден UnifiedAuthorityDetails через namespace')
    }
  } catch (e) {
    console.log('[parseXMLToCardData] Ошибка при поиске через namespace:', e)
  }
  
  // Если не нашли через namespace, ищем по локальному имени
  if (!authority) {
    const allElements = alertDetails.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'unifiedauthoritydetails') {
        authority = el
        console.log('[parseXMLToCardData] Найден UnifiedAuthorityDetails по локальному имени')
        break
      }
    }
  }
  
  if (!authority) {
    console.warn('[parseXMLToCardData] UnifiedAuthorityDetails не найден!')
  }
  
  const authorizedBody = {
    country: authority ? (getTextContent(authority, 'UnifiedCountryCode') || '') : '',
    identifier: authority ? (getTextContent(authority, 'AuthorityId') || '') : '',
    name: authority ? (getTextContent(authority, 'AuthorityName') || '') : '',
    shortName: authority ? (getTextContent(authority, 'AuthorityBriefName') || getTextContent(authority, 'AuthorityShortName') || '') : '',
  }
  
  console.log('[parseXMLToCardData] authorizedBody:', authorizedBody)

  // ResourceItemStatusDetails → ValidityPeriodDetails (StartDateTime, EndDateTime), UpdateDateTime
  const findByName = (parent: Element, localNameAnyCase: string): Element | null => {
    const wantLower = localNameAnyCase.toLowerCase()
    try {
      const byNs = parent.getElementsByTagNameNS('*', localNameAnyCase)
      if (byNs.length > 0) return byNs[0]
    } catch (_) {}
    const all = parent.getElementsByTagName('*')
    for (let i = 0; i < all.length; i++) {
      const el = all[i]
      const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      if (localName === wantLower) return el
    }
    return null
  }
  const tryFind = (parent: Element | null, name: string): Element | null => parent ? findByName(parent, name) : null
  let resourceStatus = tryFind(alertDetails, 'ResourceItemStatusDetails') ?? tryFind(alertDetails, 'resourceitemstatusdetails')
  if (!resourceStatus) {
    resourceStatus = tryFind(xmlDoc.documentElement, 'ResourceItemStatusDetails') ?? tryFind(xmlDoc.documentElement, 'resourceitemstatusdetails')
  }
  let validityPeriod: Element | null = null
  if (resourceStatus) {
    validityPeriod = tryFind(resourceStatus, 'ValidityPeriodDetails') ?? tryFind(resourceStatus, 'validityperioddetails')
  }
  const startDateTime = (getTextContent(validityPeriod, 'StartDateTime') || getTextFromDirectChildByLocalName(validityPeriod, 'StartDateTime') || '').trim()
  const endDateTime = (getTextContent(validityPeriod, 'EndDateTime') || getTextFromDirectChildByLocalName(validityPeriod, 'EndDateTime') || '').trim()
  const updateDateTime = (getTextContent(resourceStatus, 'UpdateDateTime') || getTextFromDirectChildByLocalName(resourceStatus, 'UpdateDateTime') || '').trim()

  if (startDateTime) electronicDocument.validityPeriod.start = startDateTime
  if (endDateTime) electronicDocument.validityPeriod.end = endDateTime
  if (updateDateTime) electronicDocument.updateDateTime = updateDateTime

  // EndDate уведомления: только прямой дочерний csdo:EndDate у smcdo:DangerousProductAlertDetails.
  // getTextContent обходит всех потомков и мог бы взять csdo:EndDate из smcdo:SanitaryMeasureBaseDetails.
  const endDate = getTextFromDirectChildByLocalName(alertDetails, 'EndDate')

  // Парсинг данных о продукции
  // Передаем и alertDetails, и корневой элемент для поиска
  const productData = parseProductData(alertDetails, xmlDoc.documentElement)
  
  // Парсинг данных о партиях (ТСД); в каждой партии также парсятся документы соответствия и нарушения
  const tsdData = parseTSDData(alertDetails, xmlDoc.documentElement)
  
  // По XSD документы соответствия и нарушения только внутри партий; при разборе из корня (старый XML) кладём в партию
  let finalTsd = tsdData
  const mergedCompliance = mergeComplianceDocumentsFromBatches(tsdData)
  const mergedViolations = mergeViolationsFromBatches(tsdData)
  if (!mergedCompliance?.documents?.length) {
    const fallbackCompliance = parseComplianceDocuments(alertDetails, xmlDoc.documentElement)
    if (fallbackCompliance?.documents?.length) {
      const batches = finalTsd?.batches?.length ? [...finalTsd.batches] : [{ shippingDocuments: [] }]
      const first = batches[0]
      batches[0] = { ...first, complianceDocuments: fallbackCompliance.documents }
      finalTsd = { batches }
    }
  }
  if (!mergedViolations || ((mergedViolations.violatedRequirements?.length ?? 0) === 0 && (mergedViolations.violatedIndicators?.length ?? 0) === 0 && !mergedViolations.generalDescription)) {
    const fallbackViolationsList = parseViolations(alertDetails, xmlDoc.documentElement)
    if (fallbackViolationsList?.length) {
      const batches = finalTsd?.batches?.length ? [...finalTsd.batches] : [{ shippingDocuments: [] }]
      const first = batches[0]
      batches[0] = { ...first, violations: fallbackViolationsList }
      finalTsd = { batches }
    }
  }

  // Парсинг места обнаружения
  const detectionPlaceData = parseDetectionPlace(alertDetails, xmlDoc.documentElement)
  
  // Парсинг принятых мер
  const measuresData = parseMeasures(alertDetails, xmlDoc.documentElement)

  // Сохраняем код вида уведомления в notification.type. Дата формирования — только дата (yyyy-MM-dd), без времени.
  const formationDateOnly = docCreationDate?.trim().slice(0, 10) || ''
  const notification: Notification = {
    country,
    registrationNumber,
    type: incidentKindCode || '', // Сохраняем код
    formationDate: formationDateOnly,
    endDate: endDate || null,
    authorizedBody,
  }

  // Метаинформация (часть данных берется из XML, часть - заглушки)
  // Убеждаемся, что все обязательные поля заполнены
  const cardData: CardData = {
    country: country || 'RU',
    registrationNumber: registrationNumber || 'N/A',
    version: 1, // Версия не в XML, берем по умолчанию
    source: 'входящие', // Источник не в XML, берем по умолчанию
    createdAt: electronicDocument.documentDate || new Date().toISOString(),
    modifiedAt: updateDateTime || electronicDocument.documentDate || new Date().toISOString(),
    status: 'в обработке', // Статус не в XML, берем по умолчанию
    electronicDocument: {
      ...electronicDocument,
      messageCode: electronicDocument.messageCode || '',
      documentCode: electronicDocument.documentCode || '',
      documentId: electronicDocument.documentId || '',
      documentDate: electronicDocument.documentDate || new Date().toISOString(),
      language: electronicDocument.language || 'ru',
      sourceDocumentId: electronicDocument.sourceDocumentId || '',
      validityPeriod: {
        start: electronicDocument.validityPeriod.start || '',
        end: electronicDocument.validityPeriod.end || '',
      },
      updateDateTime: electronicDocument.updateDateTime || '',
    },
    notification: {
      ...notification,
      country: notification.country || 'RU',
      registrationNumber: notification.registrationNumber || 'N/A',
      type: notification.type || '', // Код вида уведомления
      formationDate: notification.formationDate || new Date().toISOString().split('T')[0],
      endDate: notification.endDate,
      authorizedBody: {
        country: notification.authorizedBody.country || notification.country || 'BY',
        identifier: notification.authorizedBody.identifier || '',
        name: notification.authorizedBody.name || '',
        shortName: notification.authorizedBody.shortName || '',
      },
    },
    statusHistory: [
      {
        status: 'новое',
        dateTime: electronicDocument.documentDate || new Date().toISOString(),
        employee: null,
      },
    ],
    accessList: [
      { id: '1', name: 'РЦГЭИОЗ' },
    ],
    product: productData,
    tsd: finalTsd,
    detectionPlace: detectionPlaceData,
    measures: measuresData,
  }

  console.log('Создан объект CardData:', cardData)
  console.log('Проверка обязательных полей:', {
    hasCountry: !!cardData.country,
    hasRegistrationNumber: !!cardData.registrationNumber,
    hasElectronicDocument: !!cardData.electronicDocument,
    hasNotification: !!cardData.notification,
    hasStatusHistory: !!cardData.statusHistory && cardData.statusHistory.length > 0,
    hasAccessList: !!cardData.accessList && cardData.accessList.length > 0,
  })
  
  return cardData
}

/**
 * Извлекает текстовое содержимое элемента по имени тега
 * Поддерживает поиск с учетом namespace
 */
/** URI пространств имён из XSD (для поиска по NS без зависимости от префикса) */
const NS_CSDO = 'urn:EEC:M:SimpleDataObjects:v0.4.12'
const NS_CCDO = 'urn:EEC:M:ComplexDataObjects:v0.4.12'
const NS_SMSDO = 'urn:EEC:M:SM:SimpleDataObjects:v0.3.9'
const NS_SMCDO = 'urn:EEC:M:SM:ComplexDataObjects:v0.3.9'

export function getTextContent(
  parent: Element | null,
  tagName: string
): string | null {
  if (!parent) return null

  // 1) Поиск по известным namespace URI (csdo и др.) — надёжно для XML из XSD
  const nsUris = [NS_CSDO, NS_SMSDO, NS_CCDO, NS_SMCDO]
  for (const ns of nsUris) {
    try {
      const elements = parent.getElementsByTagNameNS(ns, tagName)
      if (elements.length > 0) {
        const text = elements[0].textContent?.trim() || null
        if (text) return text
      }
    } catch (_) {}
  }

  // 2) getElementsByTagNameNS('*', localName) во многих браузерах возвращает 0 для элементов с namespace (напр. csdo:UniqueCustomsNumberId)
  try {
    const byLocal = parent.getElementsByTagNameNS('*', tagName)
    if (byLocal.length > 0) {
      const text = byLocal[0].textContent?.trim() || null
      if (text) return text
    }
  } catch (_) {}

  // 3) Поиск по префиксу (csdo:TagName и т.д.)
  const namespaces = ['ccdo', 'csdo', 'smsdo', 'smcdo', 'doc']
  for (const ns of namespaces) {
    try {
      const elements = parent.getElementsByTagName(`${ns}:${tagName}`)
      if (elements.length > 0) {
        const text = elements[0].textContent?.trim() || null
        if (text) return text
      }
    } catch (_) {}
  }

  // 4) По локальному имени среди всех потомков (без учёта регистра)
  const tagNameLower = tagName.toLowerCase()
  const allElements = parent.getElementsByTagName('*')
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i]
    const rawLocal = element.localName || element.tagName.split(':').pop() || ''
    if (rawLocal.toLowerCase() === tagNameLower) {
      const text = element.textContent?.trim() || null
      if (text) return text
    }
  }

  // 5) Элемент без префикса (тег как есть)
  try {
    const elements = parent.getElementsByTagName(tagName)
    if (elements.length > 0) {
      const text = elements[0].textContent?.trim() || null
      if (text) return text
    }
  } catch (_) {}

  return null
}

/**
 * Текст первого прямого дочернего элемента с заданным локальным именем (без учёта префикса).
 * Исключает подмешивание значений из вложенных блоков (адрес субъекта, мероприятие, DescriptionText документа и т.д.).
 */
function getDirectChildTextByLocalName(parent: Element, localName: string): string | null {
  const want = localName.toLowerCase()
  for (let i = 0; i < parent.children.length; i++) {
    const n = parent.children[i]
    if (n.nodeType !== Node.ELEMENT_NODE) continue
    const el = n as Element
    const ln = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (ln === want) {
      const t = el.textContent?.trim()
      return t || null
    }
  }
  return null
}

/**
 * Извлекает внутренний XML первого элемента с заданным именем (все дочерние узлы сериализованы в строку).
 * Используется для ccdo:AnyDetails -> ccdo:DocDetails и вложенной структуры (сохраняются теги).
 */
function getInnerXmlContent(parent: Element | null, tagName: string): string | undefined {
  if (!parent) return undefined
  let element: Element | null = null
  const tagNameLower = tagName.toLowerCase()
  const nsUris = [NS_CSDO, NS_SMSDO, NS_CCDO, NS_SMCDO]
  for (const ns of nsUris) {
    try {
      const elements = parent.getElementsByTagNameNS(ns, tagName)
      if (elements.length > 0) {
        element = elements[0]
        break
      }
    } catch (_) {}
  }
  if (!element) {
    const namespaces = ['ccdo', 'csdo', 'smsdo', 'smcdo', 'doc']
    for (const ns of namespaces) {
      try {
        const elements = parent.getElementsByTagName(`${ns}:${tagName}`)
        if (elements.length > 0) {
          element = elements[0]
          break
        }
      } catch (_) {}
    }
  }
  if (!element) {
    const allElements = parent.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const rawLocal = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      if (rawLocal === tagNameLower) {
        element = el
        break
      }
    }
  }
  if (!element || !element.childNodes || element.childNodes.length === 0) return undefined
  try {
    const serializer = new XMLSerializer()
    const parts: string[] = []
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i]
      if (node.nodeType === 1) parts.push(serializer.serializeToString(node))
    }
    const inner = parts.join('').trim()
    return inner || undefined
  } catch (_) {
    return undefined
  }
}

/**
 * Извлекает текст из первого прямого дочернего элемента с заданным локальным именем (без учёта регистра).
 * Используется как запасной способ, когда getTextContent не срабатывает (например, в части браузеров).
 */
function getTextFromDirectChildByLocalName(parent: Element | null, tagLocalName: string): string | null {
  if (!parent || !parent.childNodes) return null
  const want = tagLocalName.toLowerCase()
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i]
    if (node.nodeType !== 1) continue
    const el = node as Element
    const local = (el.localName || (el.tagName || '').split(':').pop() || '').toLowerCase()
    if (local === want) {
      const text = (el.textContent || '').trim()
      return text || null
    }
  }
  return null
}

/**
 * Извлекает текстовое содержимое всех прямых дочерних элементов с заданным именем тега (для maxOccurs="unbounded").
 * Сравнение по локальному имени тега (без namespace). Возвращает массив в порядке появления в XML.
 */
export function getAllTextContents(parent: Element | null, tagName: string): string[] {
  if (!parent) return []
  const result: string[] = []
  const tagNameLower = tagName.toLowerCase()
  const childNodes = parent.childNodes
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i]
    if (node.nodeType !== 1) continue // 1 = ELEMENT_NODE
    const el = node as Element
    const localName = (el.localName || (el.tagName || '').split(':').pop() || '').toLowerCase()
    if (localName !== tagNameLower) continue
    const text = (el.textContent || '').trim()
    if (text) result.push(text)
  }
  return result
}

/**
 * Парсит данные о продукции из XML
 */
function parseProductData(alertDetails: Element, rootElement?: Element): ProductData | undefined {
  // Ищем NonCompliantSanitaryProductDetails
  let productDetailsElement: Element | null = null
  
  // Сначала пробуем найти через getElementsByTagName с namespace
  try {
    const elements = alertDetails.getElementsByTagName('smcdo:NonCompliantSanitaryProductDetails')
    if (elements.length > 0) {
      productDetailsElement = elements[0]
      console.log('Найден NonCompliantSanitaryProductDetails через getElementsByTagName с namespace')
    }
  } catch (e) {
    console.log('Ошибка при поиске через getElementsByTagName:', e)
  }
  
  // Пробуем через querySelector
  if (!productDetailsElement) {
    try {
      const element = alertDetails.querySelector('smcdo\\:NonCompliantSanitaryProductDetails')
      if (element) {
        productDetailsElement = element as Element
        console.log('Найден NonCompliantSanitaryProductDetails через querySelector')
      }
    } catch (e) {
      console.log('Ошибка при поиске через querySelector:', e)
    }
  }
  
  // Если не нашли, ищем по локальному имени и полному имени тега
  if (!productDetailsElement) {
    const allElements = alertDetails.getElementsByTagName('*')
    console.log('Ищем NonCompliantSanitaryProductDetails среди', allElements.length, 'элементов')
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const tagName = el.tagName
      const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
      
      // Логируем первые несколько элементов для отладки
      if (i < 10) {
        console.log(`Элемент ${i}: tagName=${tagName}, localName=${localName}`)
      }
      
      // Проверяем по локальному имени
      if (localName === 'noncompliantsanitaryproductdetails') {
        productDetailsElement = el
        console.log('Найден NonCompliantSanitaryProductDetails по локальному имени:', tagName)
        break
      }
      
      // Также проверяем по полному имени тега (на случай если localName не работает)
      if (tagName.toLowerCase().includes('noncompliantsanitaryproductdetails')) {
        productDetailsElement = el
        console.log('Найден NonCompliantSanitaryProductDetails по полному имени тега:', tagName)
        break
      }
    }
  }

  // Если не нашли через getElementsByTagName, пробуем среди прямых дочерних элементов
  if (!productDetailsElement) {
    const children = Array.from(alertDetails.children)
    console.log('Прямые дочерние элементы alertDetails:', children.map(el => ({
      tagName: el.tagName,
      localName: el.localName || el.tagName.split(':').pop()?.toLowerCase()
    })))
    
    for (const child of children) {
      const localName = child.localName || child.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'noncompliantsanitaryproductdetails') {
        productDetailsElement = child
        console.log('Найден NonCompliantSanitaryProductDetails среди прямых дочерних элементов')
        break
      }
    }
  }

  // Если все еще не нашли и есть rootElement, пробуем искать там
  if (!productDetailsElement && rootElement) {
    console.log('Пробуем искать в корневом элементе')
    try {
      const elements = rootElement.getElementsByTagName('smcdo:NonCompliantSanitaryProductDetails')
      if (elements.length > 0) {
        productDetailsElement = elements[0]
        console.log('Найден NonCompliantSanitaryProductDetails в корневом элементе')
      }
    } catch (e) {
      // Игнорируем ошибку
    }
    
    if (!productDetailsElement) {
      const allElements = rootElement.getElementsByTagName('*')
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i]
        const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        if (localName === 'noncompliantsanitaryproductdetails') {
          productDetailsElement = el
          console.log('Найден NonCompliantSanitaryProductDetails в корневом элементе по локальному имени')
          break
        }
      }
    }
  }

  if (!productDetailsElement) {
    console.log('NonCompliantSanitaryProductDetails не найден')
    return undefined
  }
  
  console.log('Найден NonCompliantSanitaryProductDetails:', productDetailsElement.tagName)

  // Извлекаем данные о типе продукции: либо код (→ SANITARYPRODTYPEID), либо наименование (→ SANITARYPRODTYPENAME)
  const typeCode = getTextContent(productDetailsElement, 'SanitaryProductTypeCode') || ''
  const typeName = getTextContent(productDetailsElement, 'SanitaryProductTypeName') || ''

  // Извлекаем ProductDetails
  let productDetailsEl: Element | null = null
  
  // Пробуем найти через getElementsByTagName
  try {
    const elements = productDetailsElement.getElementsByTagName('smcdo:ProductDetails')
    if (elements.length > 0) {
      productDetailsEl = elements[0]
      console.log('Найден ProductDetails через getElementsByTagName')
    }
  } catch (e) {
    console.log('Ошибка при поиске ProductDetails через getElementsByTagName:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (!productDetailsEl) {
    const productChildren = productDetailsElement.getElementsByTagName('*')
    console.log('Ищем ProductDetails среди', productChildren.length, 'элементов')
    for (let i = 0; i < productChildren.length; i++) {
      const el = productChildren[i]
      const tagName = el.tagName
      const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
      
      if (i < 5) {
        console.log(`  Элемент ${i}: tagName=${tagName}, localName=${localName}`)
      }
      
      if (localName === 'productdetails' || 
          tagName.toLowerCase().includes('productdetails') ||
          tagName === 'smcdo:ProductDetails') {
        productDetailsEl = el
        console.log('Найден ProductDetails по локальному имени:', tagName)
        break
      }
    }
  }

  if (!productDetailsEl) {
    console.log('ProductDetails не найден')
  } else {
    console.log('ProductDetails найден:', productDetailsEl.tagName)
  }

  const tradeNamesArr = getAllTextContents(productDetailsEl, 'ProductTradeName')
  const productDetails: ProductDetails = {
    productId: getTextContent(productDetailsEl, 'ProductId') || undefined,
    productName: getTextContent(productDetailsEl, 'ProductName') || undefined,
    tradeName: tradeNamesArr.length > 0 ? tradeNamesArr[0] : undefined,
    tradeNames: tradeNamesArr.length > 0 ? tradeNamesArr : undefined,
    description: getTextContent(productDetailsEl, 'DescriptionText') || undefined,
    commodityCode: getTextContent(productDetailsEl, 'CommodityCode') || undefined,
    productPurpose: getTextContent(productDetailsEl, 'ProductPurposeText') || undefined,
    applicationMethod: getTextContent(productDetailsEl, 'ProductApplicationMethodText') || undefined,
    releaseForm: getTextContent(productDetailsEl, 'ReleaseFormText') || undefined,
    storageCondition: getTextContent(productDetailsEl, 'StorageConditionText') || undefined,
    labelText: getTextContent(productDetailsEl, 'ProductLabelText') || undefined,
    technicalDocs: parseTechnicalDocs(productDetailsEl),
  }

  console.log('Распарсены ProductDetails:', productDetails)

  // Извлекаем SupplyChainPartyDetails (изготовитель) - только с кодом 41
  const manufacturer = parseSupplyChainPartyByKind(productDetailsElement, '41')
  console.log('Распарсен изготовитель:', manufacturer)

  return {
    typeName,
    typeCode,
    productDetails,
    manufacturer,
  }
}

/**
 * Парсит техническую документацию
 * Ищем DocContentDetailsType, DocReferenceDetails и подобные элементы
 */
function parseTechnicalDocs(parent: Element | null): TechnicalDocument[] {
  if (!parent) return []

  const docs: TechnicalDocument[] = []
  
  // Сначала пробуем найти через namespace
  try {
    const docRefElements = parent.getElementsByTagName('ccdo:DocReferenceDetails')
    for (let i = 0; i < docRefElements.length; i++) {
      const el = docRefElements[i]
      const doc: TechnicalDocument = {
        docKindCode: getTextContent(el, 'DocKindCode') || undefined,
        docKindName: getTextContent(el, 'DocKindName') || undefined,
        docName: getTextContent(el, 'DocName') || undefined,
        docId: getTextContent(el, 'DocId') || undefined,
        docCreationDate: getTextContent(el, 'DocCreationDate') || undefined,
        docStartDate: getTextContent(el, 'DocStartDate') || undefined,
      }
      
      // Добавляем только если есть хотя бы одно поле
      if (doc.docName || doc.docId || doc.docKindCode) {
        docs.push(doc)
      }
    }
  } catch (e) {
    console.log('[parseTechnicalDocs] Ошибка при поиске через namespace:', e)
  }
  
  // Если не нашли через namespace, ищем по локальному имени
  if (docs.length === 0) {
    const allElements = parent.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      // Ищем элементы, которые могут быть документами
      // DocReferenceDetails, DocContentDetailsType, TechnicalDocDetails, DocDetails и т.д.
      if (
        localName === 'docreferencedetails' ||
        localName?.includes('docdetails') ||
        localName === 'technicaldocdetails' ||
        localName === 'doccontentdetails'
      ) {
        const doc: TechnicalDocument = {
          docKindCode: getTextContent(el, 'DocKindCode') || undefined,
          docKindName: getTextContent(el, 'DocKindName') || undefined,
          docName: getTextContent(el, 'DocName') || undefined,
          docId: getTextContent(el, 'DocId') || undefined,
          docCreationDate: getTextContent(el, 'DocCreationDate') || undefined,
          docStartDate: getTextContent(el, 'DocStartDate') || undefined,
        }
        
        // Добавляем только если есть хотя бы одно поле
        if (doc.docName || doc.docId || doc.docKindCode) {
          docs.push(doc)
        }
      }
    }
  }

  console.log('[parseTechnicalDocs] Найдено документов:', docs.length)
  return docs
}

/**
 * Парсит данные об участнике цепи поставки по коду вида
 */
function parseSupplyChainPartyByKind(parent: Element, kindCode: string): SupplyChainPartyDetails {
  // Ищем все SupplyChainPartyDetails и выбираем с нужным кодом
  let supplyChainEl: Element | null = null
  
  // Пробуем найти через getElementsByTagName
  try {
    const elements = parent.getElementsByTagName('ccdo:SupplyChainPartyDetails')
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]
      const code = getTextContent(el, 'SupplyChainPartyKindCode')
      if (code === kindCode) {
        supplyChainEl = el
        console.log(`Найден SupplyChainPartyDetails с кодом ${kindCode} через getElementsByTagName`)
        break
      }
    }
  } catch (e) {
    console.log('Ошибка при поиске SupplyChainPartyDetails через getElementsByTagName:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (!supplyChainEl) {
    const allElements = parent.getElementsByTagName('*')
    console.log(`Ищем SupplyChainPartyDetails с кодом ${kindCode} среди`, allElements.length, 'элементов')
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const tagName = el.tagName
      const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'supplychainpartydetails' || 
          tagName.toLowerCase().includes('supplychainpartydetails') ||
          tagName === 'ccdo:SupplyChainPartyDetails') {
        const code = getTextContent(el, 'SupplyChainPartyKindCode')
        if (code === kindCode) {
          supplyChainEl = el
          console.log(`Найден SupplyChainPartyDetails с кодом ${kindCode} по локальному имени:`, tagName)
          break
        }
      }
    }
  }

  if (!supplyChainEl) {
    console.log(`SupplyChainPartyDetails с кодом ${kindCode} не найден`)
    return {
      country: '',
    }
  }

  return parseSupplyChainPartyDetails(supplyChainEl)
}

/**
 * Парсит данные об участнике цепи поставки (изготовитель)
 */
function parseSupplyChainParty(parent: Element): SupplyChainPartyDetails {
  let supplyChainEl: Element | null = null
  
  // Проверяем, является ли сам parent элементом SupplyChainPartyDetails
  const parentTagName = parent.tagName
  const parentLocalName = parent.localName || parentTagName.split(':').pop()?.toLowerCase()
  
  if (parentLocalName === 'supplychainpartydetails' || 
      parentTagName.toLowerCase().includes('supplychainpartydetails') ||
      parentTagName === 'ccdo:SupplyChainPartyDetails') {
    // parent уже является SupplyChainPartyDetails, используем его напрямую
    supplyChainEl = parent
    console.log('Parent уже является SupplyChainPartyDetails:', parentTagName)
  } else {
    // Ищем SupplyChainPartyDetails внутри parent
    // Пробуем найти через getElementsByTagName
    try {
      const elements = parent.getElementsByTagName('ccdo:SupplyChainPartyDetails')
      if (elements.length > 0) {
        supplyChainEl = elements[0]
        console.log('Найден SupplyChainPartyDetails через getElementsByTagName')
      }
    } catch (e) {
      console.log('Ошибка при поиске SupplyChainPartyDetails через getElementsByTagName:', e)
    }
    
    // Если не нашли, ищем по локальному имени
    if (!supplyChainEl) {
      const allElements = parent.getElementsByTagName('*')
      console.log('Ищем SupplyChainPartyDetails среди', allElements.length, 'элементов')
      
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i]
        const tagName = el.tagName
        const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
        
        if (i < 5) {
          console.log(`  Элемент ${i}: tagName=${tagName}, localName=${localName}`)
        }
        
        if (localName === 'supplychainpartydetails' || 
            tagName.toLowerCase().includes('supplychainpartydetails') ||
            tagName === 'ccdo:SupplyChainPartyDetails') {
          supplyChainEl = el
          console.log('Найден SupplyChainPartyDetails по локальному имени:', tagName)
          break
        }
      }
    }
  }

  if (!supplyChainEl) {
    console.log('SupplyChainPartyDetails не найден')
    return {
      country: '',
    }
  }

  return parseSupplyChainPartyDetails(supplyChainEl)
}

/**
 * Парсит детали участника цепи поставки из элемента
 */
function parseSupplyChainPartyDetails(supplyChainEl: Element): SupplyChainPartyDetails {
  const country = getTextContent(supplyChainEl, 'UnifiedCountryCode') || ''
  const businessEntityName = getTextContent(supplyChainEl, 'BusinessEntityName') || undefined
  // В XML может быть BusinessEntityBriefName
  const shortName = getTextContent(supplyChainEl, 'BusinessEntityBriefName') || 
                    getTextContent(supplyChainEl, 'BusinessEntityShortName') || undefined
  // BusinessEntityTypeCode может иметь атрибут codeListId (2049 — справочник организационно-правовых форм)
  const businessEntityTypeCode = getTextContent(supplyChainEl, 'BusinessEntityTypeCode') || undefined
  let businessEntityTypeCodeListId: string | undefined = undefined
  const businessEntityTypeCodeEl = Array.from(supplyChainEl.getElementsByTagName('*')).find((el) => {
    const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    return localName === 'businessentitytypecode'
  })
  if (businessEntityTypeCodeEl) {
    businessEntityTypeCodeListId = businessEntityTypeCodeEl.getAttribute('codeListId') ?? businessEntityTypeCodeEl.getAttributeNS(null, 'codeListId') ?? undefined
  }
  let organizationalForm = getTextContent(supplyChainEl, 'BusinessEntityTypeName') || undefined
  if (businessEntityTypeCode && businessEntityTypeCodeListId === '2049') {
    organizationalForm = undefined
  }
  const subjectIdentifier = getTextContent(supplyChainEl, 'BusinessEntityId') || undefined
  
  // Метод идентификации может быть в kindId атрибуте BusinessEntityId
  let identificationMethod = getTextContent(supplyChainEl, 'IdentificationMethodText') || undefined
  if (!identificationMethod) {
    // Пробуем найти BusinessEntityId элемент и получить kindId
    // Ищем с учетом пространств имен
    const namespaces = ['ccdo', 'csdo', 'smsdo', 'smcdo', 'doc']
    let businessEntityIdEl: Element | null = null
    
    for (const ns of namespaces) {
      try {
        const elements = supplyChainEl.getElementsByTagName(`${ns}:BusinessEntityId`)
        if (elements.length > 0) {
          businessEntityIdEl = elements[0]
          break
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    }
    
    // Если не нашли через namespace, ищем по локальному имени
    if (!businessEntityIdEl) {
      const allElements = supplyChainEl.getElementsByTagName('*')
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i]
        const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        if (localName === 'businessentityid') {
          businessEntityIdEl = el
          break
        }
      }
    }
    
    if (businessEntityIdEl) {
      const kindId = businessEntityIdEl.getAttribute('kindId')
      if (kindId) {
        // В реальном приложении здесь обращение к справочнику
        // Сохраняем код kindId, а не описание, чтобы можно было экспортировать обратно
        identificationMethod = kindId
        console.log('[parseSupplyChainPartyDetails] Найден identificationMethod (kindId):', kindId)
      }
    }
  }
  
  let customsNumber = getTextContent(supplyChainEl, 'UniqueCustomsNumberId') || getTextContent(supplyChainEl, 'CustomsNumber') || undefined
  if (!customsNumber) {
    const raw = getTextFromDirectChildByLocalName(supplyChainEl, 'UniqueCustomsNumberId')
    if (raw) customsNumber = raw
  }
  const taxpayerId = getTextContent(supplyChainEl, 'TaxpayerId') || undefined
  const taxRegistrationReasonCode = getTextContent(supplyChainEl, 'TaxRegistrationReasonCode') || undefined
  const supplyChainPartyKindCode = getTextContent(supplyChainEl, 'SupplyChainPartyKindCode') || undefined

  // Парсим все адреса (SubjectAddressDetails может быть несколько)
  const addresses = parseAllAddresses(supplyChainEl)
  const registrationAddress = addresses.find((a) => (a.addressKindCode || '').trim() === '1')
  const actualAddress = addresses.find((a) => (a.addressKindCode || '').trim() === '2')
  const mailingAddress = addresses.find((a) => (a.addressKindCode || '').trim() === '3')

  // Парсим контакты
  const contacts = parseContacts(supplyChainEl)

  return {
    country,
    businessEntityName,
    shortName,
    organizationalForm,
    businessEntityTypeCode,
    businessEntityTypeCodeListId,
    subjectIdentifier,
    identificationMethod,
    customsNumber,
    taxpayerId,
    taxRegistrationReasonCode,
    addresses: addresses.length > 0 ? addresses : undefined,
    registrationAddress,
    actualAddress,
    mailingAddress,
    contacts,
    supplyChainPartyKindCode,
  }
}

/**
 * Собирает все элементы SubjectAddressDetails в массив (порядок сохранён).
 */
function parseAllAddresses(parent: Element): AddressDetails[] {
  const result: AddressDetails[] = []
  try {
    const addressElements = parent.getElementsByTagName('ccdo:SubjectAddressDetails')
    for (let i = 0; i < addressElements.length; i++) {
      result.push(parseAddressDetails(addressElements[i]))
    }
  } catch {
    // ignore
  }
  if (result.length > 0) return result
  const allElements = parent.getElementsByTagName('*')
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i]
    const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (localName === 'subjectaddressdetails' || localName === 'objectaddressdetails') {
      result.push(parseAddressDetails(el))
    }
  }
  return result
}

/**
 * Парсит адрес по коду вида адреса (первый с таким кодом)
 */
function parseAddress(parent: Element, addressKindCode: string): AddressDetails | undefined {
  const all = parseAllAddresses(parent)
  return all.find((a) => (a.addressKindCode || '').trim() === addressKindCode)
}

/**
 * Читает текст дочернего элемента адреса (getTextContent + запасной вариант по прямому потомку)
 */
function getAddressChildText(el: Element, localName: string): string {
  return (
    getTextContent(el, localName) ||
    getTextFromDirectChildByLocalName(el, localName) ||
    ''
  ).trim()
}

/**
 * Парсит детали адреса из элемента
 */
function parseAddressDetails(addressEl: Element): AddressDetails {
  const country = getAddressChildText(addressEl, 'UnifiedCountryCode') || getAddressChildText(addressEl, 'CountryCode') || ''
  const territoryCode = getAddressChildText(addressEl, 'TerritoryCode') || ''
  const regionName = getAddressChildText(addressEl, 'RegionName') || ''
  const districtName = getAddressChildText(addressEl, 'DistrictName') || ''
  const cityName = getAddressChildText(addressEl, 'CityName') || ''
  const settlementName = getAddressChildText(addressEl, 'SettlementName') || ''
  const streetName = getAddressChildText(addressEl, 'StreetName') || ''
  const buildingNumberId = getAddressChildText(addressEl, 'BuildingNumberId') || ''
  const roomNumberId = getAddressChildText(addressEl, 'RoomNumberId') || ''
  const postOfficeBoxId = getAddressChildText(addressEl, 'PostOfficeBoxId') || ''
  const postCode = getAddressChildText(addressEl, 'PostCode') || ''
  const fullAddress = getAddressChildText(addressEl, 'FullAddress') || getTextContent(addressEl, 'FullAddress') || undefined
  const addressKindCode = getAddressChildText(addressEl, 'AddressKindCode') || getTextContent(addressEl, 'AddressKindCode') || undefined

  return {
    addressKindCode: addressKindCode || undefined,
    country: country || undefined,
    territoryCode: territoryCode || undefined,
    regionName: regionName || undefined,
    districtName: districtName || undefined,
    cityName: cityName || undefined,
    settlementName: settlementName || undefined,
    streetName: streetName || undefined,
    buildingNumberId: buildingNumberId || undefined,
    roomNumberId: roomNumberId || undefined,
    postOfficeBoxId: postOfficeBoxId || undefined,
    postCode: postCode || undefined,
    fullAddress: fullAddress || undefined,
  }
}

/**
 * Один блок ccdo:CommunicationDetails: по XSD — несколько прямых дочерних csdo:CommunicationChannelId;
 * старый XML мог содержать ContactValue / Communication (в форме — contactValue).
 */
function parseOneCommunicationDetails(el: Element): ContactDetails | null {
  const channelCode = getTextContent(el, 'CommunicationChannelCode') || undefined
  const channelName = getTextContent(el, 'CommunicationChannelName') || undefined
  const channelIds = getAllTextContents(el, 'CommunicationChannelId')
  const contactKind = getTextContent(el, 'ContactKind') || undefined
  const contactValueLegacy =
    (getTextContent(el, 'ContactValue') || getTextContent(el, 'Communication') || '').trim() || undefined

  let communicationChannelId: string | undefined
  let contactValue: string | undefined
  if (channelIds.length >= 2) {
    communicationChannelId = channelIds[0]
    contactValue = channelIds[1]
  } else if (channelIds.length === 1) {
    communicationChannelId = channelIds[0]
    contactValue = contactValueLegacy
  } else {
    communicationChannelId = undefined
    contactValue = contactValueLegacy
  }

  if (!channelCode && !channelName && !communicationChannelId && !contactKind && !contactValue) return null
  return {
    contactKind,
    contactValue,
    communicationChannelCode: channelCode,
    communicationChannelName: channelName,
    communicationChannelId,
  }
}

/**
 * Парсит контактные данные
 */
function parseContacts(parent: Element): ContactDetails[] {
  const contacts: ContactDetails[] = []
  
  // Пробуем найти через getElementsByTagName
  try {
    const commElements = parent.getElementsByTagName('ccdo:CommunicationDetails')
    console.log('[parseContacts] Найдено CommunicationDetails через getElementsByTagName:', commElements.length)
    for (let i = 0; i < commElements.length; i++) {
      const parsed = parseOneCommunicationDetails(commElements[i])
      if (parsed) contacts.push(parsed)
    }
  } catch (e) {
    console.log('Ошибка при поиске контактов через getElementsByTagName:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (contacts.length === 0) {
    const allElements = parent.getElementsByTagName('*')
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      
      if (localName === 'communicationdetails') {
        const parsed = parseOneCommunicationDetails(el)
        if (parsed) contacts.push(parsed)
      }
    }
  }
  
  console.log('Найдено контактов:', contacts.length)
  return contacts
}

/**
 * Парсит данные о партиях продукции (ТСД)
 */
function parseTSDData(alertDetails: Element, rootElement?: Element): TSDData | undefined {
  console.log('Начинаем парсинг ТСД данных')
  
  // Ищем NonCompliantSanitaryProductDetails
  let productDetailsElement: Element | null = null
  
  // Пробуем найти через getElementsByTagName
  try {
    const elements = alertDetails.getElementsByTagName('smcdo:NonCompliantSanitaryProductDetails')
    if (elements.length > 0) {
      productDetailsElement = elements[0]
      console.log('Найден NonCompliantSanitaryProductDetails для ТСД через getElementsByTagName')
    }
  } catch (e) {
    console.log('Ошибка при поиске NonCompliantSanitaryProductDetails:', e)
  }
  
  // Если не нашли, ищем по локальному имени в alertDetails
  if (!productDetailsElement) {
    const allElements = alertDetails.getElementsByTagName('*')
    console.log('Ищем NonCompliantSanitaryProductDetails среди', allElements.length, 'элементов в alertDetails')
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (i < 5) {
        console.log(`Элемент ${i}: tagName=${el.tagName}, localName=${localName}`)
      }
      
      if (localName === 'noncompliantsanitaryproductdetails') {
        productDetailsElement = el
        console.log('Найден NonCompliantSanitaryProductDetails для ТСД по локальному имени')
        break
      }
    }
  }
  
  // Если не нашли в alertDetails, пробуем в rootElement
  if (!productDetailsElement && rootElement) {
    console.log('Пробуем искать в rootElement')
    try {
      const elements = rootElement.getElementsByTagName('smcdo:NonCompliantSanitaryProductDetails')
      if (elements.length > 0) {
        productDetailsElement = elements[0]
        console.log('Найден NonCompliantSanitaryProductDetails для ТСД в rootElement')
      }
    } catch (e) {
      // Игнорируем
    }
    
    if (!productDetailsElement) {
      const allElements = rootElement.getElementsByTagName('*')
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i]
        const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        if (localName === 'noncompliantsanitaryproductdetails') {
          productDetailsElement = el
          console.log('Найден NonCompliantSanitaryProductDetails для ТСД в rootElement по локальному имени')
          break
        }
      }
    }
  }
  
  if (!productDetailsElement) {
    console.log('NonCompliantSanitaryProductDetails не найден для парсинга ТСД')
    // Попробуем искать партии напрямую в alertDetails
    console.log('Пробуем искать партии напрямую в alertDetails')
    return parseBatchesDirectly(alertDetails, rootElement)
  }
  
  console.log('Найден NonCompliantSanitaryProductDetails:', productDetailsElement.tagName)
  
  // Ищем все NonCompliantSanitaryProductBatchDetails
  const batches: ProductBatchDetails[] = []
  
  // Сначала пробуем через getElementsByTagName с namespace
  try {
    const batchElements = productDetailsElement.getElementsByTagName('smcdo:NonCompliantSanitaryProductBatchDetails')
    console.log('Найдено партий через getElementsByTagName:', batchElements.length)
    for (let i = 0; i < batchElements.length; i++) {
      const el = batchElements[i]
      console.log('Найдена партия через getElementsByTagName:', el.tagName)
      const batch = parseBatchDetails(el)
      if (batch) {
        console.log('Партия успешно распарсена:', batch)
        batches.push(batch)
      }
    }
  } catch (e) {
    console.log('Ошибка при поиске через getElementsByTagName:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (batches.length === 0) {
    const allElements = productDetailsElement.getElementsByTagName('*')
    console.log('Ищем партии среди', allElements.length, 'элементов')
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const tagName = el.tagName
      const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
      const tagNameLower = tagName.toLowerCase()
      
      if (i < 10) {
        console.log(`Элемент ${i}: tagName=${tagName}, localName=${localName}`)
      }
      
      // Проверяем разными способами
      const isBatchElement = 
        localName === 'noncompliantsanitaryproductbatchdetails' ||
        tagNameLower.includes('noncompliantsanitaryproductbatchdetails') ||
        tagName === 'smcdo:NonCompliantSanitaryProductBatchDetails' ||
        tagName.endsWith(':NonCompliantSanitaryProductBatchDetails')
      
      if (isBatchElement) {
        console.log('Найдена партия:', tagName)
        const batch = parseBatchDetails(el)
        if (batch) {
          console.log('Партия успешно распарсена:', batch)
          batches.push(batch)
        }
      }
    }
  }
  
  if (batches.length === 0) {
    console.log('Партии не найдены в productDetailsElement, пробуем искать напрямую')
    return parseBatchesDirectly(alertDetails, rootElement)
  }
  
  console.log('Найдено партий:', batches.length)
  return { batches }
}

/**
 * Парсит партии напрямую, без поиска NonCompliantSanitaryProductDetails
 */
function parseBatchesDirectly(alertDetails: Element, rootElement?: Element): TSDData | undefined {
  const batches: ProductBatchDetails[] = []
  const searchElements = rootElement ? [alertDetails, rootElement] : [alertDetails]
  
  for (const searchElement of searchElements) {
    // Сначала пробуем через getElementsByTagName с namespace
    try {
      const batchElements = searchElement.getElementsByTagName('smcdo:NonCompliantSanitaryProductBatchDetails')
      console.log('Найдено партий напрямую через getElementsByTagName:', batchElements.length)
      for (let i = 0; i < batchElements.length; i++) {
        const el = batchElements[i]
        console.log('Найдена партия напрямую через getElementsByTagName:', el.tagName)
        const batch = parseBatchDetails(el)
        if (batch) {
          console.log('Партия успешно распарсена:', batch)
          batches.push(batch)
        }
      }
    } catch (e) {
      console.log('Ошибка при поиске напрямую через getElementsByTagName:', e)
    }
    
    // Если не нашли, ищем по локальному имени
    if (batches.length === 0) {
      const allElements = searchElement.getElementsByTagName('*')
      console.log('Ищем партии напрямую среди', allElements.length, 'элементов')
      
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i]
        const tagName = el.tagName
        const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
        const tagNameLower = tagName.toLowerCase()
        
        // Проверяем разными способами
        const isBatchElement = 
          localName === 'noncompliantsanitaryproductbatchdetails' ||
          tagNameLower.includes('noncompliantsanitaryproductbatchdetails') ||
          tagName === 'smcdo:NonCompliantSanitaryProductBatchDetails' ||
          tagName.endsWith(':NonCompliantSanitaryProductBatchDetails')
        
        if (isBatchElement) {
          console.log('Найдена партия напрямую:', tagName)
          const batch = parseBatchDetails(el)
          if (batch) {
            console.log('Партия успешно распарсена:', batch)
            batches.push(batch)
          }
        }
      }
    }
  }
  
  if (batches.length === 0) {
    console.log('Партии не найдены')
    return undefined
  }
  
  console.log('Найдено партий напрямую:', batches.length)
  return { batches }
}

/**
 * Парсит детали партии продукции
 */
function parseBatchDetails(batchElement: Element): ProductBatchDetails | null {
  console.log('Парсим детали партии:', batchElement.tagName)
  
  // Дочерние элементы — используются для поиска BatchDetails и ShippingDocumentDetails по локальному имени (по XSD все опциональны)
  const children = batchElement.getElementsByTagName('*')
  
  // BatchDetails
  let batchDetailsEl: Element | null = null
  
  // Пробуем найти через getElementsByTagName
  try {
    const batchDetailsElements = batchElement.getElementsByTagName('smcdo:BatchDetails')
    if (batchDetailsElements.length > 0) {
      batchDetailsEl = batchDetailsElements[0]
      console.log('Найден BatchDetails через getElementsByTagName')
    }
  } catch (e) {
    console.log('Ошибка при поиске BatchDetails через getElementsByTagName:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (!batchDetailsEl) {
    console.log('Дочерние элементы партии:', children.length)
    
    for (let i = 0; i < children.length; i++) {
      const el = children[i]
      const tagName = el.tagName
      const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
      
      if (i < 10) {
        console.log(`  Элемент ${i}: tagName=${tagName}, localName=${localName}`)
      }
      
      if (localName === 'batchdetails' || 
          tagName.toLowerCase().includes('batchdetails') ||
          tagName === 'smcdo:BatchDetails') {
        batchDetailsEl = el
        console.log('Найден BatchDetails по локальному имени:', tagName)
        break
      }
    }
  }
  
  const batchId = batchDetailsEl ? getTextContent(batchDetailsEl, 'BatchId') : undefined
  const manufactureDate = batchDetailsEl ? getTextContent(batchDetailsEl, 'ManufactureDate') : undefined
  const productShelfLifeEndDate = batchDetailsEl ? getTextContent(batchDetailsEl, 'ProductShelfLifeEndDate') : undefined
  const note = batchDetailsEl ? getTextContent(batchDetailsEl, 'NoteText') : (getTextContent(batchElement, 'NoteText') || undefined)
  const consignmentId = getTextContent(batchElement, 'ConsignmentId') || undefined
  
  console.log('Извлеченные данные партии:', { batchId, manufactureDate, productShelfLifeEndDate, consignmentId })
  console.log('[parseBatchDetails] batchDetailsEl:', batchDetailsEl ? 'найден' : 'не найден')
  console.log('[parseBatchDetails] batchElement:', batchElement.tagName)
  
  // UnifiedCommodityMeasure
  const commodityMeasure = parseMeasure(batchDetailsEl, 'UnifiedCommodityMeasure')
  console.log('[parseBatchDetails] commodityMeasure:', commodityMeasure)
  
  // CommodityMeasure
  const batchCommodityMeasure = parseMeasure(batchElement, 'CommodityMeasure')
  console.log('[parseBatchDetails] batchCommodityMeasure:', batchCommodityMeasure)
  
  // ShippingDocumentDetails
  const shippingDocuments: ShippingDocument[] = []
  
  // Пробуем найти через getElementsByTagName
  try {
    const docElements = batchElement.getElementsByTagName('smcdo:ShippingDocumentDetails')
    console.log('Найдено документов через getElementsByTagName:', docElements.length)
    for (let i = 0; i < docElements.length; i++) {
      const el = docElements[i]
      console.log('Найден ShippingDocumentDetails через getElementsByTagName:', el.tagName)
      const doc: ShippingDocument = {
        docKindCode: getTextContent(el, 'DocKindCode') || undefined,
        docName: getTextContent(el, 'DocName') || undefined,
        docId: getTextContent(el, 'DocId') || undefined,
        docCreationDate: getTextContent(el, 'DocCreationDate') || undefined,
        products: parseProductsFromElement(el),
        supplyChainParties: parseSupplyChainPartiesFromElement(el),
      }
      console.log('Распарсен документ:', doc)
      shippingDocuments.push(doc)
    }
  } catch (e) {
    console.log('Ошибка при поиске документов через getElementsByTagName:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (shippingDocuments.length === 0) {
    for (let i = 0; i < children.length; i++) {
      const el = children[i]
      const tagName = el.tagName
      const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'shippingdocumentdetails' || 
          tagName.toLowerCase().includes('shippingdocumentdetails') ||
          tagName === 'smcdo:ShippingDocumentDetails') {
        console.log('Найден ShippingDocumentDetails по локальному имени:', tagName)
        const doc: ShippingDocument = {
          docKindCode: getTextContent(el, 'DocKindCode') || undefined,
          docName: getTextContent(el, 'DocName') || undefined,
          docId: getTextContent(el, 'DocId') || undefined,
          docCreationDate: getTextContent(el, 'DocCreationDate') || undefined,
          products: parseProductsFromElement(el),
          supplyChainParties: parseSupplyChainPartiesFromElement(el),
        }
        console.log('Распарсен документ:', doc)
        shippingDocuments.push(doc)
      }
    }
  }
  
  console.log('Найдено документов:', shippingDocuments.length)

  // Документы соответствия и нарушения в составе данного кортежа (smcdo:ConformityDocDetails, smcdo:RequirementViolationDetails внутри NonCompliantSanitaryProductBatchDetails)
  const complianceData = parseComplianceDocuments(batchElement)
  const violationsList = parseViolations(batchElement)
  
  const result: ProductBatchDetails = {
    batchId,
    manufactureDate,
    productShelfLifeEndDate,
    commodityMeasure,
    note,
    consignmentId,
    batchCommodityMeasure,
    shippingDocuments,
    ...(complianceData?.documents?.length ? { complianceDocuments: complianceData.documents } : {}),
    ...(violationsList?.length ? { violations: violationsList } : {}),
  }
  
  console.log('Результат парсинга партии:', result)
  return result
}

/**
 * Парсит продукцию из элемента (например, из ShippingDocumentDetails)
 */
function parseProductsFromElement(parent: Element): ProductDetails[] {
  const products: ProductDetails[] = []
  
  // Пробуем найти через getElementsByTagName
  try {
    const productElements = parent.getElementsByTagName('smcdo:ProductDetails')
    console.log('Найдено продуктов через getElementsByTagName:', productElements.length)
    for (let i = 0; i < productElements.length; i++) {
      const el = productElements[i]
      console.log('Найден ProductDetails в документе:', el.tagName)
      const tradeNamesArr = getAllTextContents(el, 'ProductTradeName')
      const product: ProductDetails = {
        productId: getTextContent(el, 'ProductId') || undefined,
        productName: getTextContent(el, 'ProductName') || undefined,
        tradeName: tradeNamesArr.length > 0 ? tradeNamesArr[0] : undefined,
        tradeNames: tradeNamesArr.length > 0 ? tradeNamesArr : undefined,
        description: getTextContent(el, 'DescriptionText') || undefined,
        commodityCode: getTextContent(el, 'CommodityCode') || undefined,
        productPurpose: getTextContent(el, 'ProductPurposeText') || undefined,
        applicationMethod: getTextContent(el, 'ProductApplicationMethodText') || undefined,
        releaseForm: getTextContent(el, 'ReleaseFormText') || undefined,
        storageCondition: getTextContent(el, 'StorageConditionText') || undefined,
        labelText: getTextContent(el, 'ProductLabelText') || undefined,
        technicalDocs: parseTechnicalDocs(el),
      }
      console.log('Распарсен продукт:', product)
      products.push(product)
    }
  } catch (e) {
    console.log('Ошибка при поиске продуктов через getElementsByTagName:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (products.length === 0) {
    const allElements = parent.getElementsByTagName('*')
    console.log('Ищем продукты среди', allElements.length, 'элементов')
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const tagName = el.tagName
      const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'productdetails' || 
          tagName.toLowerCase().includes('productdetails') ||
          tagName === 'smcdo:ProductDetails') {
        console.log('Найден ProductDetails по локальному имени:', tagName)
        const tradeNamesArr = getAllTextContents(el, 'ProductTradeName')
        const product: ProductDetails = {
          productId: getTextContent(el, 'ProductId') || undefined,
          productName: getTextContent(el, 'ProductName') || undefined,
          tradeName: tradeNamesArr.length > 0 ? tradeNamesArr[0] : undefined,
          tradeNames: tradeNamesArr.length > 0 ? tradeNamesArr : undefined,
          description: getTextContent(el, 'DescriptionText') || undefined,
          commodityCode: getTextContent(el, 'CommodityCode') || undefined,
          productPurpose: getTextContent(el, 'ProductPurposeText') || undefined,
          applicationMethod: getTextContent(el, 'ProductApplicationMethodText') || undefined,
          releaseForm: getTextContent(el, 'ReleaseFormText') || undefined,
          storageCondition: getTextContent(el, 'StorageConditionText') || undefined,
          labelText: getTextContent(el, 'ProductLabelText') || undefined,
          technicalDocs: parseTechnicalDocs(el),
        }
        console.log('Распарсен продукт:', product)
        products.push(product)
      }
    }
  }
  
  console.log('Всего найдено продуктов:', products.length)
  return products
}

/**
 * Парсит участников цепи поставки из элемента (например, из ShippingDocumentDetails)
 */
function parseSupplyChainPartiesFromElement(parent: Element): SupplyChainPartyDetails[] {
  const parties: SupplyChainPartyDetails[] = []
  
  console.log('Парсим участников из элемента:', parent.tagName)
  
  // Пробуем найти через getElementsByTagName
  try {
    const partyElements = parent.getElementsByTagName('ccdo:SupplyChainPartyDetails')
    console.log('Найдено участников через getElementsByTagName (ccdo:SupplyChainPartyDetails):', partyElements.length)
    
    // Также пробуем без namespace
    const partyElementsNoNS = parent.getElementsByTagName('SupplyChainPartyDetails')
    console.log('Найдено участников через getElementsByTagName (SupplyChainPartyDetails):', partyElementsNoNS.length)
    
    // Объединяем результаты
    const allPartyElements: Element[] = []
    for (let i = 0; i < partyElements.length; i++) {
      allPartyElements.push(partyElements[i])
    }
    for (let i = 0; i < partyElementsNoNS.length; i++) {
      if (!allPartyElements.includes(partyElementsNoNS[i])) {
        allPartyElements.push(partyElementsNoNS[i])
      }
    }
    
    console.log('Всего уникальных элементов участников:', allPartyElements.length)
    
    for (let i = 0; i < allPartyElements.length; i++) {
      const el = allPartyElements[i]
      console.log(`Найден SupplyChainPartyDetails ${i + 1} в документе:`, el.tagName, 'parent:', el.parentElement?.tagName)
      console.log('Содержимое элемента (первые 200 символов):', el.textContent?.substring(0, 200))
      console.log('Количество дочерних элементов:', el.children.length)
      const party = parseSupplyChainParty(el)
      console.log('Распарсен участник:', party)
      console.log('Проверка полей участника:', {
        hasCountry: !!party.country,
        hasBusinessEntityName: !!party.businessEntityName,
        hasSupplyChainPartyKindCode: !!party.supplyChainPartyKindCode,
      })
      parties.push(party)
    }
  } catch (e) {
    console.log('Ошибка при поиске участников через getElementsByTagName:', e)
  }
  
  // Если не нашли, ищем по локальному имени во всех элементах
  if (parties.length === 0) {
    const allElements = parent.getElementsByTagName('*')
    console.log('Ищем участников среди', allElements.length, 'элементов')
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const tagName = el.tagName
      const localName = el.localName || tagName.split(':').pop()?.toLowerCase()
      
      // Проверяем, что это прямой потомок или вложенный элемент документа
      const isDirectChild = el.parentElement === parent
      const isInDocument = parent.contains(el)
      
      if (i < 10) {
        console.log(`  Элемент ${i}: tagName=${tagName}, localName=${localName}, isDirectChild=${isDirectChild}, isInDocument=${isInDocument}`)
      }
      
      if ((localName === 'supplychainpartydetails' || 
          tagName.toLowerCase().includes('supplychainpartydetails') ||
          tagName === 'ccdo:SupplyChainPartyDetails') && isInDocument) {
        console.log('Найден SupplyChainPartyDetails по локальному имени:', tagName, 'parent:', el.parentElement?.tagName)
        const party = parseSupplyChainParty(el)
        console.log('Распарсен участник:', party)
        parties.push(party)
      }
    }
  }
  
  console.log('Всего найдено участников:', parties.length)
  if (parties.length > 0) {
    parties.forEach((party, index) => {
      console.log(`Участник ${index + 1}:`, {
        country: party.country,
        businessEntityName: party.businessEntityName,
        supplyChainPartyKindCode: party.supplyChainPartyKindCode,
      })
    })
  }
  
  return parties
}

/**
 * Парсит меру с единицей измерения
 */
function parseMeasure(parent: Element | null, tagName: string): MeasureWithUnit | undefined {
  if (!parent) {
    console.log(`[parseMeasure] parent is null for tagName: ${tagName}`)
    return undefined
  }
  
  // Сначала пробуем найти через namespace (csdo: для CommodityMeasure и UnifiedCommodityMeasure)
  let measureEl: Element | null = null
  try {
    const namespaceTagName = `csdo:${tagName}`
    const elements = parent.getElementsByTagName(namespaceTagName)
    if (elements.length > 0) {
      measureEl = elements[0]
      console.log(`[parseMeasure] Найден ${tagName} через namespace: ${namespaceTagName}`)
    }
  } catch (e) {
    console.log(`[parseMeasure] Ошибка при поиске через namespace для ${tagName}:`, e)
  }
  
  // Если не нашли через namespace, ищем по локальному имени
  if (!measureEl) {
    const allElements = parent.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === tagName.toLowerCase()) {
        // Проверяем, что это прямой потомок или вложенный элемент
        if (el.parentElement === parent || parent.contains(el)) {
          measureEl = el
          console.log(`[parseMeasure] Найден ${tagName} по локальному имени: ${el.tagName}`)
          break
        }
      }
    }
  }
  
  if (!measureEl) {
    console.log(`[parseMeasure] ${tagName} не найден в parent: ${parent.tagName}`)
    return undefined
  }
  
  const value = measureEl.textContent?.trim() || ''
  if (!value) {
    console.log(`[parseMeasure] ${tagName} найден, но значение пустое`)
    return undefined
  }
  
  const unitCode = measureEl.getAttribute('measurementUnitCode') || undefined
  const unitCodeListId = measureEl.getAttribute('measurementUnitCodeListId') || undefined
  
  console.log(`[parseMeasure] ${tagName}: value=${value}, unitCode=${unitCode}, unitCodeListId=${unitCodeListId}`)
  
  // В реальном приложении здесь обращение к справочнику единиц измерения
  const unitNameMap: Record<string, string> = {
    '130': 'л.',
    '796': 'шт.',
    '163': 'кг',
  }
  
  return {
    value,
    unitCode,
    unitCodeListId,
    // Не подставлять unitCode в unitName: в measurementUnitCode должен быть только код (например 212), наименование — только из справочника
    unitName: unitCode ? (unitNameMap[unitCode] ?? undefined) : undefined,
  }
}

/**
 * Объединяет документы соответствия из всех партий (для валидации и т.п.).
 */
export function mergeComplianceDocumentsFromBatches(tsdData: TSDData | undefined): ComplianceDocumentsData | undefined {
  const documents = tsdData?.batches?.flatMap((b) => b.complianceDocuments ?? []) ?? []
  if (documents.length === 0) return undefined
  return { documents }
}

/**
 * Объединяет нарушения из всех партий (для валидации и т.п.).
 */
export function mergeViolationsFromBatches(tsdData: TSDData | undefined): ViolationsData | undefined {
  const batches = tsdData?.batches ?? []
  const allReqs: ViolatedRequirement[] = []
  const allInds: ViolatedIndicator[] = []
  let generalDescription: string | undefined
  for (const b of batches) {
    const list = Array.isArray(b.violations) ? b.violations : (b.violations ? [b.violations as ViolationsData] : [])
    for (const v of list) {
      if (v.violatedRequirements?.length) allReqs.push(...v.violatedRequirements)
      if (v.violatedIndicators?.length) allInds.push(...v.violatedIndicators)
      if (v.generalDescription && !generalDescription) generalDescription = v.generalDescription
    }
  }
  if (allReqs.length === 0 && allInds.length === 0 && !generalDescription) return undefined
  return { generalDescription, violatedRequirements: allReqs, violatedIndicators: allInds }
}

/**
 * Парсит документы соответствия
 */
function parseComplianceDocuments(alertDetails: Element, rootElement?: Element): ComplianceDocumentsData | undefined {
  console.log('Начинаем парсинг документов соответствия')
  
  const documents: ComplianceDocument[] = []
  
  // Используем Set для отслеживания уже обработанных элементов, чтобы избежать дублирования
  const processedElements = new Set<Element>()
  
  // Ищем только в alertDetails, так как rootElement может содержать весь документ и дублировать элементы
  const searchElement = alertDetails
  
  // Пробуем найти через getElementsByTagName
  try {
    const docElements = searchElement.getElementsByTagName('smcdo:ConformityDocDetails')
    console.log('Найдено документов соответствия через getElementsByTagName:', docElements.length)
    
    for (let i = 0; i < docElements.length; i++) {
      const el = docElements[i]
      
      // Пропускаем уже обработанные элементы
      if (processedElements.has(el)) {
        console.log('[parseComplianceDocuments] Пропускаем уже обработанный элемент')
        continue
      }
      processedElements.add(el)
      
      const doc = parseComplianceDocument(el)
      if (doc) {
        documents.push(doc)
      }
    }
  } catch (e) {
    console.log('Ошибка при поиске документов соответствия:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (documents.length === 0) {
    const allElements = searchElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      
      // Пропускаем уже обработанные элементы
      if (processedElements.has(el)) {
        continue
      }
      
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'conformitydocdetails') {
        processedElements.add(el)
        const doc = parseComplianceDocument(el)
        if (doc) {
          documents.push(doc)
        }
      }
    }
  }
  
  if (documents.length === 0) {
    console.log('Документы соответствия не найдены')
    return undefined
  }
  
  console.log('Найдено документов соответствия:', documents.length)
  return { documents }
}

/**
 * Парсит один документ соответствия
 */
function parseComplianceDocument(docElement: Element): ComplianceDocument | null {
  const docKindCode = getTextContent(docElement, 'DocKindCode') || undefined
  const docName = getTextContent(docElement, 'DocName') || undefined
  const docId = getTextContent(docElement, 'DocId') || undefined
  const docCreationDate = getTextContent(docElement, 'DocCreationDate') || undefined
  const docStartDate = getTextContent(docElement, 'DocStartDate') || undefined
  
  // RegistrationCertificateId для запроса протоколов (если вид документа = 25)
  const registrationCertificateId = docKindCode === '25' ? docId : undefined
  
  // UnifiedAuthorityDetails
  let authority: UnifiedAuthorityDetails | undefined = undefined
  try {
    const authorityEl = docElement.getElementsByTagName('ccdo:UnifiedAuthorityDetails')[0]
    if (authorityEl) {
      // csdo:AuthorityId в документе соответствия в карточку не переносим (в XML не экспортируется)
      authority = {
        country: getTextContent(authorityEl, 'UnifiedCountryCode') || undefined,
        authorityName: getTextContent(authorityEl, 'AuthorityName') || undefined,
        authorityBriefName: getTextContent(authorityEl, 'AuthorityBriefName') || undefined,
      }
    }
  } catch (e) {
    // Игнорируем ошибку
  }
  
  // Если не нашли через getElementsByTagName, ищем по локальному имени
  if (!authority) {
    const allElements = docElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'unifiedauthoritydetails') {
        authority = {
          country: getTextContent(el, 'UnifiedCountryCode') || undefined,
          authorityName: getTextContent(el, 'AuthorityName') || undefined,
          authorityBriefName: getTextContent(el, 'AuthorityBriefName') || undefined,
        }
        break
      }
    }
  }
  
  // В реальном приложении здесь нужно получить docKindName из справочника по docKindCode
  const docKindNameMap: Record<string, string> = {
    '10': 'Декларация о соответствии ЕАЭС',
    '25': 'Свидетельство о государственной регистрации',
  }
  const docKindName = docKindCode ? (docKindNameMap[docKindCode] || `Вид документа (код: ${docKindCode})`) : undefined
  
  return {
    docKindCode,
    docKindName,
    docName,
    docId,
    docCreationDate,
    docStartDate,
    authority,
    registrationCertificateId,
  }
}

/**
 * Парсит один элемент RequirementViolationDetails в одно ViolationsData.
 */
function parseOneRequirementViolationDetails(el: Element): ViolationsData {
  // По XSD: csdo:DescriptionText на уровне RequirementViolationDetails — прямой потомок, после требований и показателей
  const descs: string[] = []
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i] as Element
    const localName = (child.localName || child.tagName.split(':').pop() || '').toLowerCase()
    if (localName === 'descriptiontext') {
      const text = child.textContent?.trim()
      if (text) descs.push(text)
    }
  }
  const generalDescription = descs.length > 0 ? descs.join(' ') : undefined

  const requirementsDocs = parseRequirementsDocDetails(el)

  const violatedIndicators = parseViolatedIndicators(el)
  return {
    generalDescription,
    violatedRequirements: requirementsDocs,
    violatedIndicators,
  }
}

/**
 * Парсит нарушения: возвращает массив — по одному ViolationsData на каждый smcdo:RequirementViolationDetails.
 */
function parseViolations(alertDetails: Element, _rootElement?: Element): ViolationsData[] | undefined {
  const result: ViolationsData[] = []
  const processedElements = new Set<Element>()
  const searchElement = alertDetails

  try {
    const violationElements = searchElement.getElementsByTagName('smcdo:RequirementViolationDetails')
    for (let i = 0; i < violationElements.length; i++) {
      const el = violationElements[i]
      if (processedElements.has(el)) continue
      processedElements.add(el)
      const one = parseOneRequirementViolationDetails(el)
      if ((one.violatedRequirements?.length ?? 0) > 0 || (one.violatedIndicators?.length ?? 0) > 0 || !!one.generalDescription) {
        result.push(one)
      }
    }
  } catch (e) {
    console.log('Ошибка при поиске нарушений:', e)
  }

  if (result.length === 0) {
    const allElements = searchElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      if (processedElements.has(el)) continue
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'requirementviolationdetails') {
        processedElements.add(el)
        const one = parseOneRequirementViolationDetails(el)
        if ((one.violatedRequirements?.length ?? 0) > 0 || (one.violatedIndicators?.length ?? 0) > 0 || !!one.generalDescription) {
          result.push(one)
        }
      }
    }
  }

  if (result.length === 0) return undefined
  return result
}

/**
 * Парсит RequirementsDocDetails
 */
function parseRequirementsDocDetails(violationElement: Element): ViolatedRequirement[] {
  const requirements: ViolatedRequirement[] = []
  
  // Пробуем найти через getElementsByTagName
  try {
    const docElements = violationElement.getElementsByTagName('smcdo:RequirementsDocDetails')
    console.log('Найдено RequirementsDocDetails:', docElements.length)
    
    for (let i = 0; i < docElements.length; i++) {
      const el = docElements[i]
      const requirement = parseRequirementDoc(el)
      if (requirement) {
        requirements.push(requirement)
      }
    }
  } catch (e) {
    console.log('Ошибка при поиске RequirementsDocDetails:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (requirements.length === 0) {
    const allElements = violationElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'requirementsdocdetails') {
        const requirement = parseRequirementDoc(el)
        if (requirement) {
          requirements.push(requirement)
        }
      }
    }
  }
  
  return requirements
}

/**
 * Парсит один RequirementsDocDetails
 */
function parseRequirementDoc(docElement: Element): ViolatedRequirement | null {
  const technicalRegulationId = getTextContent(docElement, 'TechnicalRegulationId') || undefined
  const technicalRegulationName = getTextContent(docElement, 'DocName') || undefined
  const registrationNumber = getTextContent(docElement, 'DocId') || undefined
  const description = getTextContent(docElement, 'DescriptionText') || undefined
  
  // DocStructuralElementDetails (может быть несколько)
  const structuralElements: DocStructuralElement[] = []
  try {
    const structElements = docElement.getElementsByTagName('smcdo:DocStructuralElementDetails')
    for (let i = 0; i < structElements.length; i++) {
      const el = structElements[i]
      structuralElements.push({
        elementName: getTextContent(el, 'DocStructuralElementName') || undefined,
        elementId: getTextContent(el, 'DocStructuralElementId') || undefined,
      })
    }
  } catch (e) {
    // Игнорируем ошибку
  }
  
  // Если не нашли через getElementsByTagName, ищем по локальному имени
  if (structuralElements.length === 0) {
    const allElements = docElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'docstructuralelementdetails') {
        structuralElements.push({
          elementName: getTextContent(el, 'DocStructuralElementName') || undefined,
          elementId: getTextContent(el, 'DocStructuralElementId') || undefined,
        })
      }
    }
  }
  
  // DocReferenceDetails (утверждающий документ)
  let approvingDocument: ViolatedRequirement['approvingDocument'] | undefined = undefined
  try {
    const refElements = docElement.getElementsByTagName('ccdo:DocReferenceDetails')
    if (refElements.length > 0) {
      const refEl = refElements[0]
      approvingDocument = {
        docName: getTextContent(refEl, 'DocName') || undefined,
        docId: getTextContent(refEl, 'DocId') || undefined,
        docCreationDate: getTextContent(refEl, 'DocCreationDate') || undefined,
        docStartDate: getTextContent(refEl, 'DocStartDate') || undefined,
      }
    }
  } catch (e) {
    // Игнорируем ошибку
  }
  
  // Если не нашли через getElementsByTagName, ищем по локальному имени
  if (!approvingDocument) {
    const allElements = docElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'docreferencedetails') {
        approvingDocument = {
          docName: getTextContent(el, 'DocName') || undefined,
          docId: getTextContent(el, 'DocId') || undefined,
          docCreationDate: getTextContent(el, 'DocCreationDate') || undefined,
          docStartDate: getTextContent(el, 'DocStartDate') || undefined,
        }
        break
      }
    }
  }
  
  if (!technicalRegulationId && !technicalRegulationName && !description) {
    return null
  }
  
  return {
    technicalRegulationId,
    technicalRegulationName,
    registrationNumber,
    structuralElements: structuralElements.length > 0 ? structuralElements : undefined,
    approvingDocument,
    description,
  }
}

/**
 * Парсит нарушенные показатели (DiscrepancyOfQualityIndexDetails)
 */
function parseViolatedIndicators(violationElement: Element): ViolatedIndicator[] {
  const indicators: ViolatedIndicator[] = []
  
  // Пробуем найти через getElementsByTagName
  try {
    const indicatorElements = violationElement.getElementsByTagName('smcdo:DiscrepancyOfQualityIndexDetails')
    console.log('Найдено нарушенных показателей:', indicatorElements.length)
    
    for (let i = 0; i < indicatorElements.length; i++) {
      const el = indicatorElements[i]
      const indicator = parseViolatedIndicator(el)
      if (indicator) {
        indicators.push(indicator)
      }
    }
  } catch (e) {
    console.log('Ошибка при поиске нарушенных показателей:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (indicators.length === 0) {
    const allElements = violationElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'discrepancyofqualityindexdetails') {
        const indicator = parseViolatedIndicator(el)
        if (indicator) {
          indicators.push(indicator)
        }
      }
    }
  }
  
  return indicators
}

/**
 * Парсит один нарушенный показатель
 */
function parseViolatedIndicator(indicatorElement: Element): ViolatedIndicator | null {
  // normativeDiscrepancyOfQualityIndexIndicator (атрибут)
  const normativeAttr = indicatorElement.getAttribute('normativeDiscrepancyOfQualityIndexIndicator')
  const isNormative = normativeAttr === '1' || normativeAttr === 'true'
  
  const indicatorCode = getTextContent(indicatorElement, 'DiscrepancyOfQualityIndexCode') || undefined
  const indicatorName = getTextContent(indicatorElement, 'DiscrepancyOfQualityIndexName') || undefined
  const indicatorValue = getTextContent(indicatorElement, 'DiscrepancyOfQualityIndexValue') || undefined
  const note = getTextContent(indicatorElement, 'NoteText') || undefined
  
  // Единица измерения: элемент csdo:UnifiedMeasurementUnitCode (codeListId="2064") или атрибуты у DiscrepancyOfQualityIndexValue (старый формат)
  let unitCode: string | undefined = undefined
  let unitCodeListId: string | undefined = undefined
  const unitEl = indicatorElement.querySelector('UnifiedMeasurementUnitCode') ||
    Array.from(indicatorElement.getElementsByTagName('*')).find(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return localName === 'unifiedmeasurementunitcode'
    })
  if (unitEl) {
    unitCode = (unitEl.textContent ?? '').trim() || undefined
    unitCodeListId = unitEl.getAttribute('codeListId') || undefined
  }
  if (!unitCode) {
    const valueElement = indicatorElement.querySelector('DiscrepancyOfQualityIndexValue') ||
      Array.from(indicatorElement.getElementsByTagName('*')).find(el => {
        const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        return localName === 'discrepancyofqualityindexvalue'
      })
    if (valueElement) {
      unitCode = valueElement.getAttribute('measurementUnitCode') || undefined
      unitCodeListId = valueElement.getAttribute('measurementUnitCodeListId') || undefined
    }
  }
  
  // В реальном приложении здесь обращение к справочнику единиц измерения
  const unitNameMap: Record<string, string> = {
    '130': 'л.',
    '796': 'шт.',
    '163': 'кг',
    'C62': 'мг/кг',
    'M1': '%',
  }
  const unitName = unitCode ? (unitNameMap[unitCode] ?? undefined) : undefined
  
  if (!indicatorCode && !indicatorName && !indicatorValue) {
    return null
  }
  
  return {
    isNormative,
    indicatorCode,
    indicatorName,
    indicatorValue,
    unitCode,
    unitCodeListId,
    unitName,
    note,
  }
}

/**
 * Парсит место обнаружения
 */
function parseDetectionPlace(alertDetails: Element, rootElement?: Element): DetectionPlaceData | undefined {
  console.log('Начинаем парсинг места обнаружения')
  
  const searchElements = rootElement ? [alertDetails, rootElement] : [alertDetails]
  
  for (const searchElement of searchElements) {
    // Пробуем найти через getElementsByTagName
    try {
      const placeElements = searchElement.getElementsByTagName('smcdo:DetectionPlaceDetails')
      console.log('Найдено мест обнаружения через getElementsByTagName:', placeElements.length)
      
      if (placeElements.length > 0) {
        const el = placeElements[0] // Берем первое место обнаружения
        return parseDetectionPlaceDetails(el)
      }
    } catch (e) {
      console.log('Ошибка при поиске места обнаружения:', e)
    }
    
    // Если не нашли, ищем по локальному имени
    const allElements = searchElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'detectionplacedetails') {
        console.log('Найдено место обнаружения по локальному имени')
        return parseDetectionPlaceDetails(el)
      }
    }
  }
  
  console.log('Место обнаружения не найдено')
  return undefined
}

/**
 * Парсит детали места обнаружения (smcdo:DetectionPlaceDetails / LocationDetailsType).
 * Экспортируется для использования в PHA-парсере.
 */
export function parseDetectionPlaceDetails(placeElement: Element): DetectionPlaceData {
  // OrganizationDetails (может быть UnifiedAuthorityDetails или BusinessEntityDetailsType)
  const organization = parseOrganizationDetails(placeElement)
  
  // BorderCheckpointDetails
  const borderCheckpoint = parseBorderCheckpoint(placeElement)
  
  // ObjectAddressDetails
  const address = parseObjectAddress(placeElement)
  
  // GeoCoordinateDetails
  const geoCoordinates = parseGeoCoordinates(placeElement)
  
  // DescriptionText
  const description = getTextContent(placeElement, 'DescriptionText') || undefined
  
  return {
    organization,
    borderCheckpoint,
    address,
    geoCoordinates,
    description,
  }
}

/**
 * Парсит OrganizationDetails (может быть UnifiedAuthorityDetails или BusinessEntityDetailsType)
 */
function parseOrganizationDetails(placeElement: Element): BusinessEntityDetails | undefined {
  let orgElement: Element | null = null
  
  // Пробуем найти через getElementsByTagName
  try {
    const elements = placeElement.getElementsByTagName('smcdo:OrganizationDetails')
    if (elements.length > 0) {
      orgElement = elements[0]
    }
  } catch (e) {
    // Игнорируем
  }
  
  // Если не нашли, ищем по локальному имени
  if (!orgElement) {
    const allElements = placeElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'organizationdetails') {
        orgElement = el
        break
      }
    }
  }
  
  if (!orgElement) {
    return undefined
  }
  
  const country = getDirectChildTextByLocalName(orgElement, 'UnifiedCountryCode') || undefined
  const businessEntityName = getTextContent(orgElement, 'BusinessEntityName') || undefined
  const businessEntityBriefName = getTextContent(orgElement, 'BusinessEntityBriefName') || undefined
  let businessEntityTypeCode: string | undefined
  let businessEntityTypeCodeListId: string | undefined
  const businessEntityTypeCodeElOrg = Array.from(orgElement.getElementsByTagName('*')).find((el) => {
    const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    return localName === 'businessentitytypecode'
  })
  if (businessEntityTypeCodeElOrg) {
    businessEntityTypeCode = businessEntityTypeCodeElOrg.textContent?.trim() || undefined
    businessEntityTypeCodeListId =
      businessEntityTypeCodeElOrg.getAttribute('codeListId') ?? businessEntityTypeCodeElOrg.getAttributeNS(null, 'codeListId') ?? undefined
  }
  let businessEntityTypeName = getTextContent(orgElement, 'BusinessEntityTypeName') || undefined
  if (businessEntityTypeCode && businessEntityTypeCodeListId === '2049') {
    businessEntityTypeName = undefined
  }
  const customsNumber = getTextContent(orgElement, 'UniqueCustomsNumberId') || getTextContent(orgElement, 'CustomsNumber') || undefined
  const taxRegistrationReasonCode = getTextContent(orgElement, 'TaxRegistrationReasonCode') || undefined
  const taxpayerId = getTextContent(orgElement, 'TaxpayerId') || undefined
  
  // BusinessEntityId с методом идентификации
  let businessEntityId: string | undefined = undefined
  let identificationMethod: string | undefined = undefined
  
  // Ищем BusinessEntityId с учетом пространств имен
  const namespaces = ['ccdo', 'csdo', 'smsdo', 'smcdo', 'doc']
  let businessEntityIdEl: Element | null = null
  
  for (const ns of namespaces) {
    try {
      const elements = orgElement.getElementsByTagName(`${ns}:BusinessEntityId`)
      if (elements.length > 0) {
        businessEntityIdEl = elements[0]
        break
      }
    } catch (e) {
      // Игнорируем ошибки
    }
  }
  
  // Если не нашли через namespace, ищем по локальному имени
  if (!businessEntityIdEl) {
    const allElements = orgElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'businessentityid') {
        businessEntityIdEl = el
        break
      }
    }
  }
  
  if (businessEntityIdEl) {
    businessEntityId = businessEntityIdEl.textContent?.trim() || undefined
    const kindId = businessEntityIdEl.getAttribute('kindId')
    if (kindId) {
      // Сохраняем код kindId, а не описание, чтобы можно было экспортировать обратно
      identificationMethod = kindId
      console.log('[parseOrganizationDetails] Найден identificationMethod (kindId):', kindId)
    }
  }
  
  // Адреса (SubjectAddressDetails - может быть несколько)
  const addresses: AddressDetails[] = []
  try {
    const addressElements = orgElement.getElementsByTagName('ccdo:SubjectAddressDetails')
    for (let i = 0; i < addressElements.length; i++) {
      const addr = parseAddressDetails(addressElements[i])
      if (addr.fullAddress || addr.country) {
        addresses.push(addr)
      }
    }
  } catch (e) {
    // Игнорируем
  }
  
  // Если не нашли через getElementsByTagName, ищем по локальному имени
  if (addresses.length === 0) {
    const allElements = orgElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'subjectaddressdetails') {
        const addr = parseAddressDetails(el)
        if (addr.fullAddress || addr.country) {
          addresses.push(addr)
        }
      }
    }
  }
  
  // Контакты (CommunicationDetails)
  const contacts = parseContacts(orgElement)
  
  const hasOrgContent =
    !!country?.trim() ||
    !!businessEntityName?.trim() ||
    !!businessEntityBriefName?.trim() ||
    !!businessEntityTypeCode?.trim() ||
    !!businessEntityTypeName?.trim() ||
    !!businessEntityId?.trim() ||
    !!identificationMethod?.trim() ||
    !!customsNumber?.trim() ||
    !!taxRegistrationReasonCode?.trim() ||
    !!taxpayerId?.trim() ||
    addresses.length > 0 ||
    contacts.length > 0
  if (!hasOrgContent) {
    return undefined
  }
  
  return {
    country,
    businessEntityName,
    businessEntityBriefName,
    businessEntityTypeCode,
    businessEntityTypeCodeListId,
    businessEntityTypeName,
    businessEntityId,
    identificationMethod,
    customsNumber,
    taxRegistrationReasonCode,
    taxpayerId,
    addresses: addresses.length > 0 ? addresses : undefined,
    contacts: contacts.length > 0 ? contacts : undefined,
  }
}

/**
 * Парсит BorderCheckpointDetails
 */
function parseBorderCheckpoint(placeElement: Element): BorderCheckpointDetails | undefined {
  let checkpointElement: Element | null = null
  
  console.log('Ищем BorderCheckpointDetails в:', placeElement.tagName)
  
  // Пробуем найти через getElementsByTagName
  try {
    const elements = placeElement.getElementsByTagName('smcdo:BorderCheckpointDetails')
    console.log('Найдено BorderCheckpointDetails через getElementsByTagName:', elements.length)
    if (elements.length > 0) {
      checkpointElement = elements[0]
    }
  } catch (e) {
    console.log('Ошибка при поиске BorderCheckpointDetails:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (!checkpointElement) {
    const allElements = placeElement.getElementsByTagName('*')
    console.log('Ищем BorderCheckpointDetails среди', allElements.length, 'элементов')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'bordercheckpointdetails') {
        console.log('Найден BorderCheckpointDetails по локальному имени:', el.tagName)
        checkpointElement = el
        break
      }
    }
  }
  
  if (!checkpointElement) {
    console.log('BorderCheckpointDetails не найден')
    return undefined
  }
  
  const checkpointCode = getTextContent(checkpointElement, 'BorderCheckpointCode') || undefined
  const checkpointName = getTextContent(checkpointElement, 'BorderCheckpointName') || undefined
  
  console.log('Распарсен BorderCheckpointDetails:', { checkpointCode, checkpointName })
  
  if (!checkpointCode && !checkpointName) {
    return undefined
  }
  
  return {
    checkpointCode,
    checkpointName,
  }
}

/**
 * Парсит ObjectAddressDetails
 */
function parseObjectAddress(placeElement: Element): AddressDetails | undefined {
  let addressElement: Element | null = null
  
  console.log('Ищем ObjectAddressDetails в:', placeElement.tagName)
  
  // Пробуем найти через getElementsByTagName
  try {
    const elements = placeElement.getElementsByTagName('ccdo:ObjectAddressDetails')
    console.log('Найдено ObjectAddressDetails через getElementsByTagName:', elements.length)
    if (elements.length > 0) {
      addressElement = elements[0]
    }
  } catch (e) {
    console.log('Ошибка при поиске ObjectAddressDetails:', e)
  }
  
  // Если не нашли, ищем по локальному имени (регистр может отличаться в XML DOM)
  if (!addressElement) {
    const allElements = placeElement.getElementsByTagName('*')
    console.log('Ищем ObjectAddressDetails среди', allElements.length, 'элементов')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      if (localName === 'objectaddressdetails') {
        console.log('Найден ObjectAddressDetails по локальному имени:', el.tagName)
        addressElement = el
        break
      }
    }
  }
  
  if (!addressElement) {
    console.log('ObjectAddressDetails не найден')
    return undefined
  }
  
  const address = parseAddressDetails(addressElement)
  console.log('Распарсен ObjectAddressDetails:', address)
  return address
}

/**
 * Парсит все GeoCoordinateDetails в массив (может быть несколько координат).
 */
function parseGeoCoordinates(placeElement: Element): GeoCoordinateDetails[] {
  const result: GeoCoordinateDetails[] = []
  let elements: HTMLCollectionOf<Element> | Element[] = []

  try {
    elements = placeElement.getElementsByTagName('ccdo:GeoCoordinateDetails')
  } catch (e) {
    // ignore
  }

  if (elements.length === 0) {
    const allElements = placeElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      if (localName === 'geocoordinatedetails') {
        const longitude = getTextContent(el, 'LongitudeMeasure') || undefined
        const latitude = getTextContent(el, 'LatitudeMeasure') || undefined
        if (longitude || latitude) result.push({ longitude, latitude })
      }
    }
    return result
  }

  for (let i = 0; i < elements.length; i++) {
    const geoElement = elements[i]
    const longitude = getTextContent(geoElement, 'LongitudeMeasure') || undefined
    const latitude = getTextContent(geoElement, 'LatitudeMeasure') || undefined
    if (longitude || latitude) result.push({ longitude, latitude })
  }
  return result
}

/**
 * Парсит принятые меры
 */
export function parseMeasures(alertDetails: Element, rootElement?: Element): MeasuresData | undefined {
  console.log('Начинаем парсинг принятых мер')
  
  const measures: SanitaryMeasure[] = []
  
  // Используем Set для отслеживания уже обработанных элементов, чтобы избежать дублирования
  const processedElements = new Set<Element>()
  
  // Ищем только в alertDetails, так как rootElement может содержать весь документ и дублировать элементы
  const searchElement = alertDetails
  
  // Пробуем найти через getElementsByTagName
  try {
    const measureElements = searchElement.getElementsByTagName('smcdo:SanitaryMeasureBaseDetails')
    console.log('Найдено мер через getElementsByTagName:', measureElements.length)
    
    for (let i = 0; i < measureElements.length; i++) {
      const el = measureElements[i]
      
      // Пропускаем уже обработанные элементы
      if (processedElements.has(el)) {
        console.log('[parseMeasures] Пропускаем уже обработанный элемент')
        continue
      }
      processedElements.add(el)
      
      const measure = parseSanitaryMeasure(el)
      if (measure) {
        measures.push(measure)
      }
    }
  } catch (e) {
    console.log('Ошибка при поиске мер:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (measures.length === 0) {
    const allElements = searchElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      
      // Пропускаем уже обработанные элементы
      if (processedElements.has(el)) {
        continue
      }
      
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'sanitarymeasurebasedetails') {
        processedElements.add(el)
        const measure = parseSanitaryMeasure(el)
        if (measure) {
          measures.push(measure)
        }
      }
    }
  }
  
  if (measures.length === 0) {
    console.log('Принятые меры не найдены')
    return undefined
  }
  
  console.log('Найдено принятых мер:', measures.length)
  return { measures }
}

/**
 * Парсит одну санитарную меру
 */
function parseSanitaryMeasure(measureElement: Element): SanitaryMeasure | null {
  const languageCode = getTextContent(measureElement, 'LanguageCode') || undefined
  const measureName = getTextContent(measureElement, 'MeasureName') || undefined
  const measureJustificationText = getTextContent(measureElement, 'MeasureJustificationText') || undefined
  const description = getDirectChildTextByLocalName(measureElement, 'DescriptionText') || undefined
  const rawStartDate = getDirectChildTextByLocalName(measureElement, 'StartDate') || undefined
  const startDate =
    rawStartDate?.trim() === SANITARY_MEASURE_START_DATE_XML_PLACEHOLDER ? undefined : rawStartDate
  const endDate = getDirectChildTextByLocalName(measureElement, 'EndDate') || undefined
  const measureAffectedObjectKindCodes = getAllTextContents(measureElement, 'MeasureAffectedObjectKindCode')
  const measureAffectedObjectKindCode = measureAffectedObjectKindCodes.length > 0 ? measureAffectedObjectKindCodes.join(';') : undefined
  
  // MeasureCode с атрибутом codeListId
  let measureCode: string | undefined = undefined
  let measureCodeListId: string | undefined = undefined
  const measureCodeEl = measureElement.querySelector('MeasureCode') ||
    Array.from(measureElement.getElementsByTagName('*')).find(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return localName === 'measurecode'
    })
  if (measureCodeEl) {
    measureCode = measureCodeEl.textContent?.trim() || undefined
    measureCodeListId = measureCodeEl.getAttribute('codeListId') || undefined
  }
  
  // MeasureDocDetails
  const measureDocDetails = parseMeasureDocDetails(measureElement)
  
  // InitialMeasureDocDetails
  const initialMeasureDocDetails = parseInitialMeasureDocDetails(measureElement)
  
  // MeasureInitiationBasisDetails (может быть несколько)
  const measureInitiationBasisDetails = parseMeasureInitiationBasisDetails(measureElement)
  
  // MeasureImplementationDetails (может быть несколько)
  const measureImplementationDetails = parseMeasureImplementationDetails(measureElement)
  
  if (!measureName && !measureCode) {
    return null
  }
  
  return {
    languageCode,
    measureCode,
    measureCodeListId,
    measureName,
    measureAffectedObjectKindCode,
    startDate,
    endDate,
    measureJustificationText,
    description,
    measureDocDetails,
    initialMeasureDocDetails,
    measureInitiationBasisDetails: measureInitiationBasisDetails.length > 0 ? measureInitiationBasisDetails : undefined,
    measureImplementationDetails: measureImplementationDetails.length > 0 ? measureImplementationDetails : undefined,
  }
}

/**
 * Парсит MeasureDocDetails
 */
function parseMeasureDocDetails(measureElement: Element): MeasureDocDetails | undefined {
  let docElement: Element | null = null
  
  try {
    const elements = measureElement.getElementsByTagName('smcdo:MeasureDocDetails')
    if (elements.length > 0) {
      docElement = elements[0]
    }
  } catch (e) {
    // Игнорируем
  }
  
  if (!docElement) {
    const allElements = measureElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'measuredocdetails') {
        docElement = el
        break
      }
    }
  }
  
  if (!docElement) {
    return undefined
  }
  
  return parseMeasureDocDetailsContent(docElement)
}

/**
 * Парсит InitialMeasureDocDetails
 */
function parseInitialMeasureDocDetails(measureElement: Element): MeasureDocDetails | undefined {
  let docElement: Element | null = null
  
  try {
    const elements = measureElement.getElementsByTagName('smcdo:InitialMeasureDocDetails')
    if (elements.length > 0) {
      docElement = elements[0]
    }
  } catch (e) {
    // Игнорируем
  }
  
  if (!docElement) {
    const allElements = measureElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'initialmeasuredocdetails') {
        docElement = el
        break
      }
    }
  }
  
  if (!docElement) {
    return undefined
  }
  
  return parseMeasureDocDetailsContent(docElement)
}

/**
 * Парсит содержимое MeasureDocDetails
 */
function parseMeasureDocDetailsContent(docElement: Element): MeasureDocDetails {
  const country = getTextContent(docElement, 'UnifiedCountryCode') || undefined
  const languageCode = getTextContent(docElement, 'LanguageCode') || undefined
  const docKindName = getTextContent(docElement, 'DocKindName') || undefined
  const docName = getTextContent(docElement, 'DocName') || undefined
  const docSeriesId = getTextContent(docElement, 'DocSeriesId') || undefined
  const docId = getTextContent(docElement, 'DocId') || undefined
  const docCreationDate = getTextContent(docElement, 'DocCreationDate') || undefined
  const docStartDate = getTextContent(docElement, 'DocStartDate') || undefined
  const docValidityDate = getTextContent(docElement, 'DocValidityDate') || undefined
  const docValidityDuration = getTextContent(docElement, 'DocValidityDuration') || undefined
  const authorityId = getTextContent(docElement, 'AuthorityId') || undefined
  const authorityName = getTextContent(docElement, 'AuthorityName') || undefined
  const description = getTextContent(docElement, 'DescriptionText') || undefined
  const pageQuantity = getTextContent(docElement, 'PageQuantity') || undefined
  
  // DocKindCode с атрибутом codeListId
  let docKindCode: string | undefined = undefined
  let docKindCodeListId: string | undefined = undefined
  const docKindCodeEl = docElement.querySelector('DocKindCode') ||
    Array.from(docElement.getElementsByTagName('*')).find(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return localName === 'dockindcode'
    })
  if (docKindCodeEl) {
    docKindCode = docKindCodeEl.textContent?.trim() || undefined
    docKindCodeListId = docKindCodeEl.getAttribute('codeListId') || undefined
  }
  
  // DocBinaryText с атрибутом mediaTypeCode
  let docBinaryText: { content?: string; mediaTypeCode?: string } | undefined = undefined
  const docBinaryTextEl = docElement.querySelector('DocBinaryText') ||
    Array.from(docElement.getElementsByTagName('*')).find(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return localName === 'docbinarytext'
    })
  if (docBinaryTextEl) {
    const content = docBinaryTextEl.textContent?.trim()
    const mediaTypeCode = docBinaryTextEl.getAttribute('mediaTypeCode') || undefined
    if (content || mediaTypeCode) {
      docBinaryText = { content, mediaTypeCode }
    }
  }
  
  // AnyDetails: внутренний XML (ccdo:DocDetails и вложенная структура) — сохраняем теги
  const xmlDocument = getInnerXmlContent(docElement, 'AnyDetails') ?? getTextContent(docElement, 'AnyDetails') ?? undefined

  return {
    country,
    languageCode,
    docKindCode,
    docKindCodeListId,
    docKindName,
    docName,
    docSeriesId,
    docId,
    docCreationDate,
    docStartDate,
    docValidityDate,
    docValidityDuration,
    authorityId,
    authorityName,
    description,
    pageQuantity,
    docBinaryText,
    xmlDocument,
  }
}

/**
 * Парсит MeasureInitiationBasisDetails (может быть несколько)
 */
function parseMeasureInitiationBasisDetails(measureElement: Element): MeasureInitiationBasisItem[] {
  const items: MeasureInitiationBasisItem[] = []
  
  try {
    const elements = measureElement.getElementsByTagName('smcdo:MeasureInitiationBasisDetails')
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]
      items.push({
        docKindName: getTextContent(el, 'DocKindName') || undefined,
        docName: getTextContent(el, 'DocName') || undefined,
        docId: getTextContent(el, 'DocId') || undefined,
        docCreationDate: getTextContent(el, 'DocCreationDate') || undefined,
      })
    }
  } catch (e) {
    // Игнорируем
  }
  
  if (items.length === 0) {
    const allElements = measureElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'measureinitiationbasisdetails') {
        items.push({
          docKindName: getTextContent(el, 'DocKindName') || undefined,
          docName: getTextContent(el, 'DocName') || undefined,
          docId: getTextContent(el, 'DocId') || undefined,
          docCreationDate: getTextContent(el, 'DocCreationDate') || undefined,
        })
      }
    }
  }
  
  return items
}

/**
 * Парсит MeasureImplementationDetails (может быть несколько)
 */
function parseMeasureImplementationDetails(measureElement: Element): MeasureImplementationItem[] {
  const items: MeasureImplementationItem[] = []
  
  try {
    const elements = measureElement.getElementsByTagName('smcdo:MeasureImplementationDetails')
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]
      const item = parseMeasureImplementationItem(el)
      if (item) {
        items.push(item)
      }
    }
  } catch (e) {
    // Игнорируем
  }
  
  if (items.length === 0) {
    const allElements = measureElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'measureimplementationdetails') {
        const item = parseMeasureImplementationItem(el)
        if (item) {
          items.push(item)
        }
      }
    }
  }
  
  return items
}

/**
 * Парсит один MeasureImplementationItem
 */
function parseMeasureImplementationItem(implElement: Element): MeasureImplementationItem | null {
  const country = getDirectChildTextByLocalName(implElement, 'UnifiedCountryCode') || undefined
  const startDate = getDirectChildTextByLocalName(implElement, 'StartDate') || undefined
  const endDate = getDirectChildTextByLocalName(implElement, 'EndDate') || undefined
  const description = getDirectChildTextByLocalName(implElement, 'DescriptionText') || undefined
  const measureAffectedObjectKindCodesImpl = getAllTextContents(implElement, 'MeasureAffectedObjectKindCode')
  const measureAffectedObjectKindCode = measureAffectedObjectKindCodesImpl.length > 0 ? measureAffectedObjectKindCodesImpl.join(';') : undefined

  const implEntities = findChildElementsByLocalName(implElement, 'implementingentitydetails')
  const authorities: UnifiedAuthorityDetails[] = []
  const subjectDetailsList: SubjectDetails[] = []
  if (implEntities.length > 0) {
    implEntities.forEach((entityEl) => {
      // По XSD внутри одного ImplementingEntityDetails допускается не более 1 УО и 1 Субъекта.
      const entityAuthority = parseUnifiedAuthorityDetails(entityEl)
      if (entityAuthority) authorities.push(entityAuthority)
      const entitySubject = parseSubjectDetails(entityEl)
      if (entitySubject) subjectDetailsList.push(entitySubject)
    })
  } else {
    // Обратная совместимость: старые XML без обертки ImplementingEntityDetails.
    const fallbackAuthorities = parseUnifiedAuthorityDetailsList(implElement)
    const fallbackSubjects = parseSubjectDetailsList(implElement)
    authorities.push(...fallbackAuthorities)
    subjectDetailsList.push(...fallbackSubjects)
  }
  const authority = authorities[0]
  const subjectDetails = subjectDetailsList[0]
  
  // DocReferenceDetails
  const documentDetails = parseDocumentReferenceDetails(implElement)
  
  // Место проведения мероприятия
  const placeDetails = parseMeasurePlaceDetails(implElement)
  
  return {
    country,
    startDate,
    endDate,
    description,
    measureAffectedObjectKindCode,
    authorities: authorities.length > 0 ? authorities : undefined,
    subjectDetailsList: subjectDetailsList.length > 0 ? subjectDetailsList : undefined,
    authority,
    subjectDetails,
    documentDetails,
    placeDetails,
  }
}

function parseUnifiedAuthorityDetailsList(parent: Element): UnifiedAuthorityDetails[] {
  const result: UnifiedAuthorityDetails[] = []
  try {
    const direct = parent.getElementsByTagName('ccdo:UnifiedAuthorityDetails')
    for (let i = 0; i < direct.length; i++) {
      const parsed = parseUnifiedAuthorityDetails(direct[i] as unknown as Element)
      if (parsed) result.push(parsed)
    }
  } catch {
    // ignore
  }
  if (result.length > 0) return result
  const all = parent.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (localName === 'unifiedauthoritydetails') {
      const parsed = parseUnifiedAuthorityDetails(el as unknown as Element)
      if (parsed) result.push(parsed)
    }
  }
  return result
}

function parseSubjectDetailsList(parent: Element): SubjectDetails[] {
  const result: SubjectDetails[] = []
  try {
    const direct = parent.getElementsByTagName('smcdo:SubjectDetails')
    for (let i = 0; i < direct.length; i++) {
      const parsed = parseSubjectDetails(direct[i] as unknown as Element)
      if (parsed) result.push(parsed)
    }
  } catch {
    // ignore
  }
  if (result.length > 0) return result
  const all = parent.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (localName === 'subjectdetails') {
      const parsed = parseSubjectDetails(el as unknown as Element)
      if (parsed) result.push(parsed)
    }
  }
  return result
}

/**
 * Парсит UnifiedAuthorityDetails
 */
function parseUnifiedAuthorityDetails(parent: Element): UnifiedAuthorityDetails | undefined {
  let authorityElement: Element | null = null
  
  try {
    const elements = parent.getElementsByTagName('ccdo:UnifiedAuthorityDetails')
    if (elements.length > 0) {
      authorityElement = elements[0]
    }
  } catch (e) {
    // Игнорируем
  }
  
  if (!authorityElement) {
    const allElements = parent.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'unifiedauthoritydetails') {
        authorityElement = el
        break
      }
    }
  }
  
  if (!authorityElement) {
    return undefined
  }
  
  // csdo:AuthorityId для мероприятия в мерах в карточку не переносим (в XML не экспортируется)
  return {
    country: getTextContent(authorityElement, 'UnifiedCountryCode') || undefined,
    authorityName: getTextContent(authorityElement, 'AuthorityName') || undefined,
    authorityBriefName: getTextContent(authorityElement, 'AuthorityBriefName') || undefined,
  }
}

/**
 * Парсит BusinessEntityId и атрибут kindId из родительского элемента
 */
function parseBusinessEntityIdAndKindId(parent: Element): { businessEntityId?: string; identificationMethod?: string } {
  let businessEntityIdEl: Element | null = null
  const namespaces = ['ccdo', 'csdo', 'smsdo', 'smcdo', 'doc']
  for (const ns of namespaces) {
    try {
      const elements = parent.getElementsByTagName(`${ns}:BusinessEntityId`)
      if (elements.length > 0) {
        businessEntityIdEl = elements[0]
        break
      }
    } catch (e) {
      // ignore
    }
  }
  if (!businessEntityIdEl) {
    const allElements = parent.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      if (localName === 'businessentityid') {
        businessEntityIdEl = el
        break
      }
    }
  }
  if (!businessEntityIdEl) return {}
  const businessEntityId = businessEntityIdEl.textContent?.trim() || undefined
  const kindId = businessEntityIdEl.getAttribute('kindId') || undefined
  return { businessEntityId, identificationMethod: kindId }
}

/**
 * Парсит SubjectDetails, когда поля юрлица заданы прямыми дочерними элементами (без вложенного OrganizationDetails).
 * В XML: SubjectBriefName, BusinessEntityTypeCode, BusinessEntityId (kindId), UniqueCustomsNumberId, TaxpayerId и т.д.
 */
function parseSubjectDetailsDirect(subjectElement: Element): BusinessEntityDetails | undefined {
  const country = getDirectChildTextByLocalName(subjectElement, 'UnifiedCountryCode') || undefined
  const subjectName = getTextContent(subjectElement, 'SubjectName') || undefined
  const businessEntityName = getTextContent(subjectElement, 'BusinessEntityName') || subjectName || undefined
  const subjectBriefName = getTextContent(subjectElement, 'SubjectBriefName') || undefined
  const businessEntityBriefName = getTextContent(subjectElement, 'BusinessEntityBriefName') || subjectBriefName || undefined
  let businessEntityTypeCode: string | undefined
  let businessEntityTypeCodeListId: string | undefined
  const businessEntityTypeCodeEl = Array.from(subjectElement.getElementsByTagName('*')).find((el) => {
    const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    return localName === 'businessentitytypecode'
  })
  if (businessEntityTypeCodeEl) {
    businessEntityTypeCode = businessEntityTypeCodeEl.textContent?.trim() || undefined
    businessEntityTypeCodeListId = businessEntityTypeCodeEl.getAttribute('codeListId') || undefined
  }
  let businessEntityTypeName = getTextContent(subjectElement, 'BusinessEntityTypeName') || undefined
  if (businessEntityTypeCode && businessEntityTypeCodeListId === '2049') {
    businessEntityTypeName = undefined
  }
  const { businessEntityId, identificationMethod } = parseBusinessEntityIdAndKindId(subjectElement)
  const customsNumber = getTextContent(subjectElement, 'UniqueCustomsNumberId') || getTextContent(subjectElement, 'CustomsNumber') || undefined
  const taxRegistrationReasonCode = getTextContent(subjectElement, 'TaxRegistrationReasonCode') || undefined
  const taxpayerId = getTextContent(subjectElement, 'TaxpayerId') || undefined

  const addresses: AddressDetails[] = []
  try {
    const addressElements = subjectElement.getElementsByTagName('ccdo:SubjectAddressDetails')
    for (let i = 0; i < addressElements.length; i++) {
      const addr = parseAddressDetails(addressElements[i])
      if (addr.fullAddress || addr.country) addresses.push(addr)
    }
  } catch (e) {
    // ignore
  }
  if (addresses.length === 0) {
    const allElements = subjectElement.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      if (localName === 'subjectaddressdetails') {
        const addr = parseAddressDetails(el)
        if (addr.fullAddress || addr.country) addresses.push(addr)
      }
    }
  }

  const contacts = parseContacts(subjectElement)

  const hasAny =
    country ||
    businessEntityName ||
    businessEntityBriefName ||
    businessEntityTypeCode ||
    businessEntityTypeName ||
    businessEntityId ||
    customsNumber ||
    taxRegistrationReasonCode ||
    taxpayerId ||
    addresses.length > 0 ||
    (contacts && contacts.length > 0)
  if (!hasAny) return undefined

  return {
    country,
    businessEntityName,
    businessEntityBriefName,
    businessEntityTypeCode: businessEntityTypeCode || undefined,
    businessEntityTypeCodeListId: businessEntityTypeCodeListId || undefined,
    businessEntityTypeName: businessEntityTypeName || undefined,
    businessEntityId,
    identificationMethod,
    customsNumber,
    taxRegistrationReasonCode,
    taxpayerId,
    addresses: addresses.length > 0 ? addresses : undefined,
    contacts: contacts && contacts.length > 0 ? contacts : undefined,
  }
}

/**
 * Парсит SubjectDetails (может быть юрлицо/ИП или физлицо)
 */
function parseSubjectDetails(parent: Element): SubjectDetails | undefined {
  let subjectElement: Element | null = null
  
  try {
    const elements = parent.getElementsByTagName('smcdo:SubjectDetails')
    if (elements.length > 0) {
      subjectElement = elements[0]
    }
  } catch (e) {
    // Игнорируем
  }
  
  if (!subjectElement) {
    const allElements = parent.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      if (localName === 'subjectdetails') {
        subjectElement = el
        break
      }
    }
  }
  
  if (!subjectElement) {
    return undefined
  }
 
  // Удостоверение и реквизиты юрлица могут идти в одном SubjectDetails (XSD: … TaxpayerId, TaxRegistrationReasonCode?, IdentityDocV3Details).
  // Нельзя терять parseSubjectDetailsDirect при наличии IdentityDocV3Details — иначе после загрузки теряются SubjectBriefName, BusinessEntityId и т.д.
  const identityDoc = parseIdentityDocDetails(subjectElement)
  if (identityDoc) {
    const businessEntityFlat = parseSubjectDetailsDirect(subjectElement)
    const countryRoot = getDirectChildTextByLocalName(subjectElement, 'UnifiedCountryCode') || undefined
    const subjectName = getTextContent(subjectElement, 'SubjectName') || undefined
    const addresses = parseAllAddresses(subjectElement)
    const registrationAddress = addresses.find((a) => (a.addressKindCode || '').trim() === '1')
    const actualAddress = addresses.find((a) => (a.addressKindCode || '').trim() === '2')
    const mailingAddress = addresses.find((a) => (a.addressKindCode || '').trim() === '3')
    const contacts = parseContacts(subjectElement)
    return {
      country: countryRoot || identityDoc.country,
      subjectName: subjectName || businessEntityFlat?.businessEntityName,
      ...(businessEntityFlat ? { businessEntity: businessEntityFlat } : {}),
      identityDoc,
      addresses: addresses.length > 0 ? addresses : undefined,
      registrationAddress,
      actualAddress,
      mailingAddress,
      contacts,
    }
  }

  // Юрлицо/ИП: сначала пробуем вложенный OrganizationDetails
  let businessEntity = parseOrganizationDetails(subjectElement)
  if (businessEntity) {
    return { businessEntity }
  }

  // Юрлицо/ИП: поля заданы прямыми дочерними элементами (SubjectBriefName, BusinessEntityTypeCode и т.д.)
  businessEntity = parseSubjectDetailsDirect(subjectElement)
  if (businessEntity) {
    return { businessEntity }
  }
  
  // Физлицо
  const country = getDirectChildTextByLocalName(subjectElement, 'UnifiedCountryCode') || undefined
  const subjectName = getTextContent(subjectElement, 'SubjectName') || undefined
  const addresses = parseAllAddresses(subjectElement)
  const registrationAddress = addresses.find((a) => (a.addressKindCode || '').trim() === '1')
  const actualAddress = addresses.find((a) => (a.addressKindCode || '').trim() === '2')
  const mailingAddress = addresses.find((a) => (a.addressKindCode || '').trim() === '3')
  const contacts = parseContacts(subjectElement)

  return {
    country,
    subjectName,
    identityDoc,
    addresses: addresses.length > 0 ? addresses : undefined,
    registrationAddress,
    actualAddress,
    mailingAddress,
    contacts,
  }
}

/**
 * Парсит IdentityDocDetails
 */
function parseIdentityDocDetails(parent: Element): IdentityDocDetails | undefined {
  let docElement: Element | null = null
  
  try {
    const elements = parent.getElementsByTagName('ccdo:IdentityDocV3Details')
    if (elements.length > 0) {
      docElement = elements[0]
    }
  } catch (e) {
    // Игнорируем
  }
  
  if (!docElement) {
    const allElements = parent.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'identitydocv3details') {
        docElement = el
        break
      }
    }
  }
  
  if (!docElement) {
    return undefined
  }
  
  const country = getTextContent(docElement, 'UnifiedCountryCode') || undefined
  const docKindName = getTextContent(docElement, 'DocKindName') || undefined
  const docSeriesId = getTextContent(docElement, 'DocSeriesId') || undefined
  const docId = getTextContent(docElement, 'DocId') || undefined
  const docCreationDate = getTextContent(docElement, 'DocCreationDate') || undefined
  const docValidityDate = getTextContent(docElement, 'DocValidityDate') || undefined
  const authorityId = getTextContent(docElement, 'AuthorityId') || undefined
  const authorityName = getTextContent(docElement, 'AuthorityName') || undefined
  
  // IdentityDocKindCode с атрибутом codeListId
  let docKindCode: string | undefined = undefined
  let docKindCodeListId: string | undefined = undefined
  const docKindCodeEl = docElement.querySelector('IdentityDocKindCode') ||
    Array.from(docElement.getElementsByTagName('*')).find(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return localName === 'identitydockindcode'
    })
  if (docKindCodeEl) {
    docKindCode = docKindCodeEl.textContent?.trim() || undefined
    docKindCodeListId = docKindCodeEl.getAttribute('codeListId') || undefined
  }

  const result: IdentityDocDetails = {
    country,
    docKindCode,
    docKindCodeListId,
    docKindName,
    docSeriesId,
    docId,
    docCreationDate,
    docValidityDate,
    authorityId,
    authorityName,
  }
  const t = (v: string | undefined) => (v ?? '').trim()
  if (
    !t(result.country) &&
    !t(result.docKindCode) &&
    !t(result.docKindName) &&
    !t(result.docSeriesId) &&
    !t(result.docId) &&
    !t(result.docCreationDate) &&
    !t(result.docValidityDate) &&
    !t(result.authorityName)
  ) {
    return undefined
  }
  return result
}

/**
 * Парсит DocumentReferenceDetails
 */
function parseDocumentReferenceDetails(parent: Element): DocumentReferenceDetails | undefined {
  let docElement: Element | null = null
  
  try {
    const elements = parent.getElementsByTagName('ccdo:DocReferenceDetails')
    if (elements.length > 0) {
      docElement = elements[0]
    }
  } catch (e) {
    // Игнорируем
  }
  
  if (!docElement) {
    const allElements = parent.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'docreferencedetails') {
        docElement = el
        break
      }
    }
  }
  
  if (!docElement) {
    return undefined
  }
  
  const docName = getTextContent(docElement, 'DocName') || undefined
  const docId = getTextContent(docElement, 'DocId') || undefined
  const docCreationDate = getTextContent(docElement, 'DocCreationDate') || undefined
  const docStartDate = getTextContent(docElement, 'DocStartDate') || undefined
  
  // DocKindCode с атрибутом codeListId
  let docKindCode: string | undefined = undefined
  let docKindCodeListId: string | undefined = undefined
  const docKindCodeEl = docElement.querySelector('DocKindCode') ||
    Array.from(docElement.getElementsByTagName('*')).find(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return localName === 'dockindcode'
    })
  if (docKindCodeEl) {
    docKindCode = docKindCodeEl.textContent?.trim() || undefined
    docKindCodeListId = docKindCodeEl.getAttribute('codeListId') || undefined
  }

  const docKindName = docKindCode ? undefined : getTextContent(docElement, 'DocKindName') || undefined

  return {
    docKindCode,
    docKindCodeListId,
    docKindName,
    docName,
    docId,
    docCreationDate,
    docStartDate,
  }
}

/**
 * Парсит MeasurePlaceDetails
 */
function findFirstChildElementByLocalName(parent: Element, localLower: string): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    const el = parent.children[i] as Element
    const ln = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (ln === localLower) return el
  }
  return null
}

function findChildElementsByLocalName(parent: Element, localLower: string): Element[] {
  const result: Element[] = []
  for (let i = 0; i < parent.children.length; i++) {
    const el = parent.children[i] as Element
    const ln = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (ln === localLower) result.push(el)
  }
  return result
}

function parseMeasurePlaceDetails(parent: Element): MeasurePlaceDetails | undefined {
  const legacy = findFirstChildElementByLocalName(parent, 'measureplacedetails')
  if (legacy) {
    const regionName = getTextContent(legacy, 'RegionName') || undefined
    const borderCheckpointCode = getTextContent(legacy, 'BorderCheckpointCode') || undefined
    const borderCheckpointName = getTextContent(legacy, 'BorderCheckpointName') || undefined
    if (!regionName && !borderCheckpointCode && !borderCheckpointName) return undefined
    return { regionName, borderCheckpointCode, borderCheckpointName }
  }
  // По XSD: csdo:RegionName и smcdo:BorderCheckpointDetails — прямые дочерние MeasureImplementationDetails
  let regionName: string | undefined
  let borderCheckpointCode: string | undefined
  let borderCheckpointName: string | undefined
  for (let i = 0; i < parent.children.length; i++) {
    const el = parent.children[i] as Element
    const ln = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (ln === 'regionname') {
      const t = el.textContent?.trim()
      if (t) regionName = t
    } else if (ln === 'bordercheckpointdetails') {
      const c = getTextContent(el, 'BorderCheckpointCode')
      const n = getTextContent(el, 'BorderCheckpointName')
      if (c) borderCheckpointCode = c
      if (n) borderCheckpointName = n
    }
  }
  if (!regionName && !borderCheckpointCode && !borderCheckpointName) return undefined
  return { regionName, borderCheckpointCode, borderCheckpointName }
}

/**
 * Парсит CONTENTBODY XML (VW_PACKAGEMESSAGE): извлекает запись общего ресурса
 * (ResourceItemStatusDetails: ValidityPeriodDetails StartDateTime/EndDateTime, UpdateDateTime).
 */
export function parseElectronicDocContentBody(xmlText: string): {
  validityPeriod: { start: string; end: string }
  updateDateTime: string
} {
  const result = { validityPeriod: { start: '', end: '' }, updateDateTime: '' }
  if (!xmlText || !xmlText.trim()) return result
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
  const root = xmlDoc.documentElement
  if (!root) return result

  const findFirstByLocal = (parent: Element, localName: string): Element | null => {
    const want = localName.toLowerCase()
    try {
      const byNs = parent.getElementsByTagNameNS('*', localName)
      if (byNs.length > 0) return byNs[0]
    } catch (_) {}
    const all = parent.getElementsByTagName('*')
    for (let i = 0; i < all.length; i++) {
      const el = all[i]
      const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      if (local === want) return el
    }
    return null
  }

  const resourceStatus = findFirstByLocal(root, 'ResourceItemStatusDetails')
  if (!resourceStatus) return result

  const validityPeriod = findFirstByLocal(resourceStatus, 'ValidityPeriodDetails')
  result.validityPeriod.start = (getTextContent(validityPeriod, 'StartDateTime') || getTextFromDirectChildByLocalName(validityPeriod, 'StartDateTime') || '').trim()
  result.validityPeriod.end = (getTextContent(validityPeriod, 'EndDateTime') || getTextFromDirectChildByLocalName(validityPeriod, 'EndDateTime') || '').trim()
  result.updateDateTime = (getTextContent(resourceStatus, 'UpdateDateTime') || getTextFromDirectChildByLocalName(resourceStatus, 'UpdateDateTime') || '').trim()
  return result
}

/**
 * Загружает XML файл по пути
 */
export async function loadXMLFile(filePath: string): Promise<string> {
  try {
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки файла: ${response.statusText}`)
    }
    return await response.text()
  } catch (error) {
    throw new Error(`Не удалось загрузить файл: ${error}`)
  }
}

const BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null
  ? (import.meta.env.BASE_URL as string)
  : '/dpa_card/'

/**
 * Загружает XML по DPAID через API (таблица DPAXML)
 */
export async function loadXMLByDpaid(dpaid: string): Promise<string> {
  const url = `${BASE_URL.replace(/\/$/, '')}/api/dpa-xml/${encodeURIComponent(dpaid)}`
  const response = await fetch(url)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(response.status === 404 ? `Запись с DPAID ${dpaid} не найдена` : (text || response.statusText))
  }
  return response.text()
}

/**
 * Валидирует и обновляет данные карточки, используя справочники
 * Проверяет код вида уведомления (INCIDENTALERTKINDCODE) на присутствие в справочнике
 */
export async function validateAndEnrichCardData(cardData: CardData, incidentKindCode?: string): Promise<{
  cardData: CardData
  validationErrors: string[]
  validationWarnings: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []

  // Валидация вида уведомления - проверяем код на присутствие в справочнике
  const codeToValidate = incidentKindCode || cardData.notification.type
  if (codeToValidate) {
    try {
      const exists = await checkIncidentAlertKindExists(codeToValidate)
      if (exists === false) {
        // Проверяем, не была ли ошибка загрузки справочника
        // Если справочник не загрузился, не показываем предупреждение о коде
        try {
          // Пробуем загрузить справочник еще раз, чтобы понять, доступен ли он
          const options = await getIncidentAlertKindOptions()
          // Если справочник загрузился, но кода нет - показываем предупреждение
          warnings.push(`Код вида уведомления "${codeToValidate}" не найден в справочнике INCIDENTALERTKIND`)
        } catch (loadError) {
          // Справочник недоступен — проверка не выполняется, фиксируем как ошибку валидации
          console.warn(`Справочник видов уведомлений недоступен, проверка кода "${codeToValidate}" не выполнена`)
          errors.push(`Справочник видов уведомлений недоступен. Проверка кода "${codeToValidate}" невозможна.`)
        }
      } else {
        console.log(`Код вида уведомления "${codeToValidate}" успешно найден в справочнике`)
      }
    } catch (error) {
      console.error('Ошибка при валидации вида уведомления:', error)
      errors.push(`Не удалось проверить код вида уведомления "${codeToValidate}" в справочнике (справочник может быть недоступен).`)
    }
  } else {
    warnings.push('Код вида уведомления (INCIDENTALERTKINDCODE) не указан в XML')
  }

  // Валидация типа санитарной продукции - проверяем код на присутствие в справочнике
  // Визуальная индикация будет показана в форме редактирования
  if (cardData.product?.typeCode) {
    try {
      const exists = await checkSanitaryProdTypeExists(cardData.product.typeCode)
      if (exists === false) {
        console.warn(`Код типа санитарной продукции "${cardData.product.typeCode}" не найден в справочнике SANITARYPRODTYPE`)
        // Не добавляем предупреждение - визуальная индикация будет в форме
      } else {
        console.log(`Код типа санитарной продукции "${cardData.product.typeCode}" успешно найден в справочнике`)
      }
    } catch (error) {
      console.error('Ошибка при валидации типа санитарной продукции:', error)
      // Не добавляем предупреждение - визуальная индикация будет в форме
    }
  }

  // Валидация видов товаросопроводительных документов в ТСД
  if (cardData.tsd?.batches) {
    for (const batch of cardData.tsd.batches) {
      if (batch.shippingDocuments) {
        for (const doc of batch.shippingDocuments) {
          if (doc.docKindCode) {
            try {
              const exists = await checkShipDocKindExists(doc.docKindCode)
              if (exists === false) {
                console.warn(`Код вида товаросопроводительного документа "${doc.docKindCode}" не найден в справочнике SHIPDOCKIND`)
                // Не добавляем предупреждение - визуальная индикация будет в форме
              } else {
                console.log(`Код вида товаросопроводительного документа "${doc.docKindCode}" успешно найден в справочнике`)
              }
            } catch (error) {
              console.error('Ошибка при валидации вида товаросопроводительного документа:', error)
              // Не добавляем предупреждение - визуальная индикация будет в форме
            }
          }
        }
      }
    }
  }

  // Валидация видов участников цепи поставки
  // Проверяем в товаросопроводительных документах ТСД
  if (cardData.tsd?.batches) {
    for (const batch of cardData.tsd.batches) {
      if (batch.shippingDocuments) {
        for (const doc of batch.shippingDocuments) {
          if (doc.supplyChainParties) {
            for (const party of doc.supplyChainParties) {
              if (party.supplyChainPartyKindCode) {
                try {
                  const exists = await checkSupplyChainPartyKindExists(party.supplyChainPartyKindCode)
                  if (exists === false) {
                    console.warn(`Код вида участника цепи поставки "${party.supplyChainPartyKindCode}" не найден в справочнике SUPPLYCHAINPARTYKIND`)
                    // Не добавляем предупреждение - визуальная индикация будет в форме
                  } else {
                    console.log(`Код вида участника цепи поставки "${party.supplyChainPartyKindCode}" успешно найден в справочнике`)
                  }
                } catch (error) {
                  console.error('Ошибка при валидации вида участника цепи поставки:', error)
                  // Не добавляем предупреждение - визуальная индикация будет в форме
                }
              }
            }
          }
        }
      }
    }
  }

  // Валидация видов объектов действия мер в мероприятиях
  if (cardData.measures?.measures) {
    for (const measure of cardData.measures.measures) {
      // Валидация для основного measureAffectedObjectKindCode (может быть несколько через ";")
      if (measure.measureAffectedObjectKindCode) {
        const codes = measure.measureAffectedObjectKindCode.split(';').map((c) => c.trim()).filter(Boolean)
        for (const code of codes) {
          try {
            const exists = await checkSanitaryMeasureObjKindExists(code)
            if (exists === false) {
              console.warn(`Код вида объекта действия мер "${code}" не найден в справочнике SANITARYMEASUREOBJKIND`)
            } else {
              console.log(`Код вида объекта действия мер "${code}" успешно найден в справочнике`)
            }
          } catch (error) {
            console.error('Ошибка при валидации вида объекта действия мер:', error)
          }
        }
      }

      // Валидация для measureAffectedObjectKindCode в мероприятиях (может быть несколько через ";")
      if (measure.measureImplementationDetails) {
        for (const impl of measure.measureImplementationDetails) {
          if (impl.measureAffectedObjectKindCode) {
            const codes = impl.measureAffectedObjectKindCode.split(';').map((c) => c.trim()).filter(Boolean)
            for (const code of codes) {
              try {
                const exists = await checkSanitaryMeasureObjKindExists(code)
                if (exists === false) {
                  console.warn(`Код вида объекта действия мер "${code}" не найден в справочнике SANITARYMEASUREOBJKIND`)
                } else {
                  console.log(`Код вида объекта действия мер "${code}" успешно найден в справочнике`)
                }
              } catch (error) {
                console.error('Ошибка при валидации вида объекта действия мер:', error)
              }
            }
          }
        }
      }
    }
  }

  return {
    cardData,
    validationErrors: errors,
    validationWarnings: warnings,
  }
}

