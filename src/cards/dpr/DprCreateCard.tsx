import { useCallback, useEffect, useState } from 'react'
import { Typography, Tabs, Descriptions, Button, Input, Space, message } from 'antd'
import type { DprCreateEligibilityResponse } from '@/types/dprCard'
import { getIncidentAlertKindNameByCode, postDprCreateSave } from '@/utils/referenceDataApi'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'

const { Title, Text } = Typography

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
  eligibility: DprCreateEligibilityResponse
  ppvid: string
  guid: string
}

export function DprCreateCard({ eligibility, ppvid, guid }: DprCreateCardProps) {
  const { getDisplayLabel: countryLabel } = useCountryOptions()
  const [saving, setSaving] = useState(false)
  const [authorityId, setAuthorityId] = useState('')
  const [authorityName, setAuthorityName] = useState('')
  const [authorityBriefName, setAuthorityBriefName] = useState('')
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
        authorityId: authorityId.trim() || undefined,
        authorityName: authorityName.trim() || undefined,
        authorityBriefName: authorityBriefName.trim() || undefined,
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
  }, [guid, ppvid, authorityId, authorityName, authorityBriefName, descriptionText])

  const draftName = eligibility.draftDprStatusName ?? 'Черновик'

  return (
    <div className="dpr-card-root">
      <div className="dpr-card-header">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title level={4} style={{ margin: 0 }}>
              Создание карты сведений о результатах рассмотрения
            </Title>
            <Space>
              <Button onClick={goBackToPpv}>Отменить создание</Button>
              <Button type="primary" onClick={() => void handleSave()} loading={saving}>
                Сохранить
              </Button>
            </Space>
          </Space>
          <Descriptions column={{ xs: 1, sm: 2, md: 4 }} size="small" colon>
            <Descriptions.Item label="Исходная карта (PPV)">{dash(eligibility.incidentId)}</Descriptions.Item>
            <Descriptions.Item label="Страна">{responseCountryDisplay}</Descriptions.Item>
            <Descriptions.Item label="Статус">{draftName}</Descriptions.Item>
            <Descriptions.Item label="Источник">исходящие</Descriptions.Item>
            <Descriptions.Item label="Дата создания">будет присвоена при сохранении</Descriptions.Item>
            <Descriptions.Item label="Дата изменения">будет присвоена при сохранении</Descriptions.Item>
          </Descriptions>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Черновик: допускается неполный ввод. Обязательные реквизиты шапки и исходной карты подставляются из PPV и
            справочников автоматически при сохранении.
          </Text>
        </Space>
      </div>

      <div className="dpr-card-tabs-wrap">
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
                    Необязательно: уточните реквизиты уполномоченного органа (BY). Поля можно оставить пустыми в
                    черновике.
                  </Typography.Paragraph>
                  <Space direction="vertical" style={{ width: '100%', maxWidth: 560 }} size="middle">
                    <div>
                      <Text type="secondary">Идентификатор</Text>
                      <Input value={authorityId} onChange={(e) => setAuthorityId(e.target.value)} placeholder="—" />
                    </div>
                    <div>
                      <Text type="secondary">Наименование</Text>
                      <Input value={authorityName} onChange={(e) => setAuthorityName(e.target.value)} placeholder="—" />
                    </div>
                    <div>
                      <Text type="secondary">Краткое наименование</Text>
                      <Input
                        value={authorityBriefName}
                        onChange={(e) => setAuthorityBriefName(e.target.value)}
                        placeholder="—"
                      />
                    </div>
                  </Space>
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
  )
}
