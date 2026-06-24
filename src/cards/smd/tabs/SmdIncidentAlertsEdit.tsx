import { Button, DatePicker, Input, Select, Table } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { CardData, PhaCauseNotificationItem } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useIncidentAlertKindOptions } from '@/hooks/shared/useIncidentAlertKindOptions'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import { getMaxLength } from '@/constants/xsdFieldConstraints'

/** Коды incidentalertkind для SMD (спецификация SS.09). */
const SMD_INCIDENT_KIND_CODES = new Set([
  '1', '2', '3', '4', '7', '8', '10', '11', '13', '14', '16', '17', '19',
])

interface SmdIncidentAlertsEditProps {
  data: CardData
  onChange: (next: CardData) => void
}

const SmdIncidentAlertsEdit: React.FC<SmdIncidentAlertsEditProps> = ({ data, onChange }) => {
  const { getCountrySelectOptions } = useCountryOptions()
  const { getSelectOptions: getKindOptions, loading: loadingKinds } = useIncidentAlertKindOptions()
  const kindOptions = getKindOptions().filter((o) => SMD_INCIDENT_KIND_CODES.has(String(o.value)))

  const list = data.smdIncidentAlerts ?? []

  const isTouched = (row: PhaCauseNotificationItem) =>
    Boolean(
      row.country?.trim() ||
        row.registrationNumber?.trim() ||
        row.type?.trim() ||
        row.formationDate?.trim()
    )

  const isComplete = (row: PhaCauseNotificationItem) =>
    Boolean(
      row.country?.trim() &&
        row.registrationNumber?.trim() &&
        row.type?.trim() &&
        row.formationDate?.trim()
    )

  const fieldError = (
    row: PhaCauseNotificationItem,
    key: keyof PhaCauseNotificationItem
  ): string | undefined => {
    if (!isTouched(row)) return undefined
    const val = row[key]
    return val?.trim() ? undefined : 'Обязательное поле'
  }

  const updateAt = (index: number, field: keyof PhaCauseNotificationItem, value: string) => {
    const next = [...list]
    next[index] = { ...next[index], [field]: value }
    onChange({ ...data, smdIncidentAlerts: next })
  }

  return (
    <div>
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={() =>
          onChange({
            ...data,
            smdIncidentAlerts: [
              ...list,
              { country: 'BY', registrationNumber: '', type: '', formationDate: '' },
            ],
          })
        }
        style={{ marginBottom: 8 }}
      >
        Добавить уведомление
      </Button>
      {list.length > 0 && (
        <Table
          size="small"
          rowKey={(_, i) => String(i)}
          dataSource={list}
          pagination={false}
          scroll={{ x: 880 }}
          onRow={(record) => ({
            style: isTouched(record) && !isComplete(record) ? { backgroundColor: '#fff7e6' } : undefined,
          })}
          columns={[
            {
              title: 'Страна',
              key: 'country',
              width: 200,
              render: (_: unknown, row: PhaCauseNotificationItem, index: number) => {
                const err = fieldError(row, 'country')
                return (
                  <div>
                    <Select
                      size="small"
                      status={err ? 'error' : undefined}
                      value={row.country || undefined}
                      onChange={(v) => updateAt(index, 'country', v ?? '')}
                      options={getCountrySelectOptions()}
                      style={{ width: '100%' }}
                      showSearch
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    />
                    {err ? <div style={{ color: '#ff4d4f', fontSize: 12 }}>{err}</div> : null}
                  </div>
                )
              },
            },
            {
              title: 'Рег. номер',
              key: 'registrationNumber',
              width: 160,
              render: (_: unknown, row: PhaCauseNotificationItem, index: number) => {
                const err = fieldError(row, 'registrationNumber')
                return (
                  <div>
                    <Input
                      size="small"
                      status={err ? 'error' : undefined}
                      value={row.registrationNumber}
                      onChange={(e) => updateAt(index, 'registrationNumber', e.target.value)}
                      maxLength={getMaxLength('phaIncidentId')}
                    />
                    {err ? <div style={{ color: '#ff4d4f', fontSize: 12 }}>{err}</div> : null}
                  </div>
                )
              },
            },
            {
              title: 'Вид',
              key: 'type',
              width: 220,
              render: (_: unknown, row: PhaCauseNotificationItem, index: number) => {
                const err = fieldError(row, 'type')
                return (
                  <div>
                    <Select
                      size="small"
                      status={err ? 'error' : undefined}
                      loading={loadingKinds}
                      value={row.type || undefined}
                      onChange={(v) => updateAt(index, 'type', v ?? '')}
                      options={kindOptions}
                      style={{ width: '100%' }}
                      showSearch
                    />
                    {err ? <div style={{ color: '#ff4d4f', fontSize: 12 }}>{err}</div> : null}
                  </div>
                )
              },
            },
            {
              title: 'Дата',
              key: 'formationDate',
              width: 150,
              render: (_: unknown, row: PhaCauseNotificationItem, index: number) => {
                const err = fieldError(row, 'formationDate')
                return (
                  <div>
                    <DatePicker
                      size="small"
                      format={DATE_DISPLAY_FORMAT}
                      status={err ? 'error' : undefined}
                      value={row.formationDate ? dayjs(row.formationDate.slice(0, 10)) : null}
                      onChange={(d) =>
                        updateAt(index, 'formationDate', d ? d.format('YYYY-MM-DD') : '')
                      }
                      style={{ width: '100%' }}
                    />
                    {err ? <div style={{ color: '#ff4d4f', fontSize: 12 }}>{err}</div> : null}
                  </div>
                )
              },
            },
            {
              title: '',
              key: 'actions',
              width: 90,
              render: (_: unknown, __: PhaCauseNotificationItem, index: number) => (
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    onChange({
                      ...data,
                      smdIncidentAlerts: list.filter((_, i) => i !== index),
                    })
                  }
                >
                  Удалить
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}

export default SmdIncidentAlertsEdit
