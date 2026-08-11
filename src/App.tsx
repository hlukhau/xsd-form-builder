import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { message, Spin } from 'antd'
import { isPhaApp, isPpvApp, isDprApp, isSmdApp, isSmrApp, isSmaApp, getDpaLikeCardSessionKeys } from './cards/config'
import { DangerousProductCard } from './cards/dpa'
import { PhaCard } from './cards/pha'
import { DprCard, DprCreateCard } from './cards/dpr'
import { SmrCard, SmrCreateCard } from './cards/smr'
import { SmaCard, SmaCreateCard } from './cards/sma'
import {
  fetchSmaqCreateEligibility,
  fetchSmarCreateEligibility,
  fetchSmaMetadata,
  fetchSmaXml,
} from './cards/sma/smaApi'
import { eligibilityToCreateContext } from './cards/sma/smaCreateBundle'
import { parseSmaXmlToBundle } from './utils/smaXmlParser'
import type { SmaMetadataView, SmaCreateContext, SmaCardKind } from './types/smaCard'
import { fetchSmrMetadata, fetchSmrXml, fetchSmrSmdIncomingActions } from './cards/smr/smrApi'
import { parseSmrXmlToBundle } from './utils/smrXmlParser'
import type { SmrMetadataView, SmrPrepareContext } from './types/smrCard'
import { SmdCard, fetchSmdMetadata, fetchSmdXml, smdSourceToViewRight, createNewSmdCardData, buildCreateSmdMetadata, ensureSmdCardStructure, parseSmdXmlToCardData } from './cards/smd'
import type { SmdMetadata } from './types/smdCard'
import type { CardData } from './types/card'
import type { DprMetadataView, DprPrepareContext } from './types/dprCard'
import {
  fetchDpaXml,
  fetchDpaMetadata,
  fetchNextRegistrationNumber,
  fetchPhaNextRegistrationNumber,
  checkAccessRight,
  phaSourceToViewRight,
  setReferenceGuidContext,
  getPersistedReferenceGuid,
  changeDpaStatus,
  fetchDprXml,
  fetchDprMetadata,
  fetchDprPpvIncomingActions,
} from './utils/referenceDataApi'
import { fetchPhaXml, fetchPhaMetadata, fetchPhaStatusHistory, postPhaStatus } from './cards/pha/phaApi'
import { isPhaIncomingSource } from './utils/phaStatusButtonConfig'
import { parsePhaXmlToCardData } from './cards/pha/phaXmlParser'
import { parseXMLToCardData, validateAndEnrichCardData, getTextContent } from './utils/xmlParser'
import { parseDprXmlToBundle } from './utils/dprXmlParser'
import { createNewCardData } from './utils/newCardData'

/** После удаления карты: родитель может перегрузить iframe на базовый URL без React state — сохраняем флаг для экрана «Карта успешно удалена». */
const CARD_DELETED_SESSION_KEY = 'xsd-form-builder-card-deleted'

function markCardDeletedInSession() {
  try {
    sessionStorage.setItem(CARD_DELETED_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

function useCardDeletedBanner(location: ReturnType<typeof useLocation>, hasCard: boolean) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (hasCard) {
      setShow(false)
      return
    }
    const fromState = Boolean((location.state as { cardDeleted?: boolean } | null)?.cardDeleted)
    let fromStorage = false
    try {
      if (sessionStorage.getItem(CARD_DELETED_SESSION_KEY) === '1') {
        fromStorage = true
        sessionStorage.removeItem(CARD_DELETED_SESSION_KEY)
      }
    } catch {
      /* ignore */
    }
    setShow(fromState || fromStorage)
  }, [location.state, location.key, hasCard])
  return show
}

// Моковые данные для демонстрации
const mockCardData: CardData = {
  // Метаинформация
  country: 'RU',
  registrationNumber: 'RU-95746-44',
  version: 1,
  source: 'входящие',
  createdAt: '2025-10-10T10:34:00',
  modifiedAt: '2025-10-10T11:45:00',
  status: 'в обработке',
  
  // Электронный документ
  electronicDocument: {
    messageCode: 'P.SS.08.MSG.017',
    documentCode: 'R.SM.SS.08.002',
    documentId: '449733c1-3d73-4bfa-9761-3113ac47eb3a',
    documentDate: '2025-10-10T10:34:00',
    language: 'ru',
    sourceDocumentId: '5ab92646-038c-4654-9f31-dd35e59ea8bc',
    validityPeriod: {
      start: '2025-10-10T10:34:00',
      end: '2026-10-10T10:32:00',
    },
    updateDateTime: '2026-01-05T09:14:00',
  },
  
  // Уведомление
  notification: {
    country: 'RU',
    registrationNumber: 'RU-95746-44',
    type: 'обнаружение продукции, опасной для жизни, здоровья человека и среды его обитания',
    formationDate: '2025-10-09',
    endDate: null,
    authorizedBody: {
      country: 'RU',
      identifier: '',
      name: 'Федеральная служба по надзору в сфере защиты прав потребителей и благополучия человека',
      shortName: '',
    },
  },
  
  // История статусов
  statusHistory: [
    {
      status: 'новое',
      dateTime: '2025-10-10T15:04:00',
      employee: null,
    },
    {
      status: 'в обработке',
      dateTime: '2025-10-11T10:49:00',
      employee: 'А.К. Сидоров',
    },
  ],
  
  // Доступные ЦГЭ
  accessList: [
    { id: '1', name: 'РЦГЭИОЗ' },
    { id: '2', name: 'Брестский областной ЦГЭ и ОЗ' },
    { id: '3', name: 'Полоцкий зональный ЦГЭ' },
  ],
}

