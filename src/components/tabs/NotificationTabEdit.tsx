import { useEffect, useState } from 'react'
import { Form, Input, DatePicker, Select } from 'antd'
import dayjs from 'dayjs'
import type { Notification } from '@/types/card'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import { useIncidentAlertKindOptions } from '@/hooks/useIncidentAlertKindOptions'
import { useAuthorityOptions } from '@/hooks/useAuthorityOptions'
import CountrySelect from '@/components/common/CountrySelect'

interface NotificationTabEditProps {
  data: Notification
  onChange: (data: Notification) => void
}

const NotificationTabEdit: React.FC<NotificationTabEditProps> = ({ data, onChange }) => {
  const [form] = Form.useForm()
  const { countryOptions, loading, normalizeCountryCode, getSelectOptions } = useCountryOptions()
  const { options: incidentAlertKindOptions, loading: loadingIncidentAlertKinds, getSelectOptions: getIncidentAlertKindSelectOptions } = useIncidentAlertKindOptions()
  
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
      country: normalizeCountryCode(data.country),
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
  const handleAuthoritySelect = (uid: string) => {
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
      country: allValues.country || data.country,
      registrationNumber: allValues.registrationNumber || data.registrationNumber,
      type: allValues.type || data.type,
      formationDate: allValues.formationDate ? allValues.formationDate.format('YYYY-MM-DD') : data.formationDate,
      endDate: allValues.endDate ? allValues.endDate.format('YYYY-MM-DD') : (allValues.endDate === null ? null : data.endDate),
      authorizedBody: data.authorizedBody, // Сохраняем текущее значение
    })
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleValuesChange}
    >
      <Form.Item label="Страна" name="country">
        <CountrySelect
          loading={loading}
          countryOptions={countryOptions}
          normalizeCountryCode={normalizeCountryCode}
        />
      </Form.Item>
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
          // value - код, label - "код - название"
        />
      </Form.Item>
      <Form.Item label="Дата формирования" name="formationDate">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
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
            placeholder="Выберите уполномоченный орган"
            loading={loadingAuthorities}
            value={selectedAuthorityUid}
            onChange={handleAuthoritySelect}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={getAuthoritySelectOptions()}
            disabled={!authorizedBodyCountryCode}
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

