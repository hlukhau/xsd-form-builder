import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Typography, Tabs, Descriptions, Button, Space, message, Input, Segmented } from 'antd'
import type { SmaCreateContext, SmaDocRow, SmarResponseKind } from '@/types/smaCard'
import { fetchRightsByGuid, getSmrAuthorityFilterDepIdsFromRights, type RightsJson } from '@/utils/referenceDataApi'
import { postSmaCreateSave } from '@/cards/sma/smaApi'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { CardActions } from '@/cards/shared'
import { SmaAuthorityEdit } from '@/cards/sma/SmaAuthorityEdit'
import { SmaDocumentsEdit } from '@/cards/sma/SmaDocumentsEdit'
import {
  SmarAbsentResponseFields,
  defaultSmarAbsentResponseValue,
  type SmarAbsentResponseValue,
} from '@/cards/sma/SmarAbsentResponseFields'
import { exportSmaParsedBundleToXml } from '@/utils/xmlExporter'
import { buildSmaCreateBundle } from '@/cards/sma/smaCreateBundle'
import { buildSmdCardViewUrl, buildSmaqCardViewUrl } from '@/utils/smaCardUrl'

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
  maxHeight: '20vh',
  overflow: 'auto',
  flexShrink: 0,
}

const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')

function dash(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t || '—'
}

function formatDateRu(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

function utf8ToBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}

function getSmarAuthorityFilterDepIdsFromRights(rights: RightsJson | null | undefined): string[] {
  const edit = rights?.up?.sanitaryMeasureOut?.edit
  if (!edit || typeof edit !== 'object') return []
  return Object.keys(edit).filter((k) => k != null && String(k).trim() !== '')
}

export interface SmaCreateCardProps {
  context: SmaCreateContext
  guid: string
}

