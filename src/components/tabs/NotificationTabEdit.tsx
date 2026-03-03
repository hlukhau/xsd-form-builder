import { useEffect, useState } from 'react'
import { Form, Input, DatePicker, Select, Descriptions } from 'antd'
import dayjs from 'dayjs'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Notification } from '@/types/card'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import { useIncidentAlertKindOptions } from '@/hooks/useIncidentAlertKindOptions'
import { useAuthorityOptions } from '@/hooks/useAuthorityOptions'
import CountrySelect from '@/components/common/CountrySelect'

export interface NotificationTabEditProps {
  data: Notification
  onChange: (data: Notification) => void
  /** Режим новой карты: первые поля (код страны, рег. номер, вид, дата формирования) только для просмотра */
  isNewCard?: boolean
  /** Код страны карты (для отображения в режиме новой карты) */
  cardCountry?: string
}

const NotificationTabEdit: React.FC<NotificationTabEditProps> = ({ data, onChange, isNewCard, cardCountry }) => {
  const [form] = Form.useForm()
  const { countryOptions, loading, normalizeCountryCode, getSelectOptions } = useCountryOptions()
  const { options: incidentAlertKindOptions, loading: loadingIncidentAlertKinds, getSelectOptions: getIncidentAlertKindSelectOptions, getNameByCode: getIncidentAlertKindNameByCode } = useIncidentAlertKindOptions()
  
  // Получаем код страны уполномоченного органа для фильтрации справочника
  const authorizedBodyCountryCode = normalizeCountryCode(data.authorizedBody?.country)
  const { options: authorityOptions, loading: loadingAuthorities, getSelectOptions: getAuthoritySelectOptions, getAuthorityByUid } = useAuthorityOptions(authorizedBodyCountryCode)
  
  // Отслеживаем изменение страны уполномоченного органа
  const [selectedAuthorityUid, setSelectedAuthorityUid] = useState<string | undefined>(undefined)

  useEffect(() => {
    // Ищем UID уполномоченного органа по идентификатору
    const authorityUid = data.authorizedBody?.identifier
    setSelectedAuthorityUid(authorityUid)
    
    form.setFieldsValue({
      registrationNumber: data.registrationNumber,
      type: data.type, // Код вида уведомления
      formationDate: data.formationDate ? dayjs(data.formationDate) : undefined,
      endDate: data.endDate ? dayjs(data.endDate) : undefined,
      authorizedBodyCountry: normalizeCountryCode(data.authorizedBody?.country),
    })
  }, [data, form, normalizeCountryCode])

  
  // Обработчик изменения страны уполномоченного органа
  const handleAuthorizedBodyCountryChange = (countryCode: string | undefined) => {
    // При изменении страны сбрасываем выбранный орган
    setSelectedAuthorityUid(undefined)
    onChange({
      ...data,
      authorizedBody: {
        country: countryCode || '',
        identifier: '',
        name: '',
        shortName: '',
      },
    })
  }
  
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
    // Игнорируем изменения в полях уполномоченного органа (они обрабатываются отдельно)
    if (changedValues.authorizedBodyCountry || changedValues.authorizedBody || 
        changedValues.authorizedBodyIdentifier || changedValues.authorizedBodyName || 
        changedValues.authorizedBodyShortName) {
      return
    }
    
    onChange({
      ...data,
      registrationNumber: allValues.registrationNumber || data.registrationNumber,
      type: allValues.type || data.type,
      formationDate: allValues.formationDate ? allValues.formationDate.format('YYYY-MM-DD') : data.formationDate,
      endDate: allValues.endDate ? allValues.endDate.format('YYYY-MM-DD') : (allValues.endDate === null ? null : data.endDate),
      authorizedBody: data.authorizedBody, // Сохраняем текущее значение
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
            <Input />
          </Form.Item>
          <Form.Item label="Вид" name="type">
            <Select
              showSearch
              placeholder="Выберите вид уведомления"
              loading={loadingIncidentAlertKinds}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={getIncidentAlertKindSelectOptions()}
            />
          </Form.Item>
          <Form.Item label="Дата формирования" name="formationDate">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </>
      )}
      <Form.Item label="Дата закрытия" name="endDate">
        <DatePicker style={{ width: '100%' }} allowClear />
      </Form.Item>
      
      <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
        <h4>Уполномоченный орган</h4>
        <Form.Item label="Страна" name="authorizedBodyCountry">
          <CountrySelect
            loading={loading}
            countryOptions={countryOptions}
            normalizeCountryCode={normalizeCountryCode}
            onChange={handleAuthorizedBodyCountryChange}
          />
        </Form.Item>
        <Form.Item label="Уполномоченный орган">
          <Select
            showSearch
            placeholder={authorizedBodyCountryCode 
              ? "Выберите уполномоченный орган" 
              : "Сначала выберите страну"}
            loading={loadingAuthorities}
            value={selectedAuthorityUid}
            onChange={handleAuthoritySelect}
            allowClear
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={getAuthoritySelectOptions()}
            disabled={!authorizedBodyCountryCode}
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

