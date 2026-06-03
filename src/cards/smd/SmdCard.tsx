import { useState, useEffect, useMemo, useCallback } from 'react'
import { Tabs, Button, Space, message, Modal } from 'antd'
import type { CardData, StatusHistoryItem } from '@/types/card'
import type { SmdMetadata } from '@/types/smdCard'
import { CardActions } from '@/cards/shared'
import SmdCardHeader from './SmdCardHeader'
import SmdSanitaryMeasureTab from './tabs/SmdSanitaryMeasureTab'
import SmdMeasuresTab from './tabs/SmdMeasuresTab'
import SmdProductsTab from './tabs/SmdProductsTab'
import SmdDiseaseTab from './tabs/SmdDiseaseTab'
import SmdInfoRequestsTab from './tabs/SmdInfoRequestsTab'
import SmdReviewResultsTab from './tabs/SmdReviewResultsTab'
import { fetchSmdStatusHistory, fetchSmdXml } from './smdApi'
import { validateSmdCardXml } from './smdValidation'
import {
  incomingSmdStatusButton,
  outgoingSmdStatusButton,
  smdCloseCardButton,
  isSmdIncomingSource,
  isSmdOutgoingSource,
} from './smdStatusButtonConfig'
import StatusHistoryModal from '@/components/modals/dpa/StatusHistoryModal'
import ValidationResultModal from '@/components/modals/dpa/ValidationResultModal'
import { checkAccessRight, fetchRightsByGuidRaw } from '@/utils/referenceDataApi'
import type { ValidationResult } from '@/utils/cardValidation'
import { useParentActivityPing } from '@/hooks/shared/useParentActivityPing'
import { postMessageFromCardToParent } from '@/utils/parentPostMessage'

interface SmdCardProps {
  data: CardData
  meta: SmdMetadata
  smdid?: string
  guid?: string
  /** XML из SMDXML (для «Валидация карты» без повторного запроса). */
  xmlBody?: string | null
  onCardDeleted?: () => void
}

