import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Typography, Tabs, Descriptions, Button, Space, message, Modal } from 'antd'
import type { SmrPrepareContext, SmrResultDocRow } from '@/types/smrCard'
import type { MeasureImplementationItem } from '@/types/card'
import {
  fetchRightsByGuid,
  getSmrAuthorityFilterDepIdsFromRights,
} from '@/utils/referenceDataApi'
import { postSmrCreateSave } from '@/cards/smr/smrApi'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import SaveBlockingErrorsModal from '@/components/modals/SaveBlockingErrorsModal'
import { CardActions } from '@/cards/shared'
import { SmrRespondingAuthorityEdit } from '@/cards/smr/SmrRespondingAuthorityEdit'
import { SmrResultDocumentsEdit } from '@/cards/smr/SmrResultDocumentsEdit'
import { SmrMeasureImplementationEdit } from '@/cards/smr/SmrMeasureImplementationEdit'
import { DprResultDescriptionField } from '@/cards/dpr/DprResultDescriptionField'
import { exportSmrParsedBundleToXml } from '@/utils/xmlExporter'
import { buildSmrCreateBundle } from '@/cards/smr/smrCreateBundle'
import { SmrSourceMeasureCardView } from '@/cards/smr/SmrSourceMeasureCardView'
import { formatSmrCountryName, SMR_SOURCE_MEASURE_CARD_TITLE } from '@/cards/smr/smrDisplayUtils'
import { smrValidationReportContent } from '@/cards/smr/smrValidationReportContent'
import {
  collectSmrFormatValidationErrors,
  collectSmrSaveLogicalErrors,
  validateSmrOutgoingCardFull,
} from '@/utils/smrCardValidation'
import { buildSmdCardViewUrl } from '@/utils/smrCardUrl'

const CARD_STICKY_HEADER_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  background: '#ffffff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  padding: '0 24px 2px 24px',
  isolation: 'isolate',
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  maxHeight: '100vh',
  overflow: 'hidden',
}

const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')

function dash(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t || '—'
}

function utf8ToBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}

export interface SmrCreateCardProps {
  eligibility: SmrPrepareContext
  smdid: string
  guid: string
}