function AppContent() {
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [originalXML, setOriginalXML] = useState<string | null>(null)
  const [copyFromDpaid, setCopyFromDpaid] = useState<number | null>(null)
  const [loadByDpaidState, setLoadByDpaidState] = useState<{
    loading: boolean
    error: string | null
  }>({ loading: false, error: null })
  const { dpaid, guid: guidFromRoute } = useParams<{ dpaid: string; guid?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const guid =
    guidFromRoute?.trim() ||
    searchParams.get('guid')?.trim() ||
    undefined

  useEffect(() => {
    setReferenceGuidContext(guid)
  }, [guid])

  useEffect(() => {
    document.title = isPpvApp()
      ? 'Карта сведений о выявленных нарушениях'
      : 'Карта сведений об обнаружении опасной продукции'
  }, [])

  // Режим новой карты: /dpa_card/-/1 — запросить регистрационный номер или открыть форму новой версии (Сделать копию)
  useEffect(() => {
    if (dpaid !== '-') {
      setCopyFromDpaid(null)
      return
    }
    const state = location.state as { newVersionFrom?: number; initialCardData?: CardData } | null
    if (state?.newVersionFrom != null && state?.initialCardData) {
      setCardData(state.initialCardData)
      setCopyFromDpaid(state.newVersionFrom)
      setOriginalXML(null)
      setLoadByDpaidState({ loading: false, error: null })
      return
    }
    setCopyFromDpaid(null)
    const country = searchParams.get('country')?.trim()?.toUpperCase().slice(0, 2) || 'BY'
    let cancelled = false
    setLoadByDpaidState({ loading: true, error: null })
    setCardData(null)
    setOriginalXML(null)
    ;(async () => {
      try {
        const { registrationNumber } = await fetchNextRegistrationNumber(country, guid)
        if (cancelled) return
        const newData = createNewCardData(country, { registrationNumber }, { forPpv: isPpvApp() })
        setCardData(newData)
        setOriginalXML(null)
        setLoadByDpaidState({ loading: false, error: null })
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Не удалось получить регистрационный номер'
          setLoadByDpaidState({ loading: false, error: msg })
          message.error(msg)
        }
      }
    })()
    return () => { cancelled = true }
  }, [dpaid, searchParams, location.state, guid])

  // Загрузка XML по DPAID из БД при открытии /dpa_card/{DPAID}
  useEffect(() => {
    if (!dpaid || dpaid === '-') {
      if (dpaid !== '?') setLoadByDpaidState({ loading: false, error: null })
      return
    }
    let cancelled = false
    setLoadByDpaidState({ loading: true, error: null })
    setCardData(null)
    setOriginalXML(null)

    ;(async () => {
      try {
        const xmlText = await fetchDpaXml(dpaid, guid)
        if (cancelled) return
        const cardData = parseXMLToCardData(xmlText)
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
        let alertDetails: Element | null = null
        const allElements = xmlDoc.getElementsByTagName('*')
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i]
          const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
          if (localName === 'dangerousproductalertdetails') {
            alertDetails = el
            break
          }
        }
        const incidentKindCode = getTextContent(alertDetails, 'IncidentKindCode') || ''
        const validationResult = await validateAndEnrichCardData(cardData, incidentKindCode || undefined)
        if (cancelled) return
        validationResult.validationWarnings.forEach((w) => message.warning(w))
        validationResult.validationErrors.forEach((e) => message.error(e))
        let card = validationResult.cardData
        let incomingMetaForFirstOpen: { datasourceKindCode?: string; dpaStatusId?: number } | null = null
        try {
          const meta = await fetchDpaMetadata(dpaid, guid)
          incomingMetaForFirstOpen = meta
          // УО: идентификатор и страна — из БД (DPA.AUTHORITYID → справочник); наименование и краткое наименование — всегда из XML (csdo:AuthorityName, csdo:AuthorityBriefName)
          const authorityFromDb = (meta.authorityUid != null && meta.authorityUid.trim() !== '')
            ? {
                country: (meta.authorityCountryCode ?? card.notification?.authorizedBody?.country ?? '').trim() || (card.notification?.authorizedBody?.country ?? ''),
                identifier: meta.authorityUid.trim(),
                name: (card.notification?.authorizedBody?.name ?? '').trim() || '',
                shortName: (card.notification?.authorizedBody?.shortName ?? '').trim() || '',
              }
            : undefined
          card = {
            ...card,
            registrationNumber: meta.incidentId ?? card.registrationNumber,
            country: (meta.alertCountryCode ?? meta.alertCountryName ?? card.country).trim() || card.country,
            alertCountryName: meta.alertCountryName ?? card.alertCountryName,
            version: meta.dpaVersion ?? card.version,
            source: meta.datasourceKindName ?? card.source,
            datasourceKindCode: meta.datasourceKindCode ?? card.datasourceKindCode,
            createdAt: meta.creationDateTime ?? card.createdAt,
            modifiedAt: meta.modificationDateTime ?? card.modifiedAt,
            status: meta.dpaStatusName ?? card.status,
            statusId: meta.dpaStatusId ?? card.statusId,
            statusCode: meta.ppvStatusCode ?? card.statusCode,
            notification: card.notification
              ? {
                  ...card.notification,
                  authorizedBody: authorityFromDb ?? card.notification.authorizedBody,
                }
              : (authorityFromDb ? { authorizedBody: authorityFromDb } as typeof card.notification : card.notification),
          }
        } catch (e) {
          console.warn('Метаданные VW_DPA не загружены:', e)
        }
        /* DPA входящие: POST first_open, если в метаданных ещё «Получено» (часто DPASTATUSID=1).
           PPV входящие: переход RECEIVED→PROCESSING уже выполняется в одной транзакции с GET /api/ppv/metadata
           (PpvMetadataServlet); здесь повторный first_open не вызываем — после метаданных statusId уже PROCESSING. */
        if (
          !cancelled &&
          !isPpvApp() &&
          incomingMetaForFirstOpen != null &&
          String(incomingMetaForFirstOpen.datasourceKindCode ?? '').trim() === '1' &&
          incomingMetaForFirstOpen.dpaStatusId === 1
        ) {
          try {
            const res = await changeDpaStatus(dpaid, 'first_open', { guid })
            if (res.changed === true && res.newStatus) {
              card = {
                ...card,
                status: res.newStatus,
                statusId: res.newStatusId ?? card.statusId,
              }
            }
          } catch {
            /* автопереход не выполнен — отображаем карту в статусе из метаданных */
          }
        }
        if (!cancelled) {
          setCardData(card)
          setOriginalXML(xmlText)
          setLoadByDpaidState({ loading: false, error: null })
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Ошибка загрузки'
          setLoadByDpaidState({ loading: false, error: msg })
          message.error(msg)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dpaid, guid])

  /** «Сделать копию»: до срабатывания useEffect cardData ещё от предыдущего DPAID — иначе первая отрисовка и автосохранение копии берут старые Дата формирования / Вид из уведомления. */
  const copyRouteState = location.state as { newVersionFrom?: number; initialCardData?: CardData } | null
  const isNewVersionFromCopy =
    dpaid === '-' &&
    copyRouteState?.initialCardData != null &&
    copyRouteState?.newVersionFrom != null
  let dataForCard: CardData | null = cardData
  let copyFromForCard: number | null = copyFromDpaid
  if (isNewVersionFromCopy && copyRouteState.initialCardData) {
    const init = copyRouteState.initialCardData
    copyFromForCard = copyRouteState.newVersionFrom ?? null
    if (
      !cardData ||
      (cardData.registrationNumber === init.registrationNumber &&
        (cardData.version ?? 0) < (init.version ?? 0))
    ) {
      dataForCard = init
    } else {
      dataForCard = cardData
    }
  }

  const showCardDeletedBanner = useCardDeletedBanner(location, !!dataForCard)

  return (
    <div className="app">
      {loadByDpaidState.loading && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin size="large" tip={isPpvApp() ? 'Загрузка XML по PPVID из БД...' : 'Загрузка XML по DPAID из БД...'} />
        </div>
      )}
      {!loadByDpaidState.loading && loadByDpaidState.error && (() => {
        const err = loadByDpaidState.error ?? ''
        const isNotFound =
          /не найден|404|нет доступа/i.test(err) ||
          err.includes('DPAID') ||
          err.includes('PPVID')
        if (isNotFound) {
          return (
            <div className="empty-state">
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📄</div>
              <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959', marginBottom: '8px' }}>
                Карта не найдена
              </div>
              <div style={{ fontSize: '14px', color: '#8c8c8c' }}>
                Запрошенная карта не существует или к ней нет доступа.
              </div>
            </div>
          )
        }
        return (
          <div className="empty-state" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>⚠️</div>
            <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959', marginBottom: '8px' }}>
              Не удалось установить соединение с сервером
            </div>
            <div style={{ fontSize: '14px', color: '#8c8c8c', maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
              Проверьте подключение к сети и доступность сервера. Повторите попытку позже или обратитесь к администратору.
            </div>
          </div>
        )
      })()}
      {!loadByDpaidState.loading && !loadByDpaidState.error && dataForCard && (
        <DangerousProductCard
          key={location.key}
          data={dataForCard}
          onUpdate={setCardData}
          originalXML={originalXML}
          dpaid={dpaid ?? undefined}
          guid={guid ?? undefined}
          copyFromDpaid={copyFromForCard ?? undefined}
          onSaveNewCard={(newDpaid) => {
            try {
              const { lastSavedIdKey, saveHappenedKey } = getDpaLikeCardSessionKeys()
              sessionStorage.setItem(lastSavedIdKey, String(newDpaid))
              sessionStorage.setItem(saveHappenedKey, '1')
            } catch (_) {}
            navigate(`/${newDpaid}/${guid ?? ''}`, { replace: true })
          }}
          onCardDeleted={() => {
            markCardDeletedInSession()
            setCardData(null)
            setOriginalXML(null)
            setLoadByDpaidState({ loading: false, error: null })
            navigate('/', { replace: true, state: { cardDeleted: true } })
          }}
          onMakeCopy={(initialCardData, sourceDpaid) => {
            navigate(`/-/${guid ?? ''}`, { state: { newVersionFrom: sourceDpaid, initialCardData } })
          }}
          autoRunCopyFromUrl={(searchParams.get('command') ?? '').toLowerCase() === 'copy'}
        />
      )}
      {!loadByDpaidState.loading && !loadByDpaidState.error && !dataForCard && (
        <div className="empty-state">
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📄</div>
          <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959', marginBottom: '8px' }}>
            {showCardDeletedBanner ? 'Карта успешно удалена' : 'Нет данных для отображения'}
          </div>
          <div style={{ fontSize: '14px', color: '#8c8c8c' }}>
            {showCardDeletedBanner
              ? 'Вы можете открыть другую карту или создать новую.'
              : 'Выберите карту для просмотра или создайте новую.'}
          </div>
        </div>
      )}
    </div>
  )
}

/** Контент приложения для карты PHA (путь /pha_card/{PHAID}/{GUID}) */
const PHA_COPY_FROM_SESSION_KEY = 'pha_card_copy_from_phaid'

/** Контент приложения для карты SMD (путь /smd_card/{SMDID}/{GUID}) */
const SMD_COPY_FROM_SESSION_KEY = 'smd_card_copy_from_smdid'

function SmdAppContent() {
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [meta, setMeta] = useState<SmdMetadata | null>(null)
  const [createMeta, setCreateMeta] = useState<SmdMetadata | null>(null)
  const [copyFromSmdid, setCopyFromSmdid] = useState<number | null>(null)
  const [smdXmlBody, setSmdXmlBody] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewDenied, setViewDenied] = useState(false)
  const [createDenied, setCreateDenied] = useState(false)
  const { dpaid: smdidParam, guid: guidFromRoute } = useParams<{ dpaid: string; guid?: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const smdid = smdidParam ?? ''
  const guid =
    guidFromRoute?.trim() ||
    searchParams.get('guid')?.trim() ||
    getPersistedReferenceGuid() ||
    undefined

  useEffect(() => {
    setReferenceGuidContext(guid)
  }, [guid])

  useEffect(() => {
    document.title = 'Карта сведений о временной санитарной мере'
  }, [])

  const loadSeqRef = useRef(0)

  useEffect(() => {
    const seq = ++loadSeqRef.current
    if (!smdid) {
      setCardData(null)
      setMeta(null)
      setSmdXmlBody(null)
      setError(null)
      setViewDenied(false)
      setLoading(false)
      return
    }
    if (smdid === '-') {
      const state = location.state as { newVersionFrom?: number; initialCardData?: CardData } | null
      if (state?.newVersionFrom != null && state?.initialCardData) {
        setCardData(state.initialCardData)
        setCopyFromSmdid(state.newVersionFrom)
        setCreateMeta(buildCreateSmdMetadata(state.initialCardData))
        try {
          sessionStorage.setItem(SMD_COPY_FROM_SESSION_KEY, String(state.newVersionFrom))
        } catch {
          /* ignore */
        }
        setMeta(null)
        setSmdXmlBody(null)
        setViewDenied(false)
        setError(null)
        setCreateDenied(false)
        setLoading(false)
        return
      }
      setCopyFromSmdid(null)
      try {
        sessionStorage.removeItem(SMD_COPY_FROM_SESSION_KEY)
      } catch {
        /* ignore */
      }
      setMeta(null)
      setSmdXmlBody(null)
      setViewDenied(false)
      setError(null)
      setCreateDenied(false)
      setLoading(true)
      void (async () => {
        if (guid?.trim()) {
          const allowed = await checkAccessRight(guid.trim(), 'sanitaryMeasureOut:edit')
          if (!allowed) {
            setCreateDenied(true)
            setCardData(null)
            setCreateMeta(null)
            setLoading(false)
            return
          }
        }
        const initial = createNewSmdCardData()
        setCardData(initial)
        setCreateMeta(buildCreateSmdMetadata(initial))
        setLoading(false)
      })()
      return
    }
    setCreateMeta(null)
    setCreateDenied(false)
    setCopyFromSmdid(null)
    try {
      sessionStorage.removeItem(SMD_COPY_FROM_SESSION_KEY)
    } catch {
      /* ignore */
    }
    setLoading(true)
    setError(null)
    setViewDenied(false)
    setCardData(null)
    setMeta(null)
    setSmdXmlBody(null)
    ;(async () => {
      try {
        const [metadata, xmlText] = await Promise.all([
          fetchSmdMetadata(smdid, guid),
          fetchSmdXml(smdid, guid).catch(() => ''),
        ])
        /* Входящие SMD (DATASOURCEKINDCODE=1): переход RECEIVED→PROCESSING выполняется
           в одной транзакции с GET /api/smd/metadata (SmdMetadataServlet). */
        if (seq !== loadSeqRef.current) return
        if (guid?.trim()) {
          const viewRight = smdSourceToViewRight(metadata.dataSourceKindCode ?? metadata.dataSourceKindName)
          const allowed = await checkAccessRight(guid.trim(), viewRight)
          if (!allowed) {
            setViewDenied(true)
            setLoading(false)
            return
          }
        }
        let body = createNewSmdCardData()
        if (xmlText && xmlText.trim() && !xmlText.includes('<empty/>')) {
          try {
            const parsed = parseSmdXmlToCardData(xmlText)
            body = {
              ...body,
              ...parsed,
              statusHistory: body.statusHistory,
              accessList: body.accessList,
              smdProductBatches: parsed.smdProductBatches?.length
                ? parsed.smdProductBatches
                : body.smdProductBatches,
            }
          } catch (parseErr) {
            console.warn('SMD XML parse failed:', parseErr)
          }
        }
        const enriched: CardData = ensureSmdCardStructure({
          ...body,
          country: metadata.docCountryCode ?? body.country,
          registrationNumber: metadata.docId ?? body.registrationNumber,
          version: metadata.smdVersion ?? body.version,
          source: metadata.dataSourceKindName ?? body.source,
          datasourceKindCode: metadata.dataSourceKindCode ?? body.datasourceKindCode,
          createdAt: metadata.creationDateTime ?? body.createdAt,
          modifiedAt: metadata.modificationDateTime ?? body.modifiedAt,
          status: metadata.smdStatusName ?? body.status,
          electronicDocument: {
            ...body.electronicDocument,
            messageCode: metadata.messageCode ?? body.electronicDocument.messageCode,
          },
          notification: body.notification
            ? {
                ...body.notification,
                country: metadata.docCountryCode ?? body.notification.country,
                registrationNumber: metadata.docId ?? body.notification.registrationNumber,
                formationDate: metadata.docCreationDate ?? body.notification.formationDate,
                type: metadata.messageName ?? body.notification.type,
              }
            : body.notification,
          measures: {
            measures: [
              {
                ...(body.measures?.measures?.[0] ?? { languageCode: 'ru' }),
                measureDocDetails: {
                  country: metadata.docCountryCode ?? body.measures?.measures?.[0]?.measureDocDetails?.country ?? 'BY',
                  languageCode: body.measures?.measures?.[0]?.measureDocDetails?.languageCode ?? 'ru',
                  ...body.measures?.measures?.[0]?.measureDocDetails,
                  docId: metadata.docId ?? body.measures?.measures?.[0]?.measureDocDetails?.docId ?? '',
                  docCreationDate:
                    metadata.docCreationDate ??
                    body.measures?.measures?.[0]?.measureDocDetails?.docCreationDate ??
                    '',
                },
              },
              ...(body.measures?.measures?.slice(1) ?? []),
            ],
          },
        })
        setMeta(metadata)
        setCardData(enriched)
        setSmdXmlBody(xmlText?.trim() && !xmlText.includes('<empty/>') ? xmlText : null)
        setLoading(false)
      } catch (err) {
        if (seq !== loadSeqRef.current) return
        const msg = err instanceof Error ? err.message : 'Не удалось загрузить карту SMD'
        setError(msg)
        setLoading(false)
      }
    })()
  }, [smdid, guid, location.key, location.state])

  const isNewVersionFromCopy = smdid === '-' && copyFromSmdid != null && copyFromSmdid > 0

  const showDeleted = useCardDeletedBanner(location, Boolean(cardData && meta))

  if (showDeleted) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959' }}>Карта успешно удалена</div>
      </div>
    )
  }

  if (!smdid) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📄</div>
        <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959' }}>Откройте карту по SMDID</div>
      </div>
    )
  }

  if (viewDenied) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          Нет права на просмотр карты сведений о временной санитарной мере
        </div>
      </div>
    )
  }

  if (createDenied) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          Нет права sanitaryMeasureOut:edit на создание карты сведений о временной санитарной мере
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="large" tip="Загрузка карты SMD..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>{error}</div>
      </div>
    )
  }

  if (cardData && (meta || createMeta)) {
    const displayMeta = meta ?? createMeta!
    return (
      <SmdCard
        key={isNewVersionFromCopy ? `copy-${copyFromSmdid}-${location.key}` : smdid === '-' ? 'new' : smdid}
        data={cardData}
        meta={displayMeta}
        smdid={smdid}
        guid={guid}
        xmlBody={smdXmlBody}
        copyFromSmdid={copyFromSmdid ?? undefined}
        onUpdate={(next) => {
          setCardData(next)
          if (smdid === '-') setCreateMeta(buildCreateSmdMetadata(next, displayMeta.docCountryName))
        }}
        onSaveNewCard={(newSmdid) => {
          navigate(`/${newSmdid}/${guid ?? ''}`, { replace: true })
        }}
        onMakeCopy={(initialCardData, sourceSmdid) => {
          try {
            sessionStorage.setItem(SMD_COPY_FROM_SESSION_KEY, String(sourceSmdid))
          } catch {
            /* ignore */
          }
          navigate(`/-/${guid ?? ''}`, { state: { newVersionFrom: sourceSmdid, initialCardData } })
        }}
        autoRunCopyFromUrl={(searchParams.get('command') ?? '').toLowerCase() === 'copy'}
        onMetaUpdate={setMeta}
        onCardDeleted={() => {
          markCardDeletedInSession()
          setCardData(null)
          setMeta(null)
          setCreateMeta(null)
          setSmdXmlBody(null)
          navigate('/', { replace: true, state: { cardDeleted: true } })
        }}
      />
    )
  }

  return null
}

