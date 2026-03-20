import { Form, Input, DatePicker, Select, Button, Table } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { CardData, Notification, PhaCauseNotificationItem } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useIncidentAlertKindOptions } from '@/hooks/shared/useIncidentAlertKindOptions'
import { useAuthorityOptions } from '@/hooks/shared/useAuthorityOptions'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'

/** Коды вида для основного уведомления: версия 1 — 1, 2 (справочник incidentalertkind). */
const MAIN_KIND_CODES_VERSION_1 = ['1', '2']
/** Версия > 1: инфекционная (diseasehealthprobleminfectfl = 1) — 3, 5. */
const MAIN_KIND_CODES_INFECTIOUS = ['3', '5']
/** Версия > 1: неинфекционная (diseasehealthprobleminfectfl = 0) — 4, 6. */
const MAIN_KIND_CODES_NON_INFECTIOUS = ['4', '6']
/** Коды вида для причинных уведомлений (IncidentAlertIdDetails): 1, 2, 3, 4, 7, 8, 10, 11, 13, 14, 16, 17, 19. */
const CAUSE_KIND_CODES = ['1', '2', '3', '4', '7', '8', '10', '11', '13', '14', '16', '17', '19']

interface NotificationTabEditProps {
  data: CardData
  onChange: (data: CardData) => void
  isNewCard?: boolean
}

