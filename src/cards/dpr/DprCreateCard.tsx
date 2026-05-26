import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Typography, Tabs, Descriptions, Button, Input, Space, message } from 'antd'
import type { DprPrepareContext } from '@/types/dprCard'
import {
  getIncidentAlertKindNameByCode,
  postDprCreateSave,
  fetchRightsByGuid,
  getOutgoingAuthorityFilterDepIdsFromRights,
} from '@/utils/referenceDataApi'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { DprNotifyingAuthorityEdit } from '@/cards/dpr/DprNotifyingAuthorityEdit'

const { Text } = Typography

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

function formatDateRu(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

export interface DprCreateCardProps {
  eligibility: DprPrepareContext
  ppvid: string
  guid: string
}

export function DprCreateCard({ eligibility, ppvid, guid }: DprCreateCardProps) {
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
  const [incidentKindLabel, setIncidentKindLabel] = useState<string>('')

  const rc = eligibility.responseCountryCode ?? 'BY'
  const rn = eligibility.responseCountryName ?? ''
  const responseCountryDisplay = rn ? `${rc} — ${rn}` : rc

  const ac = eligibility.alertCountryCode ?? ''
  const alertCountryDisplay = ac ? `${ac} — ${countryLabel(ac) || ac}` : '—'

  useEffect(() => {
    const code = eligibility.incidentKindCode?.trim()
    if (!code) {
      setIncidentKindLabel('')
      return
    }
    let cancelled = false
    getIncidentAlertKindNameByCode(code)
      .then((name) => {
        if (cancelled) return
        setIncidentKindLabel(name?.trim() ? `${code} — ${name}` : code)
      })
      .catch(() => {
        if (!cancelled) setIncidentKindLabel(code)
      })
    return () => {
      cancelled = true
    }
  }, [eligibility.incidentKindCode])

  useEffect(() => {
    if (!guid?.trim()) {
      setAuthorityFilterDepIds(null)
      return
    }
    let cancelled = false
    fetchRightsByGuid(guid.trim())
      .then((rights) => {
        if (!cancelled) {
          setAuthorityFilterDepIds(getOutgoingAuthorityFilterDepIdsFromRights(rights, true))
        }
      })
      .catch(() => {
        if (!cancelled) setAuthorityFilterDepIds([])
      })
    return () => {
      cancelled = true
    }
  }, [guid])

  const goBackToPpv = useCallback(() => {
    const ppvBase = (import.meta.env.VITE_PPV_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/ppv_card'
    window.location.href = `${ppvBase}/${encodeURIComponent(ppvid)}/${encodeURIComponent(guid.trim())}`
  }, [ppvid, guid])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const { dprid } = await postDprCreateSave({
        guid: guid.trim(),
        ppvid,
        authorityName: authEdit.name.trim() || undefined,
        authorityBriefName: authEdit.shortName.trim() || undefined,
        descriptionText: descriptionText.trim() || undefined,
      })
      if (!dprid) throw new Error('Пустой DPRID в ответе сервера')
      message.success('Карта сохранена')
      window.location.replace(`${BASE_URL}${dprid}/${encodeURIComponent(guid.trim())}`)
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [guid, ppvid, authEdit.name, authEdit.shortName, descriptionText])

  const draftName = eligibility.draftDprStatusName ?? 'Черновик'

  return (
    <div
      style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      className="fade-in card-page-layout"
    >
      <div className="card-sticky-header" style={CARD_STICKY_HEADER_STYLE}>
        <div className="card-sticky-header-title-row">
          <span className="card-sticky-header-title">Создание карты сведений о результатах рассмотрения</span>
          <Space size="small" wrap>
            <Button onClick={goBackToPpv}>Отменить создание</Button>
            <Button type="primary" onClick={() => void handleSave()} loading={saving}>
              Сохранить
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
          <Descriptions.Item label="Исходная карта (PPV)">{dash(eligibility.incidentId)}</Descriptions.Item>
          <Descriptions.Item label="Страна">{responseCountryDisplay}</Descriptions.Item>
          <Descriptions.Item label="Статус">{draftName}</Descriptions.Item>
          <Descriptions.Item label="Источник">исходящие</Descriptions.Item>
          <Descriptions.Item label="Дата создания">будет присвоена при сохранении</Descriptions.Item>
          <Descriptions.Item label="Дата изменения">будет присвоена при сохранении</Descriptions.Item>
        </Descriptions>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Черновик: допускается неполный ввод. Обязательные реквизиты шапки и исходной карты подставляются из PPV и
            справочников автоматически при сохранении.
          </Text>
        </div>

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
                  <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="Страна">{responseCountryDisplay}</Descriptions.Item>
                  </Descriptions>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    Уполномоченный орган выбирается из справочника (по правам пользователя). Наименования
                    подставляются автоматически; в черновике поля можно оставить пустыми.
                  </Typography.Paragraph>
                  <DprNotifyingAuthorityEdit
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
                    countryDisplay={responseCountryDisplay}
                    isDraft
                    allowedAuthorityIds={authorityFilterDepIds}
                  />
                  <Typography.Title level={5} style={{ marginTop: 24 }}>
                    Исходная карта сведений о выявленных нарушениях
                  </Typography.Title>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Страна">{alertCountryDisplay}</Descriptions.Item>
                    <Descriptions.Item label="Регистрационный номер">{dash(eligibility.incidentId)}</Descriptions.Item>
                    <Descriptions.Item label="Вид уведомления">
                      {incidentKindLabel || dash(eligibility.incidentKindCode)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Дата формирования">
                      {formatDateRu(eligibility.docCreationDate)}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              ),
            },
            {
              key: 'measures',
              label: 'Принятые меры',
              children: (
                <div style={{ padding: 16 }}>
                  <Typography.Paragraph>
                    В черновике блок «Принятые меры» в XML пока не заполняется (XSD требует расширенной структуры меры).
                    Код языка для мер при полном заполнении будет <strong>ru</strong> (формируется автоматически).
                  </Typography.Paragraph>
                </div>
              ),
            },
            {
              key: 'results',
              label: 'Описание результатов',
              children: (
                <div style={{ padding: 16 }}>
                  <Typography.Title level={5}>Описание результатов рассмотрения</Typography.Title>
                  <Input.TextArea
                    value={descriptionText}
                    onChange={(e) => setDescriptionText(e.target.value)}
                    placeholder="Необязательно для черновика"
                    autoSize={{ minRows: 4, maxRows: 18 }}
                  />
                </div>
              ),
            },
          ]}
        />
        </div>
      </div>
    </div>
  )
}