export function SmrCreateCard({ eligibility, smdid, guid }: SmrCreateCardProps) {
  const { countryOptions } = useCountryOptions()
  const [saving, setSaving] = useState(false)
  const [validateLoading, setValidateLoading] = useState(false)
  const [authEdit, setAuthEdit] = useState({
    country: 'BY',
    authorityUid: undefined as string | undefined,
    authorityDbId: undefined as number | undefined,
    name: '',
    shortName: '',
  })
  const [authorityFilterDepIds, setAuthorityFilterDepIds] = useState<string[] | null>(null)
  const [descriptionText, setDescriptionText] = useState('')
  const [implementationsEdit, setImplementationsEdit] = useState<MeasureImplementationItem[]>([])
  const [documentsEdit, setDocumentsEdit] = useState<SmrResultDocRow[]>([])
  const [saveBlockingErrorsVisible, setSaveBlockingErrorsVisible] = useState(false)
  const [saveBlockingErrors, setSaveBlockingErrors] = useState<string[]>([])

  const rc = eligibility.responseCountryCode ?? 'BY'
  const rn = eligibility.responseCountryName ?? ''
  const responseCountryDisplay = formatSmrCountryName(rc, countryOptions, rn)

  const docCc = eligibility.docCountryCode ?? ''
  const docId = eligibility.docId ?? ''
  const sourceDocLabel = [docCc, docId].filter(Boolean).join(' ') || '—'

  useEffect(() => {
    setAuthEdit((prev) => ({ ...prev, country: rc || prev.country || 'BY' }))
  }, [rc])

  useEffect(() => {
    if (!guid?.trim()) {
      setAuthorityFilterDepIds(null)
      return
    }
    let cancelled = false
    fetchRightsByGuid(guid.trim())
      .then((rights) => {
        if (!cancelled) {
          setAuthorityFilterDepIds(getSmrAuthorityFilterDepIdsFromRights(rights))
        }
      })
      .catch(() => {
        if (!cancelled) setAuthorityFilterDepIds([])
      })
    return () => {
      cancelled = true
    }
  }, [guid])

  const goBackToSmd = useCallback(() => {
    window.location.href = `${buildSmdCardViewUrl(smdid, guid.trim())}?tab=review`
  }, [smdid, guid])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const bundle = buildSmrCreateBundle(
        eligibility,
        authEdit,
        descriptionText,
        implementationsEdit,
        documentsEdit
      )
      const blockingErrors = [
        ...collectSmrFormatValidationErrors(bundle),
        ...collectSmrSaveLogicalErrors(bundle),
      ]
      if (blockingErrors.length > 0) {
        setSaveBlockingErrors(blockingErrors)
        setSaveBlockingErrorsVisible(true)
        return
      }
      const xml = exportSmrParsedBundleToXml(bundle)
      const resolvedAuthorityId =
        authEdit.authorityUid?.trim() ||
        (authEdit.authorityDbId != null ? String(authEdit.authorityDbId) : undefined)
      const { smrId } = await postSmrCreateSave({
        guid: guid.trim(),
        smdid,
        smrXmlB64: utf8ToBase64(xml),
        authorityId: resolvedAuthorityId,
        authorityName: authEdit.name.trim() || undefined,
        authorityBriefName: authEdit.shortName.trim() || undefined,
        descriptionText: descriptionText.trim() || undefined,
      })
      if (!smrId) throw new Error('Пустой SMRID в ответе сервера')
      window.location.replace(`${BASE_URL}${smrId}/${encodeURIComponent(guid.trim())}`)
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [guid, smdid, eligibility, authEdit, descriptionText, implementationsEdit, documentsEdit])

  const handleValidate = useCallback(async () => {
    setValidateLoading(true)
    try {
      const bundle = buildSmrCreateBundle(
        eligibility,
        authEdit,
        descriptionText,
        implementationsEdit,
        documentsEdit
      )
      const xml = exportSmrParsedBundleToXml(bundle)
      const vr = await validateSmrOutgoingCardFull(bundle, xml)
      if (!vr.success) {
        Modal.info({
          title: 'Результат валидации карты',
          width: 640,
          content: (
            <div>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                Обнаружены замечания по результатам контроля:
              </Typography.Paragraph>
              {smrValidationReportContent(vr)}
            </div>
          ),
        })
      } else {
        message.success('Все контроли пройдены успешно.')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка валидации карты')
    } finally {
      setValidateLoading(false)
    }
  }, [eligibility, authEdit, descriptionText, implementationsEdit, documentsEdit])

  const draftName = eligibility.draftSmrStatusName ?? 'Черновик'
  const measureDocView = {
    country: docCc || undefined,
    docId: docId || undefined,
    docCreationDate: eligibility.docCreationDate?.slice(0, 10) || undefined,
  }
  return (
    <div
      style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      className="fade-in card-page-layout"
    >
      <div className="card-sticky-header" style={CARD_STICKY_HEADER_STYLE}>
        <div className="card-sticky-header-title-row">
          <span className="card-sticky-header-title">
            Создание карты результатов рассмотрений
          </span>
          <Space size="small" wrap>
            <Button type="primary" onClick={() => void handleSave()} loading={saving} disabled={validateLoading}>
              Сохранить
            </Button>
            <Button
              type="default"
              loading={validateLoading}
              disabled={saving}
              onClick={() => void handleValidate()}
            >
              Валидация карты
            </Button>
            <Button onClick={goBackToSmd} disabled={saving || validateLoading}>
              Отменить создание
            </Button>
          </Space>
        </div>
        <Descriptions
          column={{ xxl: 4, xl: 4, lg: 4, md: 3, sm: 2, xs: 1 }}
          bordered
          size="small"
          style={{ margin: 0 }}
          className="card-header-descriptions"
        >
          <Descriptions.Item label="Исходная карта SMD">{sourceDocLabel}</Descriptions.Item>
          <Descriptions.Item label="Страна">{responseCountryDisplay}</Descriptions.Item>
          <Descriptions.Item label="Статус">{draftName}</Descriptions.Item>
          <Descriptions.Item label="Источник">исходящие</Descriptions.Item>
          <Descriptions.Item label="Дата создания">будет присвоена при сохранении</Descriptions.Item>
          <Descriptions.Item label="Дата изменения">будет присвоена при сохранении</Descriptions.Item>
        </Descriptions>
        <CardActions
          statusButton={null}
          closeButton={null}
          onStatusAction={() => {}}
          onElectronicDocumentClick={() => message.info('Электронный документ будет доступен после сохранения карты')}
        />
        <div className="card-tabs-wrapper">
          <Tabs
            defaultActiveKey="notification"
            items={[
              {
                key: 'notification',
                label: 'Уведомление',
                children: (
                  <div style={{ padding: 16 }}>
                    <Typography.Title level={5}>Уполномоченный орган</Typography.Title>
                    <SmrRespondingAuthorityEdit
                      value={{
                        country: authEdit.country || rc || 'BY',
                        authorityUid: authEdit.authorityUid,
                        name: authEdit.name,
                        shortName: authEdit.shortName,
                      }}
                      onChange={(next) =>
                        setAuthEdit({
                          country: next.country,
                          authorityUid: next.authorityUid,
                          authorityDbId: next.authorityDbId,
                          name: next.name,
                          shortName: next.shortName,
                        })
                      }
                      countryDisplay={responseCountryDisplay}
                      isDraft
                      allowedAuthorityIds={authorityFilterDepIds}
                    />
                    <Typography.Title level={5} style={{ marginTop: 24 }}>
                      {SMR_SOURCE_MEASURE_CARD_TITLE}
                    </Typography.Title>
                    <SmrSourceMeasureCardView
                      doc={measureDocView}
                      countryCodeFallback={docCc}
                      docIdFallback={docId}
                      docDateFallback={eligibility.docCreationDate}
                    />
                  </div>
                ),
              },
              {
                key: 'implementations',
                label: 'Мероприятия',
                children: (
                  <div style={{ padding: 16 }}>
                    <SmrMeasureImplementationEdit
                      items={implementationsEdit}
                      onChange={setImplementationsEdit}
                    />
                  </div>
                ),
              },
              {
                key: 'results',
                label: 'Описание результатов',
                children: (
                  <div style={{ padding: 16 }}>
                    <DprResultDescriptionField value={descriptionText} onChange={setDescriptionText} />
                    <Typography.Title level={5}>Документы</Typography.Title>
                    <SmrResultDocumentsEdit documents={documentsEdit} onChange={setDocumentsEdit} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>

      <SaveBlockingErrorsModal
        visible={saveBlockingErrorsVisible}
        errors={saveBlockingErrors}
        onClose={() => setSaveBlockingErrorsVisible(false)}
      />
    </div>
  )
}