const NotificationTabEdit: React.FC<NotificationTabEditProps> = ({
  data,
  onChange,
  isNewCard = false,
}) => {
  const [form] = Form.useForm()
  const n = data.notification
  const { getDisplayLabel: getCountryDisplayLabel, getSelectOptions: getCountrySelectOptions } = useCountryOptions()
  const { getSelectOptions: getIncidentAlertKindSelectOptions } = useIncidentAlertKindOptions()
  const authorizedBodyCountryCode = (n.authorizedBody?.country ?? '').trim() || undefined
  const { getSelectOptions: getAuthoritySelectOptions, getAuthorityByUid } = useAuthorityOptions(authorizedBodyCountryCode, true, undefined)
  const [selectedAuthorityUid, setSelectedAuthorityUid] = useState<string | undefined>(n.authorizedBody?.identifier)

  const version = data.version ?? 1
  const isVersion1 = version === 1
  const infectiousFlag = data.phaFirstDiseaseInfectiousFlag
  const mainKindCodes = isVersion1
    ? MAIN_KIND_CODES_VERSION_1
    : infectiousFlag === 1
      ? MAIN_KIND_CODES_INFECTIOUS
      : infectiousFlag === 0
        ? MAIN_KIND_CODES_NON_INFECTIOUS
        : ['3', '4', '5', '6']
  const mainKindOptions = getIncidentAlertKindSelectOptions().filter((o) => mainKindCodes.includes(String(o.value)))
  const causeKindOptions = getIncidentAlertKindSelectOptions().filter((o) => CAUSE_KIND_CODES.includes(String(o.value)))

  useEffect(() => {
    form.setFieldsValue({
      country: n.country,
      registrationNumber: n.registrationNumber,
      type: n.type,
      formationDate: n.formationDate?.trim().slice(0, 10) ? dayjs(n.formationDate.slice(0, 10)) : undefined,
      endDate: n.endDate ? dayjs(n.endDate) : undefined,
    })
    setSelectedAuthorityUid(n.authorizedBody?.identifier)
  }, [n, form])

  useEffect(() => {
    if (!isNewCard) return
    if ((n.country ?? '').trim() !== 'BY') {
      handleNotificationChange({ country: 'BY' })
    }
  }, [isNewCard, n.country])

  useEffect(() => {
    if (!isNewCard) return
    const curId = (n.authorizedBody?.identifier ?? '').trim()
    if (curId === '006' && (n.authorizedBody?.name ?? '').trim() !== '') return
    const a = getAuthorityByUid('006')
    if (!a) {
      if (curId !== '006' || (n.authorizedBody?.country ?? '').trim() !== 'BY') {
        handleNotificationChange({
          authorizedBody: {
            country: 'BY',
            identifier: '006',
            name: n.authorizedBody?.name ?? '',
            shortName: n.authorizedBody?.shortName ?? '',
          },
        })
      }
      return
    }
    handleNotificationChange({
      authorizedBody: {
        country: a.countryCode ?? 'BY',
        identifier: a.uid,
        name: a.name,
        shortName: a.briefName ?? '',
      },
    })
  }, [isNewCard, getAuthorityByUid, n.authorizedBody?.identifier, n.authorizedBody?.name, n.authorizedBody?.country, n.authorizedBody?.shortName])

  const handleNotificationChange = (partial: Partial<Notification>) => {
    onChange({
      ...data,
      notification: { ...data.notification, ...partial },
    })
  }

  const handleAuthoritySelect = (uid: string | null) => {
    if (!uid) {
      setSelectedAuthorityUid(undefined)
      handleNotificationChange({
        authorizedBody: {
          country: n.authorizedBody?.country ?? '',
          identifier: '',
          name: '',
          shortName: '',
        },
      })
      return
    }
    const authority = getAuthorityByUid(uid)
    if (authority) {
      setSelectedAuthorityUid(uid)
      handleNotificationChange({
        authorizedBody: {
          country: authority.countryCode ?? n.authorizedBody?.country ?? '',
          identifier: authority.uid,
          name: authority.name,
          shortName: authority.briefName ?? '',
        },
      })
    }
  }

  const handleFormValuesChange = (_: unknown, all: Record<string, unknown>) => {
    handleNotificationChange({
      country: (all.country as string) ?? n.country,
      registrationNumber: (all.registrationNumber as string) ?? n.registrationNumber,
      type: (all.type as string) ?? n.type,
      formationDate: all.formationDate ? dayjs(all.formationDate as dayjs.Dayjs).format('YYYY-MM-DD') : n.formationDate,
      endDate: all.endDate != null ? (all.endDate ? dayjs(all.endDate as dayjs.Dayjs).format('YYYY-MM-DD') : null) : n.endDate,
    })
  }

  const setInfectiousFlag = (value: 0 | 1 | undefined) => {
    const nextCodes = value === 1 ? MAIN_KIND_CODES_INFECTIOUS : value === 0 ? MAIN_KIND_CODES_NON_INFECTIOUS : ['3', '4', '5', '6']
    const keepType = nextCodes.includes(String(n.type))
    onChange({
      ...data,
      phaFirstDiseaseInfectiousFlag: value,
      notification: { ...data.notification, type: keepType ? n.type : '' },
    })
  }

  const causeList = data.phaCauseNotifications ?? []
  const addCause = () => {
    onChange({
      ...data,
      phaCauseNotifications: [...causeList, { country: 'BY', registrationNumber: '', type: '', formationDate: '' }],
    })
  }
  const removeCause = (index: number) => {
    onChange({
      ...data,
      phaCauseNotifications: causeList.filter((_, i) => i !== index),
    })
  }
  const updateCause = (index: number, field: keyof PhaCauseNotificationItem, value: string) => {
    const next = [...causeList]
    next[index] = { ...next[index], [field]: value }
    onChange({ ...data, phaCauseNotifications: next })
  }

  return (
    <Form form={form} layout="vertical" onValuesChange={handleFormValuesChange}>
      <Form.Item label="Страна" name="country" help="Страна регистрации случая (csdo:UnifiedCountryCode). Справочник стран (country, codeListId=2021).">
        <Select
          showSearch
          placeholder="Выберите страну"
          options={getCountrySelectOptions()}
          disabled={isNewCard}
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      </Form.Item>
      <Form.Item label="Регистрационный номер" name="registrationNumber">
        <Input placeholder="smsdo:IncidentId" readOnly={!!n.registrationNumber} />
      </Form.Item>
      {!isVersion1 && (
        <Form.Item label="Признак инфекционной болезни" help="Версия > 1: от этого зависят допустимые виды (3,5 или 4,6). По XSD: diseasehealthprobleminfectfl.">
          <Select
            placeholder="Выберите (инфекционная / неинфекционная)"
            allowClear
            value={infectiousFlag}
            onChange={(v) => setInfectiousFlag(v as 0 | 1 | undefined)}
            options={[
              { value: 1, label: 'Инфекционная (вид 3, 5)' },
              { value: 0, label: 'Неинфекционная (вид 4, 6)' },
            ]}
            style={{ width: '100%' }}
          />
        </Form.Item>
      )}
      <Form.Item label="Вид" name="type" help={isVersion1 ? 'Версия = 1: значения 1, 2. Справочник incidentalertkind.' : 'Версия > 1: 3, 5 (инфекционная) или 4, 6 (неинфекционная).'}>
        <Select
          showSearch
          placeholder="Вид уведомления (smsdo:IncidentKindCode)"
          options={mainKindOptions}
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      </Form.Item>
      <Form.Item label="Дата формирования" name="formationDate" help="csdo:DocCreationDate. Заполняется текущей при отправке в ЕЭК.">
        <DatePicker format={DATE_DISPLAY_FORMAT} style={{ width: '100%' }} disabled={isNewCard} />
      </Form.Item>
      <Form.Item label="Дата закрытия" name="endDate" help="csdo:EndDate. Заполняется текущей при отправке в ЕЭК уведомления с видом 5 или 6, иначе пусто.">
        <DatePicker format={DATE_DISPLAY_FORMAT} style={{ width: '100%' }} allowClear />
      </Form.Item>

      <div style={{ marginTop: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 4 }}>
        <h4>Уполномоченный орган (ccdo:UnifiedAuthorityDetails)</h4>
        <p style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>Для исходящих данных — справочник УО и КНО стран ЕАЭС (authority).</p>
        <Form.Item label="Страна">
          <Input readOnly value={authorizedBodyCountryCode ? getCountryDisplayLabel(authorizedBodyCountryCode) : '-'} />
        </Form.Item>
        <Form.Item label="Уполномоченный орган">
          <Select
            showSearch
            placeholder="Выберите УО"
            value={selectedAuthorityUid}
            onChange={handleAuthoritySelect}
            allowClear
            disabled={isNewCard}
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            options={getAuthoritySelectOptions()}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="Наименование">
          <Input readOnly value={n.authorizedBody?.name ?? '-'} />
        </Form.Item>
        <Form.Item label="Краткое наименование">
          <Input readOnly value={n.authorizedBody?.shortName ?? '-'} />
        </Form.Item>
      </div>

      <div style={{ marginTop: 24 }}>
        <h4>Информация по уведомлениям, являющимся причиной (smcdo:IncidentAlertIdDetails)</h4>
        <p style={{ fontSize: 12, color: '#8c8c8c' }}>Вид: справочник incidentalertkind — 1, 2, 3, 4, 7, 8, 10, 11, 13, 14, 16, 17, 19.</p>
        <Button type="dashed" icon={<PlusOutlined />} onClick={addCause} style={{ marginBottom: 8 }}>
          Добавить
        </Button>
        {causeList.length > 0 && (
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={causeList}
            pagination={false}
            columns={[
              {
                title: 'Страна',
                dataIndex: 'country',
                key: 'country',
                render: (val: string, __, index) => (
                  <Select
                    size="small"
                    value={val || undefined}
                    onChange={(v) => updateCause(index, 'country', v ?? '')}
                    options={getCountrySelectOptions()}
                    style={{ width: 120 }}
                    showSearch
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                ),
              },
              {
                title: 'Рег. номер',
                dataIndex: 'registrationNumber',
                key: 'registrationNumber',
                render: (val: string, __, index) => (
                  <Input
                    size="small"
                    value={val}
                    onChange={(e) => updateCause(index, 'registrationNumber', e.target.value)}
                  />
                ),
              },
              {
                title: 'Вид',
                dataIndex: 'type',
                key: 'type',
                render: (val: string, __, index) => (
                  <Select
                    size="small"
                    value={val || undefined}
                    onChange={(v) => updateCause(index, 'type', v ?? '')}
                    options={causeKindOptions}
                    style={{ width: 120 }}
                    showSearch
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                ),
              },
              {
                title: 'Дата формирования',
                dataIndex: 'formationDate',
                key: 'formationDate',
                render: (val: string, __, index) => (
                  <Input
                    size="small"
                    type="date"
                    value={val?.slice(0, 10) ?? ''}
                    onChange={(e) => updateCause(index, 'formationDate', e.target.value)}
                  />
                ),
              },
              {
                title: '',
                key: 'action',
                width: 56,
                render: (_, __, index) => (
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeCause(index)} />
                ),
              },
            ]}
          />
        )}
      </div>
    </Form>
  )
}

export default NotificationTabEdit