const SmdCard: React.FC<SmdCardProps> = ({ data, meta, smdid, guid, xmlBody, onCardDeleted }) => {
  const [editedData, setEditedData] = useState<CardData>(data)
  const [isEditMode, setIsEditMode] = useState(false)
  const [statusHistoryVisible, setStatusHistoryVisible] = useState(false)
  const [statusHistoryModalData, setStatusHistoryModalData] = useState<StatusHistoryItem[]>([])
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false)
  const [hasAccessRight, setHasAccessRight] = useState(false)
  const [hasEditRight, setHasEditRight] = useState(false)
  const [hasSendRight, setHasSendRight] = useState(false)
  const [validationModalVisible, setValidationModalVisible] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)

  useParentActivityPing()

  useEffect(() => {
    setEditedData(data)
    setIsEditMode(false)
  }, [data])

  const effectiveSmdid = (smdid ?? '').trim()
  const hasPersisted = effectiveSmdid.length > 0 && effectiveSmdid !== '-'
  const isIncoming = isSmdIncomingSource(meta.dataSourceKindName ?? data.source, meta.dataSourceKindCode)
  const isOutgoing = isSmdOutgoingSource(meta.dataSourceKindName ?? data.source, meta.dataSourceKindCode)
  const isEec = String(meta.dataSourceKindCode ?? '').trim() === '3'

  const currentData = isEditMode ? editedData : data

  useEffect(() => {
    if (!guid?.trim()) {
      setHasAccessRight(false)
      setHasEditRight(false)
      setHasSendRight(false)
      return
    }
    const g = guid.trim()
    void (async () => {
      try {
        const [access, edit, send] = await Promise.all([
          checkAccessRight(g, 'sanitaryMeasureOut:access'),
          checkAccessRight(g, 'sanitaryMeasureOut:edit'),
          checkAccessRight(g, 'sanitaryMeasureOut:send'),
        ])
        setHasAccessRight(access)
        setHasEditRight(edit)
        setHasSendRight(send)
      } catch {
        setHasAccessRight(false)
        setHasEditRight(false)
        setHasSendRight(false)
      }
    })()
  }, [guid])

  const showEditButton = isOutgoing && !isEec && hasEditRight
  const showValidationButton = isOutgoing && !isEec

  const statusButton = useMemo(() => {
    if (isEec) return null
    const code = meta.smdStatusCode ?? undefined
    if (isIncoming) return incomingSmdStatusButton(code)
    if (isOutgoing) return outgoingSmdStatusButton(code)
    return null
  }, [isEec, isIncoming, isOutgoing, meta.smdStatusCode])

  const closeButton = smdCloseCardButton()

  const handleStatusClick = () => {
    if (!hasPersisted) {
      message.info('История статусов доступна после сохранения карты')
      return
    }
    setStatusHistoryVisible(true)
    setStatusHistoryLoading(true)
    fetchSmdStatusHistory(effectiveSmdid, guid)
      .then(setStatusHistoryModalData)
      .catch((e) => {
        message.error(e instanceof Error ? e.message : 'Ошибка загрузки истории')
        setStatusHistoryModalData([])
      })
      .finally(() => setStatusHistoryLoading(false))
  }

  const handleStatusAction = (action: string) => {
    if (action === 'close_card') {
      postMessageFromCardToParent({ type: 'close_card' })
      return
    }
    message.info(`Действие «${action}» для SMD будет реализовано в следующей итерации`)
  }

  const resolveXmlForValidation = useCallback(async (): Promise<string | null> => {
    const cached = (xmlBody ?? '').trim()
    if (cached && !cached.includes('<empty/>')) {
      return cached
    }
    if (!hasPersisted) {
      return null
    }
    try {
      const xml = await fetchSmdXml(effectiveSmdid, guid)
      return xml.trim() || null
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось загрузить XML из БД')
      return null
    }
  }, [xmlBody, hasPersisted, effectiveSmdid, guid])

  const runValidation = async () => {
    setValidating(true)
    try {
      const xml = await resolveXmlForValidation()
      const r = await validateSmdCardXml(xml)
      setValidationResult(r)
      setValidationModalVisible(true)
      if (!r.success) {
        message.warning('Валидация выявила замечания')
      }
    } finally {
      setValidating(false)
    }
  }

  const handleCloseForm = () => {
    postMessageFromCardToParent(
      { code: 'exit' },
      hasPersisted ? 'SMD: закрыть форму' : 'SMD: отменить создание'
    )
  }

  const handleCancelEdit = () => {
    setEditedData(data)
    setIsEditMode(false)
  }

  const handleSave = () => {
    message.info('Сохранение карты SMD в БД (API save) — в следующей итерации; правки в форме пока не записываются в XML.')
  }

  const onCardChange = (next: CardData) => {
    setEditedData(next)
  }

  const tabProps = { editMode: isEditMode, onChange: isEditMode ? onCardChange : undefined }

  const tabItems = [
    {
      key: 'sanitary',
      label: 'Санитарная мера',
      children: <SmdSanitaryMeasureTab data={currentData} {...tabProps} />,
    },
    {
      key: 'implementation',
      label: 'Мероприятия',
      children: <SmdMeasuresTab data={currentData} {...tabProps} />,
    },
    { key: 'products', label: 'Продукция', children: <SmdProductsTab data={currentData} /> },
    { key: 'disease', label: 'Болезнь', children: <SmdDiseaseTab data={currentData} /> },
    {
      key: 'info',
      label: 'Сведения',
      children: <SmdInfoRequestsTab smdid={effectiveSmdid} hasPersisted={hasPersisted} />,
    },
    {
      key: 'review',
      label: 'Результаты рассмотрения',
      children: <SmdReviewResultsTab smdid={effectiveSmdid} hasPersisted={hasPersisted} />,
    },
  ]

  return (
    <div
      className="smd-card pha-card fade-in card-page-layout"
      style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      <div
        className="card-sticky-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          padding: '0 24px 8px',
          isolation: 'isolate',
        }}
      >
        <div className="card-sticky-header-title-row" style={{ marginBottom: 8 }}>
          <span className="card-sticky-header-title" style={{ fontSize: 16, fontWeight: 600 }}>
            Карта сведений о временной санитарной мере
            {hasPersisted ? ` (SMDID ${effectiveSmdid})` : ''}
          </span>
          <Space size="small" wrap>
            {!isEditMode && (
              <>
                {showEditButton && (
                  <Button type="default" onClick={() => setIsEditMode(true)}>
                    Редактировать
                  </Button>
                )}
                {showValidationButton && (
                  <Button onClick={() => void runValidation()} loading={validating}>
                    Валидация карты
                  </Button>
                )}
                <Button onClick={handleCloseForm}>
                  {hasPersisted ? 'Закрыть' : 'Отменить создание'}
                </Button>
              </>
            )}
            {isEditMode && (
              <>
                {showEditButton && (
                  <Button type="primary" onClick={handleSave}>
                    Сохранить
                  </Button>
                )}
                {showValidationButton && (
                  <Button onClick={() => void runValidation()} loading={validating}>
                    Валидация карты
                  </Button>
                )}
                {hasPersisted && (
                  <Button onClick={handleCancelEdit}>Отменить</Button>
                )}
                {!hasPersisted && (
                  <Button onClick={handleCloseForm}>Отменить создание</Button>
                )}
              </>
            )}
          </Space>
        </div>

        <SmdCardHeader meta={meta} onStatusClick={handleStatusClick} />
        <CardActions
          onDefineAccess={
            hasAccessRight && hasPersisted
              ? () => message.info('Модальное окно доступа SMD — в разработке')
              : undefined
          }
          onOpenAllVersions={
            hasPersisted
              ? () =>
                  message.info(
                    'Реестр всех версий SMD — подключите URL реестра (фильтр: страна, номер, дата документа)'
                  )
              : undefined
          }
          statusButton={statusButton}
          closeButton={closeButton}
          onStatusAction={handleStatusAction}
          onElectronicDocumentClick={() => message.info('Электронные документы SMD — в разработке')}
          showDeleteButton={isOutgoing && hasEditRight && hasPersisted}
          onDelete={() => {
            message.info('Удаление карты SMD — в разработке')
            onCardDeleted?.()
          }}
          showCopyButton={isOutgoing && hasPersisted}
          onCopy={() => message.info('Создание новой версии SMD — в разработке')}
          nextToStatusButtons={
            <>
              {isOutgoing && hasSendRight && hasPersisted && (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => message.info('Направление сведений — в разработке')}
                >
                  Направить сведения
                </Button>
              )}
              {isIncoming && hasPersisted && (
                <Button
                  size="small"
                  onClick={() => message.info('Завершение обработки — в разработке')}
                >
                  Завершить обработку
                </Button>
              )}
            </>
          }
          onShowRightsDebug={
            import.meta.env.DEV && guid
              ? () => {
                  void fetchRightsByGuidRaw(guid).then((t) => {
                    Modal.info({ title: 'Права (JSON)', content: t.slice(0, 8000), width: 720 })
                  })
                }
              : undefined
          }
        />
      </div>

      <div style={{ padding: '0 24px 16px', flex: 1 }}>
        <Tabs defaultActiveKey="sanitary" items={tabItems} style={{ marginTop: 8 }} />
      </div>

      <StatusHistoryModal
        visible={statusHistoryVisible}
        loading={statusHistoryLoading}
        data={statusHistoryModalData}
        onClose={() => setStatusHistoryVisible(false)}
      />
      <ValidationResultModal
        visible={validationModalVisible}
        result={validationResult}
        onClose={() => {
          setValidationModalVisible(false)
          setValidationResult(null)
        }}
      />
    </div>
  )
}

export default SmdCard
