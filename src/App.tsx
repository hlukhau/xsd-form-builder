import { useState, useEffect } from 'react'
import { Routes, Route, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { message, Spin } from 'antd'
import DangerousProductCard from './components/card/DangerousProductCard'
import type { CardData } from './types/card'
import { fetchDpaXml, fetchDpaMetadata, fetchNextRegistrationNumber } from './utils/referenceDataApi'
import { parseXMLToCardData, validateAndEnrichCardData, getTextContent } from './utils/xmlParser'
import { createNewCardData } from './utils/newCardData'

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
  const { dpaid, guid } = useParams<{ dpaid: string; guid?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

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
        const { registrationNumber } = await fetchNextRegistrationNumber(country)
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
  }, [dpaid, searchParams, location.state])

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
        const xmlText = await fetchDpaXml(dpaid)
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
        try {
          const meta = await fetchDpaMetadata(dpaid)
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
  }, [dpaid])

  return (
    <div className="app">
      {loadByDpaidState.loading && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin size="large" tip="Загрузка XML по DPAID из БД..." />
        </div>
      )}
      {!loadByDpaidState.loading && loadByDpaidState.error && (
        <div className="empty-state">
          <div style={{ color: '#ff4d4f', marginBottom: 8 }}>Ошибка загрузки по DPAID: {loadByDpaidState.error}</div>
        </div>
      )}
      {!loadByDpaidState.loading && !loadByDpaidState.error && cardData && (
        <DangerousProductCard
          data={cardData}
          onUpdate={setCardData}
          originalXML={originalXML}
          dpaid={dpaid ?? undefined}
          guid={guid ?? undefined}
          copyFromDpaid={copyFromDpaid ?? undefined}
          onSaveNewCard={(newDpaid) => {
            try {
              sessionStorage.setItem('xsd_form_builder_last_saved_dpaid', String(newDpaid))
              sessionStorage.setItem('xsd_form_builder_save_happened', '1')
            } catch (_) {}
            navigate(`/${newDpaid}/${guid ?? ''}`, { replace: true })
          }}
          onCardDeleted={() => {
            setCardData(null)
            setOriginalXML(null)
            navigate('/', { replace: true })
          }}
          onMakeCopy={(initialCardData, sourceDpaid) => {
            navigate(`/-/${guid ?? ''}`, { state: { newVersionFrom: sourceDpaid, initialCardData } })
          }}
        />
      )}
      {!loadByDpaidState.loading && !loadByDpaidState.error && !cardData && (
        <div className="empty-state">
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📄</div>
          <div style={{ fontSize: '18px', fontWeight: 500, color: '#595959', marginBottom: '8px' }}>
            Нет данных для отображения
          </div>
          <div style={{ fontSize: '14px', color: '#8c8c8c' }}>
            Откройте карту по адресу с DPAID (например /-/1 — новая карта, /25 — из БД).
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/:dpaid" element={<AppContent />} />
      <Route path="/:dpaid/:guid" element={<AppContent />} />
    </Routes>
  )
}

export default App