export function SmaCreateCard({ context, guid }: SmaCreateCardProps) {
  const { getDisplayLabel: countryLabel } = useCountryOptions()
  const [saving, setSaving] = useState(false)
  const [authEdit, setAuthEdit] = useState({
    country: 'BY',
    authorityUid: undefined as string | undefined,
    name: '',
    shortName: '',
  })
  const [authorityFilterDepIds, setAuthorityFilterDepIds] = useState<string[] | null>(null)
  const [descriptionText, setDescriptionText] = useState('')
  const [sanitaryProductTypeCode, setSanitaryProductTypeCode] = useState('')
  const [productName, setProductName] = useState('')
  const [laboratoryTestMethodName, setLaboratoryTestMethodName] = useState('')
  const [documentsEdit, setDocumentsEdit] = useState<SmaDocRow[]>([])
  const [responseKind, setResponseKind] = useState<SmarResponseKind>('info')
  const [absentResponse, setAbsentResponse] = useState<SmarAbsentResponseValue>(defaultSmarAbsentResponseValue)

  const isSmaq = context.kind === 'smaq'
  const isAbsent = !isSmaq && responseKind === 'absent'

  const rc = context.requestCountryCode ?? 'BY'
  const rn = context.requestCountryName ?? ''
  const requestCountryDisplay = rn ? `${rc} — ${rn}` : rc

  const docCc = context.docCountryCode ?? ''
  const docId = context.docId ?? ''
  const docCountryDisplay = docCc ? `${docCc} — ${countryLabel(docCc) || docCc}` : '—'
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
          const depIds = isSmaq
            ? getSmrAuthorityFilterDepIdsFromRights(rights)
            : getSmarAuthorityFilterDepIdsFromRights(rights)
          setAuthorityFilterDepIds(depIds)
        }
      })
      .catch(() => {
        if (!cancelled) setAuthorityFilterDepIds([])
      })
    return () => {
      cancelled = true
    }
  }, [guid, isSmaq])

  const goBack = useCallback(() => {
    if (isSmaq) {
      window.location.href = `${buildSmdCardViewUrl(String(context.smdid), guid.trim())}?tab=info`
    } else if (context.smaqid != null) {
      window.location.href = buildSmaqCardViewUrl(context.smaqid, guid.trim())
    }
  }, [isSmaq, context.smdid, context.smaqid, guid])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const bundle = buildSmaCreateBundle(
        context,
        authEdit,
        isAbsent ? (absentResponse.descriptionText ?? '') : descriptionText,
        documentsEdit,
        {
          sanitaryProductTypeCode,
          productName,
          laboratoryTestMethodName,
          responseKind: isSmaq ? undefined : responseKind,
          eventDateTime: isAbsent ? absentResponse.eventDateTime : undefined,
          processingResultV2Code: isAbsent ? absentResponse.processingResultV2Code : undefined,
        }
      )
      const xml = exportSmaParsedBundleToXml(bundle, { responseKind: isSmaq ? undefined : responseKind })
      const result = await postSmaCreateSave({
        kind: context.kind,
        guid: guid.trim(),
        smdid: isSmaq ? String(context.smdid) : undefined,
        smaqid: !isSmaq && context.smaqid != null ? String(context.smaqid) : undefined,
        smaXmlB64: utf8ToBase64(xml),
        authorityId: authEdit.authorityUid?.trim() || undefined,
        authorityName: authEdit.name.trim() || undefined,
        authorityBriefName: authEdit.shortName.trim() || undefined,
        descriptionText: isAbsent
          ? absentResponse.descriptionText?.trim() || undefined
          : descriptionText.trim() || undefined,
        responseKind: isSmaq ? undefined : responseKind,
      })
      const newId = result.smaqId ?? result.smarId
      if (!newId) throw new Error('Пустой идентификатор в ответе сервера')
      const viewUrl =
        result.kind === 'smar' || context.kind === 'smar'
          ? `${BASE_URL}smar/${newId}/${encodeURIComponent(guid.trim())}`
          : `${BASE_URL}smaq/${newId}/${encodeURIComponent(guid.trim())}`
      window.location.replace(viewUrl)
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [
    guid,
    context,
    authEdit,
    descriptionText,
    documentsEdit,
    sanitaryProductTypeCode,
    productName,
    laboratoryTestMethodName,
    responseKind,
    absentResponse,
    isAbsent,
    isSmaq,
  ])

  const draftName = context.draftStatusName ?? 'Черновик'
  const title = isSmaq
    ? 'Создание карты запроса дополнительных сведений'
    : 'Создание карты ответа на запрос дополнительных сведений'

  const descLabel = isSmaq ? 'Описание запроса' : isAbsent ? 'Описание результата обработки' : 'Описание ответа'

  return (
    <div
      style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      className="fade-in card-page-layout"
    >
      <div className="card-sticky-header" style={CARD_STICKY_HEADER_STYLE}>
        <div className="card-sticky-header-title-row">
          <span className="card-sticky-header-title">{title}</span>
          <Space size="small" wrap>
            <Button type="primary" onClick={() => void handleSave()} loading={saving}>
              Сохранить
            </Button>
            <Button onClick={goBack} disabled={saving}>
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
          {!isSmaq && context.smaqid != null ? (
            <Descriptions.Item label="Запрос SMAQ">
              <Button
                type="link"
                style={{ padding: 0, height: 'auto' }}
                onClick={() => window.location.assign(buildSmaqCardViewUrl(context.smaqid!, guid.trim()))}
              >
                SMAQ {context.smaqid}
              </Button>
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label="Страна запроса">{requestCountryDisplay}</Descriptions.Item>
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
      </div>

      <div className="card-tabs-wrapper" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Tabs
          defaultActiveKey="main"
          items={[
            {
              key: 'main',
              label: 'Сведения',
              children: (
                <div style={{ padding: 16 }}>
                  {!isSmaq ? (
                    <div style={{ marginBottom: 24 }}>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        Вид ответа
                      </Typography.Text>
                      <Segmented
                        value={responseKind}
                        onChange={(v) => {
                          const next = v as SmarResponseKind
                          setResponseKind(next)
                          if (next === 'absent') {
                            setAbsentResponse((prev) => ({
                              ...defaultSmarAbsentResponseValue(),
                              descriptionText: (prev.descriptionText ?? descriptionText.trim()) || null,
                            }))
                          }
                        }}
                        options={[
                          { label: 'Дополнительные сведения', value: 'info' },
                          { label: 'Сведения отсутствуют', value: 'absent' },
                        ]}
                      />
                    </div>
                  ) : null}

                  {!isAbsent ? (
                    <>
                      <Typography.Title level={5}>Уполномоченный орган</Typography.Title>
                      <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="Страна">{requestCountryDisplay}</Descriptions.Item>
                      </Descriptions>
                      <SmaAuthorityEdit
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
                            name: next.name,
                            shortName: next.shortName,
                          })
                        }
                        countryDisplay={requestCountryDisplay}
                        isDraft
                        allowedAuthorityIds={authorityFilterDepIds}
                        roleLabel={
                          isSmaq
                            ? 'Уполномоченный орган, запросивший сведения'
                            : 'Уполномоченный орган, представивший ответ'
                        }
                      />

                      <Typography.Title level={5} style={{ marginTop: 24 }}>
                        Исходная карта сведений о временной санитарной мере
                      </Typography.Title>
                      <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="Страна">{docCountryDisplay}</Descriptions.Item>
                        <Descriptions.Item label="Номер документа">{dash(docId)}</Descriptions.Item>
                        <Descriptions.Item label="Дата документа">
                          {formatDateRu(context.docCreationDate)}
                        </Descriptions.Item>
                      </Descriptions>

                      <Typography.Title level={5}>
                        {isSmaq ? 'Запрос' : 'Ответ на запрос'}
                      </Typography.Title>
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text type="secondary">{descLabel}</Typography.Text>
                        <Input.TextArea
                          value={descriptionText}
                          onChange={(e) => setDescriptionText(e.target.value)}
                          autoSize={{ minRows: 3, maxRows: 12 }}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text type="secondary">Код вида продукции</Typography.Text>
                        <Input
                          value={sanitaryProductTypeCode}
                          onChange={(e) => setSanitaryProductTypeCode(e.target.value)}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text type="secondary">Наименование продукции</Typography.Text>
                        <Input
                          value={productName}
                          onChange={(e) => setProductName(e.target.value)}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text type="secondary">Метод (вид) исследования</Typography.Text>
                        <Input
                          value={laboratoryTestMethodName}
                          onChange={(e) => setLaboratoryTestMethodName(e.target.value)}
                          style={{ marginTop: 4 }}
                        />
                      </div>

                      <Typography.Title level={5}>Документы</Typography.Title>
                      <SmaDocumentsEdit documents={documentsEdit} onChange={setDocumentsEdit} />
                    </>
                  ) : (
                    <>
                      <Typography.Title level={5}>Сведения отсутствуют</Typography.Title>
                      <SmarAbsentResponseFields value={absentResponse} onChange={setAbsentResponse} />
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

export default SmaCreateCard