function PhaAppContent() {
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [originalXML, setOriginalXML] = useState<string | null>(null)
  const [copyFromPhaid, setCopyFromPhaid] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Блокировка просмотра: нет права publicHealthIn/Out/DB:view для источника карты */
  const [viewDenied, setViewDenied] = useState(false)
  const { dpaid: phaidParam, guid: guidFromRoute } = useParams<{ dpaid: string; guid?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const phaid = phaidParam ?? ''
  /** GUID из пути …/{PHAID}/{GUID} или из ?guid= / sessionStorage (как DPA). */
  const guid =
    guidFromRoute?.trim() ||
    searchParams.get('guid')?.trim() ||
    getPersistedReferenceGuid() ||
    undefined
  useEffect(() => {
    setReferenceGuidContext(guid)
  }, [guid])
  /** Счётчик запуска загрузки PHA: не даём Strict Mode / смене deps «отменить» успешный setCardData через cancelled. */
  const phaLoadSeqRef = useRef(0)

  useEffect(() => {
    const seq = ++phaLoadSeqRef.current

    /** Корень приложения без PHAID — как DPA: не запрашиваем номер, экран пустого состояния (в т.ч. «удалена»). */
    if (!phaid) {
      setViewDenied(false)
      setOriginalXML(null)
      setCardData(null)
      setError(null)
      setLoading(false)
      return
    }

    if (phaid === '-') {
      const state = location.state as { newVersionFrom?: number; initialCardData?: CardData } | null
      if (state?.newVersionFrom != null && state?.initialCardData) {
        setCardData(state.initialCardData)
        setCopyFromPhaid(state.newVersionFrom)
        try {
          sessionStorage.setItem(PHA_COPY_FROM_SESSION_KEY, String(state.newVersionFrom))
        } catch (_) {}
        setOriginalXML(null)
        setViewDenied(false)
        setError(null)
        setLoading(false)
        return
      }
      setCopyFromPhaid(null)
      try {
        sessionStorage.removeItem(PHA_COPY_FROM_SESSION_KEY)
      } catch (_) {}
      setViewDenied(false)
      setOriginalXML(null)
      setCardData(null)
      setError(null)
      const country = 'BY'
      setLoading(true)
      ;(async () => {
        try {
          const { registrationNumber } = await fetchPhaNextRegistrationNumber(country, guid)
          if (seq !== phaLoadSeqRef.current) return
          setCardData(createNewCardData(country, { registrationNumber }, { forPha: true }))
          setLoading(false)
        } catch (err) {
          if (seq !== phaLoadSeqRef.current) return
          const msg = err instanceof Error ? err.message : 'Не удалось получить регистрационный номер'
          setError(msg)
          setLoading(false)
          message.error(msg)
        }
      })()
      return
    }
    setCopyFromPhaid(null)
    try {
      sessionStorage.removeItem(PHA_COPY_FROM_SESSION_KEY)
    } catch (_) {}
    setLoading(true)
    setError(null)
    setViewDenied(false)
    setCardData(null)
    setOriginalXML(null)
    ;(async () => {
      try {
        /** XML (PHAXML) + метаданные (PHA, в т.ч. PHAVERSION) — без метаданных версию из БД не показать. */
        const [xmlText, meta] = await Promise.all([fetchPhaXml(phaid, guid), fetchPhaMetadata(phaid, guid)])
        if (seq !== phaLoadSeqRef.current) return
        setOriginalXML(xmlText)
        const card = parsePhaXmlToCardData(xmlText)
        const versionFromPha =
          meta.phaVersion != null && !Number.isNaN(Number(meta.phaVersion)) ? Number(meta.phaVersion) : 1
        let enriched: CardData = {
          ...card,
          version: versionFromPha,
          registrationNumber: meta.incidentId ?? card.registrationNumber,
          country: meta.alertCountryCode ?? card.country,
          alertCountryName: meta.alertCountryName ?? card.alertCountryName,
          source: meta.dataSourceKindName ?? card.source,
          datasourceKindCode: meta.dataSourceKindCode ?? card.datasourceKindCode,
          phaAccessibleDepIds: meta.phaAccessibleDepIds,
          createdAt: meta.creationDateTime ?? card.createdAt,
          modifiedAt: meta.modificationDateTime ?? card.modifiedAt,
          status: meta.phaStatusName ?? card.status,
          statusId: meta.phaStatusId ?? card.statusId,
          notification: card.notification
            ? {
                ...card.notification,
                // Дата закрытия уведомления берётся только из XML PublicHealthAlertDetails/csdo:EndDate.
                // Нельзя подставлять сюда situationEndDate (это иная дата — из блока болезни).
                endDate: card.notification.endDate,
                authorizedBody: card.notification.authorizedBody
                  ? {
                      ...card.notification.authorizedBody,
                      /** UID из БД (PHA.AUTHORITYID), если в XML не было AuthorityId — иначе при сохранении обнулялся PHA.AUTHORITYID */
                      identifier:
                        (card.notification.authorizedBody.identifier ?? '').trim() ||
                        (meta.authorityUid ?? '').trim() ||
                        '',
                    }
                  : card.notification.authorizedBody,
              }
            : card.notification,
        }
        // Если метаданные не вернули текст статуса — взять последний из PHASTATUSHIST только если нет phaStatusId:
        // иначе история может устареть (например «Получено») при актуальном PHA.PHASTATUSID в метаданных.
        const statusTextEmpty = !(enriched.status ?? '').trim()
        const hasStatusIdFromMeta = meta.phaStatusId !== undefined && meta.phaStatusId !== null
        if (statusTextEmpty && !hasStatusIdFromMeta) {
          try {
            const history = await fetchPhaStatusHistory(phaid, guid)
            if (history.length > 0) {
              const latest = history[history.length - 1]
              if (latest?.status?.trim()) enriched = { ...enriched, status: latest.status }
            }
          } catch {
            // история недоступна — оставляем статус пустым
          }
        }
        /* Входящие ЕАЭС (DATASOURCEKINDCODE=1): как у DPA — сначала first_open (Получено→В обработке) и запись в PHASTATUSHIST, затем показ карты. */
        const dscForFirstOpen = String(enriched.datasourceKindCode ?? '').trim()
        if (guid?.trim() && isPhaIncomingSource(enriched.source) && dscForFirstOpen === '1') {
          try {
            const res = await postPhaStatus(phaid, 'first_open', guid)
            if (seq !== phaLoadSeqRef.current) return
            if (res.changed === true && res.newStatus != null) {
              enriched = {
                ...enriched,
                status: res.newStatus,
                statusId: res.newStatusId ?? enriched.statusId,
              }
            }
          } catch {
            /* нет права / ошибка БД — отображаем карту в статусе из метаданных */
          }
        }

        if (seq !== phaLoadSeqRef.current) return
        setCardData(enriched)
        setError(null)
      } catch (err) {
        if (seq !== phaLoadSeqRef.current) return
        setError(err instanceof Error ? err.message : 'Ошибка загрузки')
        message.error(err instanceof Error ? err.message : 'Ошибка загрузки')
      } finally {
        if (seq === phaLoadSeqRef.current) setLoading(false)
      }
    })()
  }, [phaid, guid, searchParams, location.state])

  // Проверка права просмотра PHA по источнику: publicHealthIn:view, publicHealthOut:view, publicHealthDB:view
  useEffect(() => {
    if (!cardData || !phaid || phaid === '-' || !guid?.trim()) {
      setViewDenied(false)
      return
    }
    const viewRight = phaSourceToViewRight(cardData.source ?? '')
    if (!viewRight) {
      setViewDenied(false)
      return
    }
    checkAccessRight(guid, viewRight)
      .then((allowed) => { setViewDenied(!allowed) })
      .catch(() => { setViewDenied(true) })
  }, [cardData, phaid, guid])

  const showCardDeletedBanner = useCardDeletedBanner(location, !!cardData)

  if (loading) return <div style={{ textAlign: 'center', padding: 16 }}><Spin size="large" tip="Загрузка карты PHA..." /></div>
  if (error) return <div className="empty-state"><div style={{ color: '#ff4d4f' }}>{error}</div></div>
  const isNewVersionFromCopy = phaid === '-' && copyFromPhaid != null && copyFromPhaid > 0

  if (viewDenied) return (
    <div className="empty-state">
      <div style={{ color: '#ff4d4f', fontSize: 16 }}>Просмотр невозможен, недостаточно прав</div>
    </div>
  )
  if (cardData) return (
    <PhaCard
      key={isNewVersionFromCopy ? `copy-${copyFromPhaid}-${location.key}` : phaid === '-' ? 'new' : phaid}
      data={cardData}
      phaid={phaid}
      guid={guid}
      copyFromPhaid={copyFromPhaid ?? undefined}
      originalXML={originalXML}
      onUpdate={setCardData}
      onSaveNewCard={(newPhaid) => {
        try {
          sessionStorage.setItem('pha_card_last_saved_phaid', String(newPhaid))
          sessionStorage.setItem('pha_card_save_happened', '1')
        } catch (_) {}
        navigate(`/${newPhaid}/${guid ?? ''}`, { replace: true })
      }}
      onCardDeleted={() => {
        markCardDeletedInSession()
        setCardData(null)
        setOriginalXML(null)
        navigate('/', { replace: true, state: { cardDeleted: true } })
      }}
      onMakeCopy={(initialCardData, sourcePhaid) => {
        try {
          sessionStorage.setItem(PHA_COPY_FROM_SESSION_KEY, String(sourcePhaid))
        } catch (_) {}
        navigate(`/-/${guid ?? ''}`, { state: { newVersionFrom: sourcePhaid, initialCardData } })
      }}
      autoRunCopyFromUrl={(searchParams.get('command') ?? '').toLowerCase() === 'copy'}
    />
  )
  return (
    <div className="empty-state">
      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📄</div>
      <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959', marginBottom: '8px' }}>
        {showCardDeletedBanner ? 'Карта успешно удалена' : 'Нет данных для отображения'}
      </div>
      <div style={{ fontSize: '14px', color: '#8c8c8c' }}>
        {showCardDeletedBanner
          ? 'Вы можете открыть другую карту или создать новую.'
          : 'Откройте карту по PHAID или создайте новую.'}
      </div>
    </div>
  )
}

/** Создание DPR по входящей PPV: /dpr_card/create/{PPVID}/{GUID} */
function DprCreateFromPpvContent() {
  const { ppvid, guid: guidParam } = useParams<{ ppvid: string; guid: string }>()
  const guid = guidParam ? decodeURIComponent(guidParam.trim()) : ''
  const id = (ppvid ?? '').trim()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [elig, setElig] = useState<DprPrepareContext | null>(null)

  useEffect(() => {
    document.title = 'Создание карты сведений о результатах рассмотрения'
  }, [])

  useEffect(() => {
    setReferenceGuidContext(guid || undefined)
  }, [guid])

  useEffect(() => {
    if (!id || !guid) {
      setErr('Укажите PPVID и GUID в URL: /dpr_card/create/{PPVID}/{GUID}')
      setElig(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    setElig(null)
    ;(async () => {
      try {
        const r = await fetchDprPpvIncomingActions(id, guid)
        if (cancelled) return
        if (!r.canPrepareAnswer) {
          setErr(r.prepareAnswerReason || 'Создание карты недоступно')
          setElig(null)
        } else if (r.prepareContext) {
          setElig(r.prepareContext)
        } else {
          setErr(r.prepareAnswerReason || 'Нет контекста создания')
          setElig(null)
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Ошибка проверки условий создания')
          setElig(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, guid])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="large" tip="Проверка условий создания карты DPR..." />
      </div>
    )
  }

  if (err || !elig) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          {err || 'Нет данных'}
        </div>
      </div>
    )
  }

  return <DprCreateCard eligibility={elig} ppvid={id} guid={guid} />
}

/** Карта DPR: /dpr_card/{DPRID}/{GUID} — только просмотр, XML EEC_R_SM_SS_08_DangerousProductAlertResponse. */
function DprAppContent() {
  const { dpaid: dpridParam, guid: guidFromRoute } = useParams<{ dpaid: string; guid?: string }>()
  const [searchParams] = useSearchParams()
  const dprid = (dpridParam ?? '').trim()
  const guid =
    guidFromRoute?.trim() ||
    searchParams.get('guid')?.trim() ||
    getPersistedReferenceGuid() ||
    undefined

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<DprMetadataView | null>(null)
  const [parsed, setParsed] = useState<ReturnType<typeof parseDprXmlToBundle> | null>(null)

  const reloadDprCard = useCallback(async () => {
    const g = guid?.trim()
    if (!g || !/^\d+$/.test(dprid)) return
    const [xmlText, m] = await Promise.all([fetchDprXml(dprid, g), fetchDprMetadata(dprid, g)])
    setMeta(m)
    setParsed(parseDprXmlToBundle(xmlText))
  }, [dprid, guid])

  useEffect(() => {
    setReferenceGuidContext(guid)
  }, [guid])

  useEffect(() => {
    document.title = 'Карта сведений о результатах рассмотрения'
  }, [])

  useEffect(() => {
    if (!dprid) {
      setLoading(false)
      setError(null)
      setMeta(null)
      setParsed(null)
      return
    }
    if (!/^\d+$/.test(dprid)) {
      setLoading(false)
      setError('Некорректный идентификатор карты DPR')
      setMeta(null)
      setParsed(null)
      return
    }
    if (!guid?.trim()) {
      setLoading(false)
      setError('Для просмотра карты DPR укажите GUID в URL: /dpr_card/{DPRID}/{GUID}')
      setMeta(null)
      setParsed(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setMeta(null)
    setParsed(null)
    ;(async () => {
      try {
        const [xmlText, m] = await Promise.all([fetchDprXml(dprid, guid), fetchDprMetadata(dprid, guid)])
        if (cancelled) return
        setMeta(m)
        setParsed(parseDprXmlToBundle(xmlText))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки карты DPR')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dprid, guid])

  if (!dprid) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📄</div>
        <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959' }}>Откройте карту по DPRID</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="large" tip="Загрузка карты DPR..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>{error}</div>
      </div>
    )
  }

  if (meta && parsed) {
    return <DprCard dprid={dprid} guid={guid} meta={meta} parsed={parsed} onDataRefresh={reloadDprCard} />
  }

  return null
}

/** Создание SMR по входящей SMD: /smr_card/create/{SMDID}/{GUID} */
function SmrCreateFromSmdContent() {
  const { smdid, guid: guidParam } = useParams<{ smdid: string; guid: string }>()
  const guid = guidParam ? decodeURIComponent(guidParam.trim()) : ''
  const id = (smdid ?? '').trim()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [elig, setElig] = useState<SmrPrepareContext | null>(null)

  useEffect(() => {
    document.title = 'Создание карты результатов рассмотрений'
  }, [])

  useEffect(() => {
    setReferenceGuidContext(guid || undefined)
  }, [guid])

  useEffect(() => {
    if (!id || !guid) {
      setErr('Укажите SMDID и GUID в URL: /smr_card/create/{SMDID}/{GUID}')
      setElig(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    setElig(null)
    ;(async () => {
      try {
        const r = await fetchSmrSmdIncomingActions(id, guid)
        if (cancelled) return
        if (!r.canPrepareReviewResult) {
          setErr(r.prepareReviewResultReason || 'Создание карты недоступно')
          setElig(null)
        } else if (r.prepareContext) {
          setElig(r.prepareContext)
        } else {
          setErr(r.prepareReviewResultReason || 'Нет контекста создания')
          setElig(null)
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Ошибка проверки условий создания')
          setElig(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, guid])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="large" tip="Проверка условий создания карты SMR..." />
      </div>
    )
  }

  if (err || !elig) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          {err || 'Нет данных'}
        </div>
      </div>
    )
  }

  return <SmrCreateCard eligibility={elig} smdid={id} guid={guid} />
}

/** Карта SMR: /smr_card/{SMRID}/{GUID} — EEC_R_SM_SS_09_SanitaryMeasureConsideration. */
function SmrAppContent() {
  const { dpaid: smrIdParam, guid: guidFromRoute } = useParams<{ dpaid: string; guid?: string }>()
  const [searchParams] = useSearchParams()
  const smrId = (smrIdParam ?? '').trim()
  const guid =
    guidFromRoute?.trim() ||
    searchParams.get('guid')?.trim() ||
    getPersistedReferenceGuid() ||
    undefined

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<SmrMetadataView | null>(null)
  const [parsed, setParsed] = useState<ReturnType<typeof parseSmrXmlToBundle> | null>(null)

  const reloadSmrCard = useCallback(async () => {
    const g = guid?.trim()
    if (!g || !/^\d+$/.test(smrId)) return
    const [xmlText, m] = await Promise.all([fetchSmrXml(smrId, g), fetchSmrMetadata(smrId, g)])
    setMeta(m)
    setParsed(parseSmrXmlToBundle(xmlText))
  }, [smrId, guid])

  useEffect(() => {
    setReferenceGuidContext(guid)
  }, [guid])

  useEffect(() => {
    document.title = 'Карта результатов рассмотрений'
  }, [])

  useEffect(() => {
    if (!smrId) {
      setLoading(false)
      setError(null)
      setMeta(null)
      setParsed(null)
      return
    }
    if (!/^\d+$/.test(smrId)) {
      setLoading(false)
      setError('Некорректный идентификатор карты SMR')
      setMeta(null)
      setParsed(null)
      return
    }
    if (!guid?.trim()) {
      setLoading(false)
      setError('Для просмотра карты SMR укажите GUID в URL: /smr_card/{SMRID}/{GUID}')
      setMeta(null)
      setParsed(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setMeta(null)
    setParsed(null)
    ;(async () => {
      try {
        const [xmlText, m] = await Promise.all([fetchSmrXml(smrId, guid), fetchSmrMetadata(smrId, guid)])
        if (cancelled) return
        setMeta(m)
        setParsed(parseSmrXmlToBundle(xmlText))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки карты SMR')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [smrId, guid])

  if (!smrId) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📄</div>
        <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959' }}>Откройте карту по SMRID</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="large" tip="Загрузка карты SMR..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>{error}</div>
      </div>
    )
  }

  if (meta && parsed) {
    return <SmrCard smrId={smrId} guid={guid} meta={meta} parsed={parsed} onDataRefresh={reloadSmrCard} />
  }

  return null
}

/** Создание SMAQ по SMD: /sma_card/create/smd/{SMDID}/{GUID} */
function SmaCreateFromSmdContent() {
  const { smdid, guid: guidParam } = useParams<{ smdid: string; guid: string }>()
  const guid = guidParam ? decodeURIComponent(guidParam.trim()) : ''
  const id = (smdid ?? '').trim()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ctx, setCtx] = useState<SmaCreateContext | null>(null)

  useEffect(() => {
    document.title = 'Создание карты запроса дополнительных сведений'
  }, [])

  useEffect(() => {
    setReferenceGuidContext(guid || undefined)
  }, [guid])

  useEffect(() => {
    if (!id || !guid) {
      setErr('Укажите SMDID и GUID в URL: /sma_card/create/smd/{SMDID}/{GUID}')
      setCtx(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    setCtx(null)
    ;(async () => {
      try {
        const r = await fetchSmaqCreateEligibility(id, guid)
        if (cancelled) return
        if (!r.allowed) {
          setErr(r.reason || 'Создание карты недоступно')
          setCtx(null)
        } else {
          const c = eligibilityToCreateContext(r)
          if (!c) setErr('Нет контекста создания')
          else setCtx(c)
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Ошибка проверки условий создания')
          setCtx(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, guid])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="large" tip="Проверка условий создания карты SMAQ..." />
      </div>
    )
  }

  if (err || !ctx) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          {err || 'Нет данных'}
        </div>
      </div>
    )
  }

  return <SmaCreateCard context={ctx} guid={guid} />
}

/** Создание SMAR по SMAQ: /sma_card/create/smaq/{SMAQID}/{GUID} */
function SmaCreateFromSmaqContent() {
  const { smaqid, guid: guidParam } = useParams<{ smaqid: string; guid: string }>()
  const guid = guidParam ? decodeURIComponent(guidParam.trim()) : ''
  const id = (smaqid ?? '').trim()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ctx, setCtx] = useState<SmaCreateContext | null>(null)

  useEffect(() => {
    document.title = 'Создание карты ответа на запрос дополнительных сведений'
  }, [])

  useEffect(() => {
    setReferenceGuidContext(guid || undefined)
  }, [guid])

  useEffect(() => {
    if (!id || !guid) {
      setErr('Укажите SMAQID и GUID в URL: /sma_card/create/smaq/{SMAQID}/{GUID}')
      setCtx(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    setCtx(null)
    ;(async () => {
      try {
        const r = await fetchSmarCreateEligibility(id, guid)
        if (cancelled) return
        if (!r.allowed) {
          setErr(r.reason || 'Создание карты недоступно')
          setCtx(null)
        } else {
          const c = eligibilityToCreateContext(r)
          if (!c) setErr('Нет контекста создания')
          else setCtx(c)
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Ошибка проверки условий создания')
          setCtx(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, guid])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="large" tip="Проверка условий создания карты SMAR..." />
      </div>
    )
  }

  if (err || !ctx) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          {err || 'Нет данных'}
        </div>
      </div>
    )
  }

  return <SmaCreateCard context={ctx} guid={guid} />
}

/** Карта SMAQ/SMAR: /sma_card/{smaq|smar}/{ID}/{GUID} */
function SmaAppContent() {
  const location = useLocation()
  const { kind: kindParam, id: idParam, guid: guidFromRoute } = useParams<{
    kind?: string
    id?: string
    guid?: string
  }>()
  const [searchParams] = useSearchParams()
  const kindFromPath = (() => {
    const p = location.pathname.replace(/\/$/, '')
    if (p.includes('/smar/')) return 'smar'
    if (p.includes('/smaq/')) return 'smaq'
    return ''
  })()
  const kind = ((kindParam ?? kindFromPath) || '').trim().toLowerCase() as SmaCardKind
  const cardId = (idParam ?? '').trim()
  const guid =
    guidFromRoute?.trim() ||
    searchParams.get('guid')?.trim() ||
    getPersistedReferenceGuid() ||
    undefined

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<SmaMetadataView | null>(null)
  const [parsed, setParsed] = useState<ReturnType<typeof parseSmaXmlToBundle> | null>(null)

  const reloadSmaCard = useCallback(async () => {
    const g = guid?.trim()
    if (!g || !/^\d+$/.test(cardId) || (kind !== 'smaq' && kind !== 'smar')) return
    const [xmlText, m] = await Promise.all([fetchSmaXml(kind, cardId, g), fetchSmaMetadata(kind, cardId, g)])
    setMeta(m)
    setParsed(parseSmaXmlToBundle(xmlText))
  }, [kind, cardId, guid])

  useEffect(() => {
    setReferenceGuidContext(guid)
  }, [guid])

  useEffect(() => {
    document.title =
      kind === 'smar'
        ? 'Карта ответа на запрос дополнительных сведений'
        : 'Карта запроса дополнительных сведений'
  }, [kind])

  useEffect(() => {
    if (!cardId) {
      setLoading(false)
      setError(null)
      setMeta(null)
      setParsed(null)
      return
    }
    if (kind !== 'smaq' && kind !== 'smar') {
      setLoading(false)
      setError('Укажите вид карты в URL: smaq или smar')
      setMeta(null)
      setParsed(null)
      return
    }
    if (!/^\d+$/.test(cardId)) {
      setLoading(false)
      setError('Некорректный идентификатор карты')
      setMeta(null)
      setParsed(null)
      return
    }
    if (!guid?.trim()) {
      setLoading(false)
      setError(`Для просмотра карты укажите GUID в URL: /sma_card/${kind}/{ID}/{GUID}`)
      setMeta(null)
      setParsed(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setMeta(null)
    setParsed(null)
    ;(async () => {
      try {
        const [xmlText, m] = await Promise.all([
          fetchSmaXml(kind, cardId, guid),
          fetchSmaMetadata(kind, cardId, guid),
        ])
        if (cancelled) return
        setMeta(m)
        setParsed(parseSmaXmlToBundle(xmlText))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки карты')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kind, cardId, guid])

  if (!cardId) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📄</div>
        <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959' }}>
          Откройте карту по SMAQID или SMARID
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="large" tip="Загрузка карты..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <div style={{ color: '#ff4d4f', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>{error}</div>
      </div>
    )
  }

  if (meta && parsed) {
    return (
      <SmaCard
        kind={kind}
        cardId={cardId}
        guid={guid}
        meta={meta}
        parsed={parsed}
        onDataRefresh={reloadSmaCard}
      />
    )
  }

  return null
}

function App() {
  if (isSmaApp()) {
    return (
      <Routes>
        <Route path="/create/smd/:smdid/:guid" element={<SmaCreateFromSmdContent />} />
        <Route path="/create/smaq/:smaqid/:guid" element={<SmaCreateFromSmaqContent />} />
        <Route path="/:kind/:id/:guid" element={<SmaAppContent />} />
        <Route path="/" element={<SmaAppContent />} />
      </Routes>
    )
  }
  if (isSmrApp()) {
    return (
      <Routes>
        <Route path="/create/:smdid/:guid" element={<SmrCreateFromSmdContent />} />
        <Route path="/" element={<SmrAppContent />} />
        <Route path="/:dpaid" element={<SmrAppContent />} />
        <Route path="/:dpaid/:guid" element={<SmrAppContent />} />
      </Routes>
    )
  }
  if (isSmdApp()) {
    return (
      <Routes>
        <Route path="/" element={<SmdAppContent />} />
        <Route path="/:dpaid" element={<SmdAppContent />} />
        <Route path="/:dpaid/:guid" element={<SmdAppContent />} />
      </Routes>
    )
  }
  if (isPhaApp()) {
    return (
      <Routes>
        <Route path="/" element={<PhaAppContent />} />
        <Route path="/:dpaid" element={<PhaAppContent />} />
        <Route path="/:dpaid/:guid" element={<PhaAppContent />} />
      </Routes>
    )
  }
  if (isDprApp()) {
    return (
      <Routes>
        <Route path="/create/:ppvid/:guid" element={<DprCreateFromPpvContent />} />
        <Route path="/" element={<DprAppContent />} />
        <Route path="/:dpaid" element={<DprAppContent />} />
        <Route path="/:dpaid/:guid" element={<DprAppContent />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/:dpaid" element={<AppContent />} />
      <Route path="/:dpaid/:guid" element={<AppContent />} />
    </Routes>
  )
}

export default App

