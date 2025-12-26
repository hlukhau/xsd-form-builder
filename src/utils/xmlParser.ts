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
import { getIncidentAlertKindNameByCode, checkIncidentAlertKindExists } from '@/utils/referenceDataApi'

/**
 * Парсит XML документ и преобразует его в структуру CardData
 */
export function parseXMLToCardData(xmlText: string): CardData {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

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

  // Уполномоченный орган - ищем по локальному имени
  let authority: Element | null = null
  const allElements = alertDetails.getElementsByTagName('*')
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i]
    const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
    if (localName === 'unifiedauthoritydetails') {
      authority = el
      break
    }
  }
  
  const authorizedBody = {
    country: getTextContent(authority, 'UnifiedCountryCode') || '',
    identifier: getTextContent(authority, 'AuthorityId') || '',
    name: getTextContent(authority, 'AuthorityName') || '',
    shortName: getTextContent(authority, 'AuthorityShortName') || '',
  }

  // ResourceItemStatusDetails - ищем по локальному имени
  let resourceStatus: Element | null = null
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i]
    const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
    if (localName === 'resourceitemstatusdetails') {
      resourceStatus = el
      break
    }
  }
  
  // ValidityPeriodDetails
  let validityPeriod: Element | null = null
  if (resourceStatus) {
    const resourceChildren = resourceStatus.getElementsByTagName('*')
    for (let i = 0; i < resourceChildren.length; i++) {
      const el = resourceChildren[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'validityperioddetails') {
        validityPeriod = el
        break
      }
    }
  }
  const startDateTime = getTextContent(validityPeriod, 'StartDateTime') || ''
  const endDateTime = getTextContent(validityPeriod, 'EndDateTime') || ''
  const updateDateTime = getTextContent(resourceStatus, 'UpdateDateTime') || ''

  // Устанавливаем даты только если они не пустые
  if (startDateTime && startDateTime.trim()) {
    electronicDocument.validityPeriod.start = startDateTime.trim()
  }
  if (endDateTime && endDateTime.trim()) {
    electronicDocument.validityPeriod.end = endDateTime.trim()
  }
  if (updateDateTime && updateDateTime.trim()) {
    electronicDocument.updateDateTime = updateDateTime.trim()
  }

  // EndDate
  const endDate = getTextContent(alertDetails, 'EndDate')

  // Парсинг данных о продукции
  // Передаем и alertDetails, и корневой элемент для поиска
  const productData = parseProductData(alertDetails, xmlDoc.documentElement)
  
  // Парсинг данных о партиях (ТСД)
  const tsdData = parseTSDData(alertDetails, xmlDoc.documentElement)
  
  // Парсинг документов соответствия
  const complianceDocumentsData = parseComplianceDocuments(alertDetails, xmlDoc.documentElement)
  
  // Парсинг нарушений
  const violationsData = parseViolations(alertDetails, xmlDoc.documentElement)
  
  // Парсинг места обнаружения
  const detectionPlaceData = parseDetectionPlace(alertDetails, xmlDoc.documentElement)
  
  // Парсинг принятых мер
  const measuresData = parseMeasures(alertDetails, xmlDoc.documentElement)

  // Сохраняем код вида уведомления в notification.type
  const notification: Notification = {
    country,
    registrationNumber,
    type: incidentKindCode || '', // Сохраняем код
    formationDate: docCreationDate,
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
        country: notification.authorizedBody.country || 'RU',
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
    tsd: tsdData,
    complianceDocuments: complianceDocumentsData,
    violations: violationsData,
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
export function getTextContent(
  parent: Element | null,
  tagName: string
): string | null {
  if (!parent) return null

  // Сначала пробуем найти с namespace (более точный поиск)
  const namespaces = [
    'ccdo',
    'csdo',
    'smsdo',
    'smcdo',
    'doc',
  ]

  for (const ns of namespaces) {
    try {
      // Пробуем через getElementsByTagName с namespace
      const elements = parent.getElementsByTagName(`${ns}:${tagName}`)
      if (elements.length > 0) {
        const text = elements[0].textContent?.trim() || null
        if (text) {
          console.log(`getTextContent: найдено ${ns}:${tagName} = "${text}"`)
        }
        return text
      }
    } catch (e) {
      // Игнорируем ошибку и продолжаем
    }
  }

  // Ищем по локальному имени (без namespace) - самый надежный способ
  const allElements = parent.getElementsByTagName('*')
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i]
    const localName = element.localName || element.tagName.split(':').pop()?.toLowerCase()
    const tagNameLower = tagName.toLowerCase()
    if (localName === tagNameLower) {
      return element.textContent?.trim() || null
    }
  }

  // Последняя попытка - ищем элемент без учета namespace
  try {
    const elements = parent.getElementsByTagName(tagName)
    if (elements.length > 0) {
      return elements[0].textContent?.trim() || null
    }
  } catch (e) {
    // Игнорируем ошибку
  }

  return null
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

  // Извлекаем данные о типе продукции
  const typeCode = getTextContent(productDetailsElement, 'SanitaryProductTypeCode') || ''
  let typeName = getTextContent(productDetailsElement, 'SanitaryProductTypeName') || ''
  
  // Если название не указано, но есть код, можно использовать код
  // В реальном приложении здесь можно обратиться к справочнику
  if (!typeName && typeCode) {
    // Заглушка - в реальном приложении нужно обращаться к справочнику
    typeName = `Вид продукции (код: ${typeCode})`
  }

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

  const productDetails: ProductDetails = {
    productId: getTextContent(productDetailsEl, 'ProductId') || undefined,
    productName: getTextContent(productDetailsEl, 'ProductName') || undefined,
    tradeName: getTextContent(productDetailsEl, 'ProductTradeName') || undefined,
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
  // В XML может быть BusinessEntityTypeCode, нужно получить название из справочника
  const businessEntityTypeCode = getTextContent(supplyChainEl, 'BusinessEntityTypeCode') || undefined
  const organizationalForm = getTextContent(supplyChainEl, 'BusinessEntityTypeName') || undefined
  const subjectIdentifier = getTextContent(supplyChainEl, 'BusinessEntityId') || undefined
  
  // Метод идентификации может быть в kindId атрибуте BusinessEntityId
  let identificationMethod = getTextContent(supplyChainEl, 'IdentificationMethodText') || undefined
  if (!identificationMethod && subjectIdentifier) {
    // Пробуем найти BusinessEntityId элемент и получить kindId
    const businessEntityIdEl = supplyChainEl.querySelector('BusinessEntityId') || 
      Array.from(supplyChainEl.getElementsByTagName('*')).find(el => {
        const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        return localName === 'businessentityid'
      })
    if (businessEntityIdEl) {
      const kindId = businessEntityIdEl.getAttribute('kindId')
      if (kindId) {
        // В реальном приложении здесь обращение к справочнику
        const kindIdMap: Record<string, string> = {
          'RU01': 'ОГРН - основной государственный регистрационный номер юридического лица, указанный в Едином государственном реестре юридических лиц',
        }
        identificationMethod = kindIdMap[kindId] || `Метод идентификации (код: ${kindId})`
      }
    }
  }
  
  const customsNumber = getTextContent(supplyChainEl, 'CustomsNumber') || undefined
  const taxpayerId = getTextContent(supplyChainEl, 'TaxpayerId') || undefined
  const supplyChainPartyKindCode = getTextContent(supplyChainEl, 'SupplyChainPartyKindCode') || undefined

  // Парсим адреса - находим все адреса
  const registrationAddress = parseAddress(supplyChainEl, '1') // AddressKindCode = 1
  const actualAddress = parseAddress(supplyChainEl, '2') // AddressKindCode = 2
  const mailingAddress = parseAddress(supplyChainEl, '3') // AddressKindCode = 3

  // Парсим контакты
  const contacts = parseContacts(supplyChainEl)

  return {
    country,
    businessEntityName,
    shortName,
    organizationalForm,
    subjectIdentifier,
    identificationMethod,
    customsNumber,
    taxpayerId,
    registrationAddress,
    actualAddress,
    mailingAddress,
    contacts,
    supplyChainPartyKindCode,
  }
}

