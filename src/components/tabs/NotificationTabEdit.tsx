import { useEffect } from 'react'
import { Form, Input, DatePicker } from 'antd'
import dayjs from 'dayjs'
import type { Notification } from '@/types/card'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import CountrySelect from '@/components/common/CountrySelect'

interface NotificationTabEditProps {
  data: Notification
  onChange: (data: Notification) => void
}

const NotificationTabEdit: React.FC<NotificationTabEditProps> = ({ data, onChange }) => {
  const [form] = Form.useForm()
  const { countryOptions, loading, normalizeCountryCode, getSelectOptions } = useCountryOptions()

  useEffect(() => {
    form.setFieldsValue({
      country: normalizeCountryCode(data.country),
      registrationNumber: data.registrationNumber,
      type: data.type,
      formationDate: data.formationDate ? dayjs(data.formationDate) : undefined,
      endDate: data.endDate ? dayjs(data.endDate) : undefined,
      authorizedBodyCountry: normalizeCountryCode(data.authorizedBody?.country),
      authorizedBodyIdentifier: data.authorizedBody?.identifier,
      authorizedBodyName: data.authorizedBody?.name,
      authorizedBodyShortName: data.authorizedBody?.shortName,
    })
  }, [data, form, normalizeCountryCode])

  const handleValuesChange = (_: any, allValues: any) => {
    onChange({
      ...data,
      country: allValues.country || data.country,
      registrationNumber: allValues.registrationNumber || data.registrationNumber,
      type: allValues.type || data.type,
      formationDate: allValues.formationDate ? allValues.formationDate.format('YYYY-MM-DD') : data.formationDate,
      endDate: allValues.endDate ? allValues.endDate.format('YYYY-MM-DD') : (allValues.endDate === null ? null : data.endDate),
      authorizedBody: {
        country: allValues.authorizedBodyCountry || data.authorizedBody?.country || '',
        identifier: allValues.authorizedBodyIdentifier || data.authorizedBody?.identifier || '',
        name: allValues.authorizedBodyName || data.authorizedBody?.name || '',
        shortName: allValues.authorizedBodyShortName || data.authorizedBody?.shortName || '',
      },
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
        <Input />
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
          />
        </Form.Item>
        <Form.Item label="Идентификатор" name="authorizedBodyIdentifier">
          <Input />
        </Form.Item>
        <Form.Item label="Наименование" name="authorizedBodyName">
          <Input />
        </Form.Item>
        <Form.Item label="Краткое наименование" name="authorizedBodyShortName">
          <Input />
        </Form.Item>
      </div>
    </Form>
  )
}

export default NotificationTabEdit

