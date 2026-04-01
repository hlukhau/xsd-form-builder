import { useEffect, useState } from 'react'
import { Form, Input, DatePicker, Select } from 'antd'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import dayjs from 'dayjs'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Notification } from '@/types/card'
import { useIncidentAlertKindOptions } from '@/hooks/shared/useIncidentAlertKindOptions'
import { useAuthorityOptions } from '@/hooks/shared/useAuthorityOptions'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'

export interface NotificationTabEditProps {
  data: Notification
  onChange: (data: Notification) => void
  /** Режим новой карты (/-): подстановка даты формирования и страны УО по умолчанию */
  isNewCard?: boolean
  /** Версия карты: 1 — вид только 7; иначе — 8 и 9 */
  version?: number
  /** Черновик: разрешён выбор уполномоченного органа */
  isDraft?: boolean
  /** Исходящие сведения: список УО ограничен картой прав create */
  isOutgoing?: boolean
  /** DEPID из карт прав (объединённые) — только соответствующие УО в списке (при isOutgoing && isDraft) */
  allowedAuthorityIds?: string[]
}

const VERSION_1_KIND_CODES = ['7']
const OTHER_VERSIONS_KIND_CODES = ['8', '9']

const NotificationTabEdit: React.FC<NotificationTabEditProps> = ({
  data,
  onChange,
  isNewCard,
  version = 1,
  isDraft = false,
  isOutgoing = false,
  allowedAuthorityIds,
}) => {
  const [form] = Form.useForm()
  const { loading: loadingIncidentAlertKinds, getSelectOptions: getIncidentAlertKindSelectOptions } = useIncidentAlertKindOptions()
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const authorizedBodyCountryCode = (data.authorizedBody?.country ?? '').trim() || undefined
  const { options: authorityOptions, loading: loadingAuthorities, getSelectOptions: getAuthoritySelectOptions, getAuthorityByUid } = useAuthorityOptions(
    authorizedBodyCountryCode,
    isOutgoing && isDraft,
    isOutgoing && isDraft ? allowedAuthorityIds : undefined
  )
  
  const [selectedAuthorityUid, setSelectedAuthorityUid] = useState<string | undefined>(undefined)

  // Ограничение видов уведомления по версии: 1 — только 7; иначе — 8 и 9. Сортировка по коду как числу.
  const allowedKindCodes = version === 1 ? VERSION_1_KIND_CODES : OTHER_VERSIONS_KIND_CODES
  const incidentKindSelectOptions = getIncidentAlertKindSelectOptions()
    .filter((opt) => allowedKindCodes.includes(String(opt.value)))
    .sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0))

  // Только дата (yyyy-MM-dd), без времени — для корректного отображения и хранения
  const formationDateOnly = data.formationDate?.trim().slice(0, 10) || undefined

  useEffect(() => {
    const authorityUid = data.authorizedBody?.identifier
    setSelectedAuthorityUid(authorityUid)
    
    form.setFieldsValue({
      registrationNumber: data.registrationNumber,
      type: data.type,
      formationDate: formationDateOnly ? dayjs(formationDateOnly) : undefined,
      endDate: data.endDate ? dayjs(data.endDate) : undefined,
      authorizedBodyCountry: data.authorizedBody?.country ?? '',
    })
  }, [data, form])

  // При создании новой карточки: дата формирования = сегодня, страна УО = BY
  useEffect(() => {
    if (!isNewCard) return
    const today = format(new Date(), 'yyyy-MM-dd')
    const updates: Partial<Notification> = {}
    if (!data.formationDate) updates.formationDate = today
    const country = (data.authorizedBody?.country ?? '').trim()
    if (!country || country !== 'BY') {
      updates.authorizedBody = {
        ...data.authorizedBody,
        country: 'BY',
        identifier: data.authorizedBody?.identifier ?? '',
        name: data.authorizedBody?.name ?? '',
        shortName: data.authorizedBody?.shortName ?? '',
      }
    }
    if (Object.keys(updates).length) {
      onChange({ ...data, ...updates })
    }
  }, [isNewCard, data.formationDate, data.authorizedBody?.country])

  // УО: наименование и краткое наименование всегда из XML (csdo:AuthorityName, csdo:AuthorityBriefName); при выборе из справочника подставляются в форму и при сохранении записываются в XML и DPA.AUTHORITYID

  // Страна УО не редактируется (по умолчанию BY при создании)
  
  // Обработчик выбора уполномоченного органа из справочника
  const handleAuthoritySelect = (uid: string | null) => {
    if (!uid) {
      // Очистка выбора
      setSelectedAuthorityUid(undefined)
      onChange({
        ...data,
        authorizedBody: {
          country: data.authorizedBody?.country || '',
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
      onChange({
        ...data,
        authorizedBody: {
          country: authority.countryCode || data.authorizedBody?.country || '',
          identifier: authority.uid,
          name: authority.name,
          shortName: authority.briefName || '',
        },
      })
    } else {
      // Если орган не найден, всё равно устанавливаем UID (для случая, когда справочник еще загружается)
      setSelectedAuthorityUid(uid)
    }
  }

  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.authorizedBodyCountry || changedValues.authorizedBody ||
        changedValues.authorizedBodyIdentifier || changedValues.authorizedBodyName ||
        changedValues.authorizedBodyShortName) {
      return
    }
    // Регистрационный номер и дата формирования не редактируются
    onChange({
      ...data,
      type: allValues.type ?? data.type,
      endDate: allValues.endDate ? allValues.endDate.format('YYYY-MM-DD') : (allValues.endDate === null ? null : data.endDate),
      authorizedBody: data.authorizedBody,
    })
  }

  const kindSelectControl = (
    <Select
      className="notification-incident-kind-select"
      popupClassName="notification-incident-kind-select-dropdown"
      showSearch
      placeholder="Выберите вид уведомления"
      loading={loadingIncidentAlertKinds}
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      options={incidentKindSelectOptions}
      style={{ width: '100%' }}
    />
  )

  return (
    <Form
      form={form}
      layout="vertical"
      className="field-tag-form"
      onValuesChange={handleValuesChange}
    >
      <Form.Item label="Регистрационный номер" name="registrationNumber">
        <Input readOnly />
      </Form.Item>
      <Form.Item label="Вид" name="type">
        {kindSelectControl}
      </Form.Item>
      <Form.Item label="Дата формирования">
        <Input readOnly value={formationDateOnly ? format(parseISO(formationDateOnly), 'dd.MM.yyyy', { locale: ru }) : ''} />
      </Form.Item>
      <Form.Item label="Дата закрытия" name="endDate">
        <DatePicker format={DATE_DISPLAY_FORMAT} style={{ width: '100%' }} allowClear />
      </Form.Item>
      
      <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
        <h4>Уполномоченный орган</h4>
        <Form.Item label="Страна">
          <Input readOnly value={authorizedBodyCountryCode ? getCountryDisplayLabel(authorizedBodyCountryCode) : '-'} />
        </Form.Item>
        <Form.Item label={labelWithHelp('Выбор уполномоченного органа', FIELD_HELP.authority)}>
          {(() => {
            const allowedOptions = getAuthoritySelectOptions()
            const currentId = data.authorizedBody?.identifier?.trim()
            const currentName = (data.authorizedBody?.name ?? '').trim()
            const currentInList = currentId && allowedOptions.some((o: { value: string }) => String(o.value) === currentId)
            // Если выбранный УО не в списке доступных — добавляем его в опции для отображения наименования; в выпадающем списке при этом остаются только доступные + текущий
            const selectOptions =
              currentId && currentName && !currentInList
                ? [{ value: currentId, label: currentName }, ...allowedOptions]
                : allowedOptions
            return (
              <Select
                showSearch
                placeholder={authorizedBodyCountryCode
                  ? 'Выберите уполномоченный орган'
                  : 'Страна не указана'}
                loading={loadingAuthorities}
                value={selectedAuthorityUid}
                onChange={handleAuthoritySelect}
                allowClear
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={selectOptions}
                disabled={!authorizedBodyCountryCode || !isDraft}
                notFoundContent={loadingAuthorities ? 'Загрузка...' : authorityOptions.length === 0 ? 'Нет данных. Проверьте, что справочник загружен.' : 'Не найдено'}
              />
            )
          })()}
        </Form.Item>
        <Form.Item label="Наименование">
          <Input readOnly value={(data.authorizedBody?.name ?? '').trim() || '-'} />
        </Form.Item>
        <Form.Item label="Идентификатор">
          <Input readOnly value="-" />
        </Form.Item>
        <Form.Item label="Краткое наименование">
          <Input readOnly value={data.authorizedBody?.shortName || ''} />
        </Form.Item>
      </div>
    </Form>
  )
}

export default NotificationTabEdit