/**
 * Парсит адрес по коду вида адреса
 */
function parseAddress(parent: Element, addressKindCode: string): AddressDetails | undefined {
  // Пробуем найти через getElementsByTagName
  try {
    const addressElements = parent.getElementsByTagName('ccdo:SubjectAddressDetails')
    for (let i = 0; i < addressElements.length; i++) {
      const el = addressElements[i]
      const kindCode = getTextContent(el, 'AddressKindCode')
      if (kindCode === addressKindCode) {
        return parseAddressDetails(el)
      }
    }
  } catch (e) {
    // Игнорируем ошибку
  }
  
  // Если не нашли, ищем по локальному имени
  const allElements = parent.getElementsByTagName('*')
  
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i]
    const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
    
    if (localName === 'subjectaddressdetails' || localName === 'objectaddressdetails') {
      const kindCode = getTextContent(el, 'AddressKindCode')
      if (kindCode === addressKindCode) {
        return parseAddressDetails(el)
      }
    }
  }
  
  return undefined
}

/**
 * Парсит детали адреса из элемента
 */
function parseAddressDetails(addressEl: Element): AddressDetails {
  const country = getTextContent(addressEl, 'UnifiedCountryCode') || ''
  const regionName = getTextContent(addressEl, 'RegionName') || ''
  const districtName = getTextContent(addressEl, 'DistrictName') || ''
  const cityName = getTextContent(addressEl, 'CityName') || ''
  const streetName = getTextContent(addressEl, 'StreetName') || ''
  const buildingNumberId = getTextContent(addressEl, 'BuildingNumberId') || ''
  const roomNumberId = getTextContent(addressEl, 'RoomNumberId') || ''
  const postCode = getTextContent(addressEl, 'PostCode') || ''
  
  const parts = []
  if (country) parts.push(country)
  if (regionName) parts.push(regionName)
  if (districtName) parts.push(districtName)
  if (cityName) parts.push(cityName)
  if (streetName) parts.push(streetName)
  if (buildingNumberId) parts.push(buildingNumberId)
  if (roomNumberId) parts.push(roomNumberId)
  if (postCode) parts.push(postCode)
  
  return {
    addressKindCode: getTextContent(addressEl, 'AddressKindCode') || undefined,
    country: country || undefined,
    cityName: cityName || undefined,
    streetName: streetName || undefined,
    buildingNumberId: buildingNumberId || undefined,
    fullAddress: parts.length > 0 ? parts.join(', ') : undefined,
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
    console.log('Найдено CommunicationDetails через getElementsByTagName:', commElements.length)
    for (let i = 0; i < commElements.length; i++) {
      const el = commElements[i]
      const channelCode = getTextContent(el, 'CommunicationChannelCode') || undefined
      const channelId = getTextContent(el, 'CommunicationChannelId') || undefined
      
      if (channelCode || channelId) {
        // Определяем тип контакта по коду
        const channelNameMap: Record<string, string> = {
          'TE': 'телефон',
          'EM': 'электронная почта',
          'FX': 'факс',
        }
        const contactKind = channelCode ? (channelNameMap[channelCode] || channelCode) : undefined
        
        contacts.push({
          contactKind,
          contactValue: channelId,
        })
      }
    }
  } catch (e) {
    console.log('Ошибка при поиске контактов через getElementsByTagName:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (contacts.length === 0) {
    const allElements = parent.getElementsByTagName('*')
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'communicationdetails' || 
          localName?.includes('contact') || 
          localName === 'contactdetails') {
        const channelCode = getTextContent(el, 'CommunicationChannelCode') || undefined
        const channelId = getTextContent(el, 'CommunicationChannelId') || undefined
        const contactKind = getTextContent(el, 'ContactKindCode') || getTextContent(el, 'ContactKindName') || undefined
        const contactValue = getTextContent(el, 'ContactValue') || getTextContent(el, 'ContactText') || channelId || undefined
        
        if (contactKind || contactValue) {
          const channelNameMap: Record<string, string> = {
            'TE': 'телефон',
            'EM': 'электронная почта',
            'FX': 'факс',
          }
          const finalContactKind = contactKind || (channelCode ? (channelNameMap[channelCode] || channelCode) : undefined)
          
          contacts.push({
            contactKind: finalContactKind,
            contactValue,
          })
        }
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
    const children = batchElement.getElementsByTagName('*')
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
  const note = getTextContent(batchElement, 'NoteText') || undefined
  const consignmentId = getTextContent(batchElement, 'ConsignmentId') || undefined
  
  console.log('Извлеченные данные партии:', { batchId, manufactureDate, productShelfLifeEndDate, consignmentId })
  
  // UnifiedCommodityMeasure
  const commodityMeasure = parseMeasure(batchDetailsEl, 'UnifiedCommodityMeasure')
  console.log('CommodityMeasure:', commodityMeasure)
  
  // CommodityMeasure
  const batchCommodityMeasure = parseMeasure(batchElement, 'CommodityMeasure')
  console.log('BatchCommodityMeasure:', batchCommodityMeasure)
  
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
  
  const result = {
    batchId,
    manufactureDate,
    productShelfLifeEndDate,
    commodityMeasure,
    note,
    consignmentId,
    batchCommodityMeasure,
    shippingDocuments,
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
      const product: ProductDetails = {
        productId: getTextContent(el, 'ProductId') || undefined,
        productName: getTextContent(el, 'ProductName') || undefined,
        tradeName: getTextContent(el, 'ProductTradeName') || undefined,
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
        const product: ProductDetails = {
          productId: getTextContent(el, 'ProductId') || undefined,
          productName: getTextContent(el, 'ProductName') || undefined,
          tradeName: getTextContent(el, 'ProductTradeName') || undefined,
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
  if (!parent) return undefined
  
  // Ищем элемент по локальному имени
  let measureEl: Element | null = null
  const allElements = parent.getElementsByTagName('*')
  
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i]
    const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
    if (localName === tagName.toLowerCase()) {
      measureEl = el
      break
    }
  }
  
  if (!measureEl) return undefined
  
  const value = measureEl.textContent?.trim() || ''
  if (!value) return undefined
  
  const unitCode = measureEl.getAttribute('measurementUnitCode') || undefined
  const unitCodeListId = measureEl.getAttribute('measurementUnitCodeListId') || undefined
  
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
    unitName: unitCode ? (unitNameMap[unitCode] || unitCode) : undefined,
  }
}

/**
 * Парсит документы соответствия
 */
function parseComplianceDocuments(alertDetails: Element, rootElement?: Element): ComplianceDocumentsData | undefined {
  console.log('Начинаем парсинг документов соответствия')
  
  const documents: ComplianceDocument[] = []
  
  // Ищем все ConformityDocDetails внутри NonCompliantSanitaryProductBatchDetails
  const searchElements = rootElement ? [alertDetails, rootElement] : [alertDetails]
  
  for (const searchElement of searchElements) {
    // Пробуем найти через getElementsByTagName
    try {
      const docElements = searchElement.getElementsByTagName('smcdo:ConformityDocDetails')
      console.log('Найдено документов соответствия через getElementsByTagName:', docElements.length)
      
      for (let i = 0; i < docElements.length; i++) {
        const el = docElements[i]
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
        const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        
        if (localName === 'conformitydocdetails') {
          const doc = parseComplianceDocument(el)
          if (doc) {
            documents.push(doc)
          }
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
      authority = {
        country: getTextContent(authorityEl, 'UnifiedCountryCode') || undefined,
        authorityName: getTextContent(authorityEl, 'AuthorityName') || undefined,
        authorityBriefName: getTextContent(authorityEl, 'AuthorityBriefName') || undefined,
        authorityId: getTextContent(authorityEl, 'AuthorityId') || undefined,
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
          authorityId: getTextContent(el, 'AuthorityId') || undefined,
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
 * Парсит нарушения
 */
function parseViolations(alertDetails: Element, rootElement?: Element): ViolationsData | undefined {
  console.log('Начинаем парсинг нарушений')
  
  const violatedRequirements: ViolatedRequirement[] = []
  const violatedIndicators: ViolatedIndicator[] = []
  let generalDescription: string | undefined = undefined
  
  const searchElements = rootElement ? [alertDetails, rootElement] : [alertDetails]
  
  for (const searchElement of searchElements) {
    // Пробуем найти через getElementsByTagName
    try {
      const violationElements = searchElement.getElementsByTagName('smcdo:RequirementViolationDetails')
      console.log('Найдено нарушений через getElementsByTagName:', violationElements.length)
      
      for (let i = 0; i < violationElements.length; i++) {
        const el = violationElements[i]
        
        // Описание на уровне RequirementViolationDetails (может быть несколько)
        // Собираем все DescriptionText на этом уровне
        const descs: string[] = []
        const allDescElements = el.getElementsByTagName('*')
        for (let j = 0; j < allDescElements.length; j++) {
          const descEl = allDescElements[j]
          const localName = descEl.localName || descEl.tagName.split(':').pop()?.toLowerCase()
          // Проверяем, что это DescriptionText и он не внутри RequirementsDocDetails
          if (localName === 'descriptiontext') {
            const parentLocalName = descEl.parentElement?.localName || descEl.parentElement?.tagName.split(':').pop()?.toLowerCase()
            // Если DescriptionText на уровне RequirementViolationDetails (не внутри RequirementsDocDetails)
            if (parentLocalName === 'requirementviolationdetails') {
              const text = descEl.textContent?.trim()
              if (text) {
                descs.push(text)
              }
            }
          }
        }
        
        // Объединяем все описания
        if (descs.length > 0) {
          const combinedDesc = descs.join(' ')
          if (!generalDescription) {
            generalDescription = combinedDesc
          } else {
            generalDescription += ' ' + combinedDesc
          }
        }
        
        // RequirementsDocDetails
        const requirementsDocs = parseRequirementsDocDetails(el)
        violatedRequirements.push(...requirementsDocs)
        
        // DiscrepancyOfQualityIndexDetails (нарушенные показатели)
        const indicators = parseViolatedIndicators(el)
        violatedIndicators.push(...indicators)
      }
    } catch (e) {
      console.log('Ошибка при поиске нарушений:', e)
    }
    
    // Если не нашли, ищем по локальному имени
    if (violatedRequirements.length === 0) {
      const allElements = searchElement.getElementsByTagName('*')
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i]
        const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        
        if (localName === 'requirementviolationdetails') {
          // Описание на уровне RequirementViolationDetails
          const descs: string[] = []
          const allDescElements = el.getElementsByTagName('*')
          for (let j = 0; j < allDescElements.length; j++) {
            const descEl = allDescElements[j]
            const descLocalName = descEl.localName || descEl.tagName.split(':').pop()?.toLowerCase()
            if (descLocalName === 'descriptiontext') {
              const parentLocalName = descEl.parentElement?.localName || descEl.parentElement?.tagName.split(':').pop()?.toLowerCase()
              if (parentLocalName === 'requirementviolationdetails') {
                const text = descEl.textContent?.trim()
                if (text) {
                  descs.push(text)
                }
              }
            }
          }
          
          if (descs.length > 0) {
            const combinedDesc = descs.join(' ')
            if (!generalDescription) {
              generalDescription = combinedDesc
            } else {
              generalDescription += ' ' + combinedDesc
            }
          }
          
          const requirementsDocs = parseRequirementsDocDetails(el)
          violatedRequirements.push(...requirementsDocs)
          
          const indicators = parseViolatedIndicators(el)
          violatedIndicators.push(...indicators)
        }
      }
    }
  }
  
  if (violatedRequirements.length === 0 && violatedIndicators.length === 0 && !generalDescription) {
    console.log('Нарушения не найдены')
    return undefined
  }
  
  console.log('Найдено нарушенных требований:', violatedRequirements.length)
  console.log('Найдено нарушенных показателей:', violatedIndicators.length)
  
  return {
    generalDescription,
    violatedRequirements,
    violatedIndicators,
  }
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
  
  // Единица измерения из атрибутов
  const valueElement = indicatorElement.querySelector('DiscrepancyOfQualityIndexValue') ||
    Array.from(indicatorElement.getElementsByTagName('*')).find(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return localName === 'discrepancyofqualityindexvalue'
    })
  
  let unitCode: string | undefined = undefined
  let unitCodeListId: string | undefined = undefined
  
  if (valueElement) {
    unitCode = valueElement.getAttribute('measurementUnitCode') || undefined
    unitCodeListId = valueElement.getAttribute('measurementUnitCodeListId') || undefined
  }
  
  // В реальном приложении здесь обращение к справочнику единиц измерения
  const unitNameMap: Record<string, string> = {
    '130': 'л.',
    '796': 'шт.',
    '163': 'кг',
    'C62': 'мг/кг',
    'M1': '%',
  }
  const unitName = unitCode ? (unitNameMap[unitCode] || unitCode) : undefined
  
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
 * Парсит детали места обнаружения
 */
function parseDetectionPlaceDetails(placeElement: Element): DetectionPlaceData {
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
  
  const country = getTextContent(orgElement, 'UnifiedCountryCode') || undefined
  const businessEntityName = getTextContent(orgElement, 'BusinessEntityName') || undefined
  const businessEntityBriefName = getTextContent(orgElement, 'BusinessEntityBriefName') || undefined
  const businessEntityTypeName = getTextContent(orgElement, 'BusinessEntityTypeName') || undefined
  const taxpayerId = getTextContent(orgElement, 'TaxpayerId') || undefined
  
  // BusinessEntityId с методом идентификации
  let businessEntityId: string | undefined = undefined
  let identificationMethod: string | undefined = undefined
  
  const businessEntityIdEl = orgElement.querySelector('BusinessEntityId') ||
    Array.from(orgElement.getElementsByTagName('*')).find(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return localName === 'businessentityid'
    })
  
  if (businessEntityIdEl) {
    businessEntityId = businessEntityIdEl.textContent?.trim() || undefined
    const kindId = businessEntityIdEl.getAttribute('kindId')
    if (kindId) {
      const kindIdMap: Record<string, string> = {
        'BY01': 'УНП - учетный номер плательщика',
        'RU01': 'ОГРН - основной государственный регистрационный номер юридического лица',
      }
      identificationMethod = kindIdMap[kindId] || `Метод идентификации (код: ${kindId})`
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
  
  if (!country && !businessEntityName) {
    return undefined
  }
  
  return {
    country,
    businessEntityName,
    businessEntityBriefName,
    businessEntityTypeName,
    businessEntityId,
    identificationMethod,
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
  
  // Если не нашли, ищем по локальному имени
  if (!addressElement) {
    const allElements = placeElement.getElementsByTagName('*')
    console.log('Ищем ObjectAddressDetails среди', allElements.length, 'элементов')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
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
 * Парсит GeoCoordinateDetails
 */
function parseGeoCoordinates(placeElement: Element): GeoCoordinateDetails | undefined {
  let geoElement: Element | null = null
  
  console.log('Ищем GeoCoordinateDetails в:', placeElement.tagName)
  
  // Пробуем найти через getElementsByTagName
  try {
    const elements = placeElement.getElementsByTagName('ccdo:GeoCoordinateDetails')
    console.log('Найдено GeoCoordinateDetails через getElementsByTagName:', elements.length)
    if (elements.length > 0) {
      geoElement = elements[0]
    }
  } catch (e) {
    console.log('Ошибка при поиске GeoCoordinateDetails:', e)
  }
  
  // Если не нашли, ищем по локальному имени
  if (!geoElement) {
    const allElements = placeElement.getElementsByTagName('*')
    console.log('Ищем GeoCoordinateDetails среди', allElements.length, 'элементов')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      
      if (localName === 'geocoordinatedetails') {
        console.log('Найден GeoCoordinateDetails по локальному имени:', el.tagName)
        geoElement = el
        break
      }
    }
  }
  
  if (!geoElement) {
    console.log('GeoCoordinateDetails не найден')
    return undefined
  }
  
  const longitude = getTextContent(geoElement, 'LongitudeMeasure') || undefined
  const latitude = getTextContent(geoElement, 'LatitudeMeasure') || undefined
  
  console.log('Распарсен GeoCoordinateDetails:', { longitude, latitude })
  
  if (!longitude && !latitude) {
    return undefined
  }
  
  return {
    longitude,
    latitude,
  }
}

/**
 * Парсит принятые меры
 */
function parseMeasures(alertDetails: Element, rootElement?: Element): MeasuresData | undefined {
  console.log('Начинаем парсинг принятых мер')
  
  const measures: SanitaryMeasure[] = []
  const searchElements = rootElement ? [alertDetails, rootElement] : [alertDetails]
  
  for (const searchElement of searchElements) {
    // Пробуем найти через getElementsByTagName
    try {
      const measureElements = searchElement.getElementsByTagName('smcdo:SanitaryMeasureBaseDetails')
      console.log('Найдено мер через getElementsByTagName:', measureElements.length)
      
      for (let i = 0; i < measureElements.length; i++) {
        const el = measureElements[i]
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
        const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        
        if (localName === 'sanitarymeasurebasedetails') {
          const measure = parseSanitaryMeasure(el)
          if (measure) {
            measures.push(measure)
          }
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
  const description = getTextContent(measureElement, 'DescriptionText') || undefined
  const startDate = getTextContent(measureElement, 'StartDate') || undefined
  const endDate = getTextContent(measureElement, 'EndDate') || undefined
  const measureAffectedObjectKindCode = getTextContent(measureElement, 'MeasureAffectedObjectKindCode') || undefined
  
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
  
  // AnyDetails (XML)
  const xmlDocument = getTextContent(docElement, 'AnyDetails') || undefined
  
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
  const country = getTextContent(implElement, 'UnifiedCountryCode') || undefined
  const startDate = getTextContent(implElement, 'StartDate') || undefined
  const endDate = getTextContent(implElement, 'EndDate') || undefined
  const description = getTextContent(implElement, 'DescriptionText') || undefined
  const measureAffectedObjectKindCode = getTextContent(implElement, 'MeasureAffectedObjectKindCode') || undefined
  
  // UnifiedAuthorityDetails
  const authority = parseUnifiedAuthorityDetails(implElement)
  
  // SubjectDetails
  const subjectDetails = parseSubjectDetails(implElement)
  
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
    authority,
    subjectDetails,
    documentDetails,
    placeDetails,
  }
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
  
  return {
    country: getTextContent(authorityElement, 'UnifiedCountryCode') || undefined,
    authorityId: getTextContent(authorityElement, 'AuthorityId') || undefined,
    authorityName: getTextContent(authorityElement, 'AuthorityName') || undefined,
    authorityBriefName: getTextContent(authorityElement, 'AuthorityBriefName') || undefined,
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
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      if (localName === 'subjectdetails') {
        subjectElement = el
        break
      }
    }
  }
  
  if (!subjectElement) {
    return undefined
  }
  
  // Проверяем, есть ли BusinessEntityName - если есть, то это юрлицо/ИП
  const businessEntityName = getTextContent(subjectElement, 'BusinessEntityName')
  if (businessEntityName) {
    // Это юрлицо/ИП - используем parseOrganizationDetails
    const businessEntity = parseOrganizationDetails(subjectElement)
    if (businessEntity) {
      return { businessEntity }
    }
  } else {
    // Это физлицо
    const country = getTextContent(subjectElement, 'UnifiedCountryCode') || undefined
    const subjectName = getTextContent(subjectElement, 'SubjectName') || undefined
    
    // IdentityDocV3Details
    const identityDoc = parseIdentityDocDetails(subjectElement)
    
    // Адреса
    const registrationAddress = parseAddress(subjectElement, '1')
    const actualAddress = parseAddress(subjectElement, '2')
    const mailingAddress = parseAddress(subjectElement, '3')
    
    // Контакты
    const contacts = parseContacts(subjectElement)
    
    return {
      country,
      subjectName,
      identityDoc,
      registrationAddress,
      actualAddress,
      mailingAddress,
      contacts,
    }
  }
  
  return undefined
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
  
  return {
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
  
  return {
    docKindCode,
    docKindCodeListId,
    docName,
    docId,
    docCreationDate,
    docStartDate,
  }
}

/**
 * Парсит MeasurePlaceDetails
 */
function parseMeasurePlaceDetails(parent: Element): MeasurePlaceDetails | undefined {
  const regionName = getTextContent(parent, 'RegionName') || undefined
  const borderCheckpointCode = getTextContent(parent, 'BorderCheckpointCode') || undefined
  const borderCheckpointName = getTextContent(parent, 'BorderCheckpointName') || undefined
  
  if (!regionName && !borderCheckpointCode && !borderCheckpointName) {
    return undefined
  }
  
  return {
    regionName,
    borderCheckpointCode,
    borderCheckpointName,
  }
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
      if (!exists) {
        warnings.push(`Код вида уведомления "${codeToValidate}" не найден в справочнике INCIDENTALERTKIND`)
      } else {
        console.log(`Код вида уведомления "${codeToValidate}" успешно найден в справочнике`)
      }
    } catch (error) {
      console.error('Ошибка при валидации вида уведомления:', error)
      warnings.push(`Не удалось проверить код вида уведомления "${codeToValidate}" в справочнике`)
    }
  } else {
    warnings.push('Код вида уведомления (INCIDENTALERTKINDCODE) не указан в XML')
  }

  return {
    cardData,
    validationErrors: errors,
    validationWarnings: warnings,
  }
}

