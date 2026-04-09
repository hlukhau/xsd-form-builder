import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { message, Spin } from 'antd'
import { isPhaApp } from './cards/config'
import { DangerousProductCard } from './cards/dpa'
import { PhaCard } from './cards/pha'
import type { CardData } from './types/card'
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
} from './utils/referenceDataApi'
import { fetchPhaXml, fetchPhaMetadata, fetchPhaStatusHistory, postPhaStatus } from './cards/pha/phaApi'
import { isPhaIncomingSource } from './utils/phaStatusButtonConfig'
import { parsePhaXmlToCardData } from './cards/pha/phaXmlParser'
import { parseXMLToCardData, validateAndEnrichCardData, getTextContent } from './utils/xmlParser'
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

  // Режим новой карты: /xsd_form_builder/-/1 — запросить регистрационный номер или открыть форму новой версии (Сделать копию)
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
        const newData = createNewCardData(country, { registrationNumber })
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

  // Загрузка XML по DPAID из БД при открытии /xsd_form_builder/{DPAID}
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
        if (
          !cancelled &&
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
          message.success('XML загружен из БД по DPAID')
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
          <Spin size="large" tip="Загрузка XML по DPAID из БД..." />
        </div>
      )}
      {!loadByDpaidState.loading && loadByDpaidState.error && (() => {
        const err = loadByDpaidState.error ?? ''
        const isNotFound = /не найден|404|нет доступа/i.test(err) || err.includes('DPAID')
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
              sessionStorage.setItem('xsd_form_builder_last_saved_dpaid', String(newDpaid))
              sessionStorage.setItem('xsd_form_builder_save_happened', '1')
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

/** Контент приложения для карты PHA (путь /xsd_form_builder_57/{PHAID}/{GUID}) */
function PhaAppContent() {
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [originalXML, setOriginalXML] = useState<string | null>(null)
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
        setOriginalXML(null)
        setViewDenied(false)
        setError(null)
        setLoading(false)
        return
      }
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
        if (seq !== phaLoadSeqRef.current) return
        setCardData(enriched)
        setError(null)
        message.success('Данные карты PHA загружены')
        const dscForFirstOpen = String(enriched.datasourceKindCode ?? '').trim()
        if (guid?.trim() && isPhaIncomingSource(enriched.source) && dscForFirstOpen === '1') {
          postPhaStatus(phaid, 'first_open', guid)
            .then((res) => {
              if (seq !== phaLoadSeqRef.current) return
              if (res.changed && res.newStatus != null) {
                setCardData((prev) =>
                  prev
                    ? {
                        ...prev,
                        status: res.newStatus!,
                        statusId: res.newStatusId ?? prev.statusId,
                      }
                    : prev
                )
              }
            })
            .catch(() => {
              /* нет права / ошибка БД — карта уже отображена */
            })
        }
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
  if (viewDenied) return (
    <div className="empty-state">
      <div style={{ color: '#ff4d4f', fontSize: 16 }}>Просмотр невозможен, недостаточно прав</div>
    </div>
  )
  if (cardData) return (
    <PhaCard
      key={phaid === '-' ? 'new' : phaid}
      data={cardData}
      phaid={phaid}
      guid={guid}
      originalXML={originalXML}
      onUpdate={setCardData}
      onSaveNewCard={(newPhaid) => {
        try {
          sessionStorage.setItem('xsd_form_builder_last_saved_phaid', String(newPhaid))
          sessionStorage.setItem('xsd_form_builder_save_happened', '1')
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
        navigate(`/-/${guid ?? ''}`, { state: { newVersionFrom: sourcePhaid, initialCardData } })
      }}
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

function App() {
  const isPHA = isPhaApp()
  return (
    <Routes>
      <Route path="/" element={isPHA ? <PhaAppContent /> : <AppContent />} />
      <Route path="/:dpaid" element={isPHA ? <PhaAppContent /> : <AppContent />} />
      <Route path="/:dpaid/:guid" element={isPHA ? <PhaAppContent /> : <AppContent />} />
    </Routes>
  )
}

export default App

