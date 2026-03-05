import { useEffect, useState } from 'react'
import { Form, Input, DatePicker, Select, Descriptions } from 'antd'
import dayjs from 'dayjs'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Notification } from '@/types/card'
import { useIncidentAlertKindOptions } from '@/hooks/useIncidentAlertKindOptions'
import { useAuthorityOptions } from '@/hooks/useAuthorityOptions'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'

export interface NotificationTabEditProps {
  data: Notification
  onChange: (data: Notification) => void
  /** Режим новой карты: рег. номер, дата формирования только для просмотра; дата формирования и страна УО по умолчанию */
  isNewCard?: boolean
  /** Код страны карты (для отображения в режиме новой карты) */
  cardCountry?: string
  /** Версия карты: 1 — вид только 7; иначе — 7 и 8 */
  version?: number
  /** Черновик: разрешён выбор уполномоченного органа */
  isDraft?: boolean
  /** Исходящие сведения: список УО ограничен ЦГЭ пользователя */
  isOutgoing?: boolean
}

const VERSION_1_KIND_CODES = ['7']
const OTHER_VERSIONS_KIND_CODES = ['7', '8']

const NotificationTabEdit: React.FC<NotificationTabEditProps> = ({
  data, onChange, isNewCard, cardCountry, version = 1, isDraft = false, isOutgoing = false,
}) => {
  const [form] = Form.useForm()
  const { options: incidentAlertKindOptions, loading: loadingIncidentAlertKinds, getSelectOptions: getIncidentAlertKindSelectOptions, getNameByCode: getIncidentAlertKindNameByCode } = useIncidentAlertKindOptions()
  
  const authorizedBodyCountryCode = (data.authorizedBody?.country ?? '').trim() || undefined
  const { options: authorityOptions, loading: loadingAuthorities, getSelectOptions: getAuthoritySelectOptions, getAuthorityByUid } = useAuthorityOptions(authorizedBodyCountryCode, isOutgoing && isDraft)
  
  const [selectedAuthorityUid, setSelectedAuthorityUid] = useState<string | undefined>(undefined)

  // Ограничение видов уведомления по версии: 1 — только 7; иначе — 7 и 8
  const allowedKindCodes = version === 1 ? VERSION_1_KIND_CODES : OTHER_VERSIONS_KIND_CODES
  const incidentKindSelectOptions = getIncidentAlertKindSelectOptions().filter(
    (opt) => allowedKindCodes.includes(String(opt.value))
  )

  useEffect(() => {
    const authorityUid = data.authorizedBody?.identifier
    setSelectedAuthorityUid(authorityUid)
    
    form.setFieldsValue({
      registrationNumber: data.registrationNumber,
      type: data.type,
      formationDate: data.formationDate ? dayjs(data.formationDate) : undefined,
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

  // Заполнение наименования/краткого наименования УО по идентификатору (DPA.AUTHORITYID) из справочника
  useEffect(() => {
    const id = data.authorizedBody?.identifier
    if (!id || (data.authorizedBody?.name && data.authorizedBody?.shortName)) return
    const authority = getAuthorityByUid(id)
    if (authority && (!data.authorizedBody?.name || !data.authorizedBody?.shortName)) {
      onChange({
        ...data,
        authorizedBody: {
          ...data.authorizedBody!,
          name: data.authorizedBody?.name || authority.name,
          shortName: data.authorizedBody?.shortName ?? authority.briefName ?? '',
        },
      })
    }
  }, [data.authorizedBody?.identifier, data.authorizedBody?.name, data.authorizedBody?.shortName, getAuthorityByUid, authorityOptions.length])

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

  const formationDateFormatted = data.formationDate
    ? format(new Date(data.formationDate), 'dd.MM.yyyy', { locale: ru })
    : '-'
  const incidentKindName = getIncidentAlertKindNameByCode(data.type) || ''

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleValuesChange}
    >
      {isNewCard && (
        <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Код страны">
            {cardCountry ?? data.country ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Регистрационный номер">
            {data.registrationNumber}
          </Descriptions.Item>
          <Descriptions.Item label="Вид">
            {data.type ? `${data.type}${incidentKindName ? ` — ${incidentKindName}` : ''}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Дата формирования">
            {formationDateFormatted}
          </Descriptions.Item>
        </Descriptions>
      )}
      {!isNewCard && (
        <>
          <Form.Item label="Регистрационный номер" name="registrationNumber">
            <Input readOnly />
          </Form.Item>
          <Form.Item label="Вид" name="type">
            <Select
              showSearch
              placeholder="Выберите вид уведомления"
              loading={loadingIncidentAlertKinds}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={incidentKindSelectOptions}
            />
          </Form.Item>
          <Form.Item label="Дата формирования" name="formationDate">
            <Input readOnly value={data.formationDate ? format(new Date(data.formationDate), 'dd.MM.yyyy', { locale: ru }) : ''} />
          </Form.Item>
        </>
      )}
      <Form.Item label="Дата закрытия" name="endDate">
        <DatePicker style={{ width: '100%' }} allowClear />
      </Form.Item>
      
      <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
        <h4>Уполномоченный орган</h4>
        <Form.Item label="Страна" name="authorizedBodyCountry">
          <Input readOnly value={authorizedBodyCountryCode || ''} />
        </Form.Item>
        <Form.Item label={labelWithHelp('Уполномоченный орган', FIELD_HELP.authority)}>
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
            options={getAuthoritySelectOptions()}
            disabled={!authorizedBodyCountryCode || !isDraft}
            notFoundContent={loadingAuthorities ? 'Загрузка...' : authorityOptions.length === 0 ? 'Нет данных. Проверьте, что справочник загружен.' : 'Не найдено'}
          />
        </Form.Item>
        <Form.Item label="Идентификатор">
          <Input readOnly value={data.authorizedBody?.identifier || ''} />
        </Form.Item>
        <Form.Item label="Наименование">
          <Input readOnly value={data.authorizedBody?.name || ''} />
        </Form.Item>
        <Form.Item label="Краткое наименование">
          <Input readOnly value={data.authorizedBody?.shortName || ''} />
        </Form.Item>
      </div>
    </Form>
  )
}

export default NotificationTabEdit

