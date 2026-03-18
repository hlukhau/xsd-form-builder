import { Form, Input, DatePicker, Select, Button, Table } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { CardData, Notification, PhaCauseNotificationItem } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useIncidentAlertKindOptions } from '@/hooks/shared/useIncidentAlertKindOptions'
import { useAuthorityOptions } from '@/hooks/shared/useAuthorityOptions'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'

/** Коды вида для основного уведомления: версия 1 — 1,2; версия >1 — 3,4,5,6 (по признаку инфекционности уточняется на бэкенде). */
const MAIN_KIND_CODES_VERSION_1 = ['1', '2']
const MAIN_KIND_CODES_OTHER = ['3', '4', '5', '6']
/** Коды вида для причинных уведомлений (IncidentAlertIdDetails). */
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

  const mainKindCodes = (data.version ?? 1) === 1 ? MAIN_KIND_CODES_VERSION_1 : MAIN_KIND_CODES_OTHER
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
      <Form.Item label="Страна" name="country">
        <Select
          showSearch
          placeholder="Выберите страну"
          options={getCountrySelectOptions()}
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      </Form.Item>
      <Form.Item label="Регистрационный номер" name="registrationNumber">
        <Input readOnly={!!n.registrationNumber} />
      </Form.Item>
      <Form.Item label="Вид уведомления" name="type">
        <Select
          showSearch
          placeholder="Выберите вид"
          options={mainKindOptions}
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      </Form.Item>
      <Form.Item label="Дата формирования" name="formationDate">
        <DatePicker format={DATE_DISPLAY_FORMAT} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="Дата закрытия" name="endDate">
        <DatePicker format={DATE_DISPLAY_FORMAT} style={{ width: '100%' }} allowClear />
      </Form.Item>

      <div style={{ marginTop: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 4 }}>
        <h4>Уполномоченный орган</h4>
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
        <h4>Уведомления, являющиеся причиной</h4>
        <p style={{ fontSize: 12, color: '#8c8c8c' }}>Вид: коды 1, 2, 3, 4, 7, 8, 10, 11, 13, 14, 16, 17, 19</p>
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
