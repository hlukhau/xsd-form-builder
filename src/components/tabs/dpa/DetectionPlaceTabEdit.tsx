import { useState } from 'react'
import { Form, Input, Button, Collapse, Space, Select } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import ManufacturerDetailsEdit from '../../common/ManufacturerDetailsEdit'
import CountrySelect from '../../common/CountrySelect'
import type { DetectionPlaceData, AddressDetails, SupplyChainPartyDetails, BusinessEntityDetails } from '@/types/card'
import { getAddressListFromParty } from '@/utils/addressFormatUtils'

/** Редактор изготовителя ждёт SupplyChainPartyDetails (subjectIdentifier); в XML/карте — businessEntityId. */
function organizationToSupplyChainPartyEdit(org: DetectionPlaceData['organization'] | undefined): SupplyChainPartyDetails {
  if (!org) return { country: '' }
  const isLegalForm = org.businessEntityTypeCodeListId === '2049' && !!(org.businessEntityTypeCode ?? '').trim()
  return {
    country: org.country ?? '',
    businessEntityName: org.businessEntityName,
    shortName: org.businessEntityBriefName,
    organizationalForm: isLegalForm ? undefined : org.businessEntityTypeName,
    businessEntityTypeCode: org.businessEntityTypeCode,
    businessEntityTypeCodeListId: org.businessEntityTypeCodeListId,
    subjectIdentifier: org.businessEntityId ?? '',
    identificationMethod: org.identificationMethod,
    customsNumber: org.customsNumber,
    taxpayerId: org.taxpayerId,
    taxRegistrationReasonCode: org.taxRegistrationReasonCode,
    addresses: org.addresses,
    contacts: org.contacts,
  }
}

/** Сохраняем в карте BusinessEntityDetails — в XML экспортеры берут businessEntityId, не subjectIdentifier. */
function supplyChainPartyToBusinessEntity(org: SupplyChainPartyDetails): BusinessEntityDetails {
  const list = getAddressListFromParty(org)
  const isLegalForm = org.businessEntityTypeCodeListId === '2049' && !!(org.businessEntityTypeCode ?? '').trim()
  const id = (org.subjectIdentifier ?? '').trim() || (org.businessEntityId ?? '').trim()
  return {
    country: trimStr(org.country) ? org.country : undefined,
    businessEntityName: trimStr(org.businessEntityName) ? org.businessEntityName : undefined,
    businessEntityBriefName: trimStr(org.shortName) ? org.shortName : undefined,
    businessEntityTypeCode: trimStr(org.businessEntityTypeCode) ? org.businessEntityTypeCode : undefined,
    businessEntityTypeCodeListId: org.businessEntityTypeCodeListId,
    businessEntityTypeName: isLegalForm ? undefined : trimStr(org.organizationalForm) ? org.organizationalForm : undefined,
    businessEntityId: id || undefined,
    identificationMethod: trimStr(org.identificationMethod) ? org.identificationMethod : undefined,
    customsNumber: trimStr(org.customsNumber) ? org.customsNumber : undefined,
    taxpayerId: trimStr(org.taxpayerId) ? org.taxpayerId : undefined,
    taxRegistrationReasonCode: trimStr(org.taxRegistrationReasonCode) ? org.taxRegistrationReasonCode : undefined,
    addresses: list.length > 0 ? list : undefined,
    contacts: org.contacts?.length ? org.contacts : undefined,
  }
}

function trimStr(v: string | undefined | null): string {
  return (v ?? '').trim()
}

function detectionAddressHasContent(addr: AddressDetails | undefined): boolean {
  if (!addr) return false
  const s = (x?: string) => trimStr(x)
  return !!(
    s(addr.country) ||
    s(addr.territoryCode) ||
    s(addr.regionName) ||
    s(addr.districtName) ||
    s(addr.cityName) ||
    s(addr.settlementName) ||
    s(addr.streetName) ||
    s(addr.buildingNumberId) ||
    s(addr.roomNumberId) ||
    s(addr.postOfficeBoxId) ||
    s(addr.postCode) ||
    s(addr.fullAddress)
  )
}

/** Все поля пустые — в модели места обнаружения не храним блок организации. */
function detectionPlaceOrganizationEmpty(org: BusinessEntityDetails): boolean {
  if (trimStr(org.country)) return false
  if (trimStr(org.businessEntityName)) return false
  if (trimStr(org.businessEntityBriefName)) return false
  if (trimStr(org.businessEntityTypeCode)) return false
  if (trimStr(org.businessEntityTypeName)) return false
  if (trimStr(org.businessEntityId)) return false
  if (trimStr(org.identificationMethod)) return false
  if (trimStr(org.customsNumber)) return false
  if (trimStr(org.taxpayerId)) return false
  if (trimStr(org.taxRegistrationReasonCode)) return false
  for (const a of org.addresses ?? []) {
    if (detectionAddressHasContent(a)) return false
  }
  for (const c of org.contacts ?? []) {
    if (
      trimStr(c.communicationChannelCode) ||
      trimStr(c.communicationChannelName) ||
      trimStr(c.communicationChannelId) ||
      trimStr(c.contactKind) ||
      trimStr(c.contactValue)
    )
      return false
  }
  return true
}
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useBorderCheckpointOptions } from '@/hooks/shared/useBorderCheckpointOptions'
import { getMaxLength, validateFieldValue, getFormatHint } from '@/constants/xsdFieldConstraints'

interface DetectionPlaceTabEditProps {
  data: DetectionPlaceData
  onChange: (data: DetectionPlaceData) => void
}

const DetectionPlaceTabEdit: React.FC<DetectionPlaceTabEditProps> = ({ data, onChange }) => {
  const { countryOptions, loading, normalizeCountryCode } = useCountryOptions()
  const { getSelectOptions: getCheckpointSelectOptions, loading: loadingCheckpoints } = useBorderCheckpointOptions()

  const handleFieldChange = (field: string, value: any) => {
    onChange({
      ...data,
      [field]: value,
    })
  }

  const handleAddressChange = (field: keyof AddressDetails, value: string | undefined) => {
    const raw = value ?? ''
    const v = raw.trim() === '' ? undefined : raw
    const base = data.address ? { ...data.address } : {}
    const next: AddressDetails = { ...base, [field]: v }
    if (field === 'cityName' && v) next.settlementName = undefined
    if (field === 'settlementName' && v) next.cityName = undefined
    onChange({
      ...data,
      address: detectionAddressHasContent(next) ? next : undefined,
    })
  }

  const handleOrganizationChange = (org: SupplyChainPartyDetails) => {
    const be = supplyChainPartyToBusinessEntity(org)
    if (detectionPlaceOrganizationEmpty(be)) {
      onChange({ ...data, organization: undefined })
    } else {
      onChange({ ...data, organization: be })
    }
  }

  const handleCheckpointChange = (field: string, value: string) => {
    onChange({
      ...data,
      borderCheckpoint: {
        ...data.borderCheckpoint,
        [field]: value,
      },
    })
  }

  const hasCheckpointCode = (data.borderCheckpoint?.checkpointCode ?? '').trim() !== ''
  const hasCheckpointName = (data.borderCheckpoint?.checkpointName ?? '').trim() !== ''
  const checkpointValidationError =
    (hasCheckpointCode && !hasCheckpointName) || (!hasCheckpointCode && hasCheckpointName)
      ? 'Укажите оба атрибута: код вида пункта пропуска и наименование пункта пропуска (или оставьте оба пустыми).'
      : undefined

  const rawGeo = data.geoCoordinates
  const geoList: Array<{ longitude?: string; latitude?: string }> = Array.isArray(rawGeo)
    ? rawGeo
    : rawGeo && typeof rawGeo === 'object' && ('longitude' in rawGeo || 'latitude' in rawGeo)
      ? [rawGeo]
      : []

  const handleCoordinateChange = (index: number, field: 'longitude' | 'latitude', value: string) => {
    const next = [...geoList]
    if (!next[index]) next[index] = {}
    next[index] = { ...next[index], [field]: value || undefined }
    onChange({ ...data, geoCoordinates: next })
  }

  const handleAddCoordinate = () => {
    onChange({ ...data, geoCoordinates: [...geoList, {}] })
  }

  const handleRemoveCoordinate = (index: number) => {
    const next = geoList.filter((_, i) => i !== index)
    onChange({ ...data, geoCoordinates: next.length ? next : undefined })
  }

  return (
    <div>
      <Form layout="vertical" className="field-tag-form">
        <Form.Item label="Описание">
          <Input.TextArea
            rows={3}
            value={data.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            maxLength={getMaxLength('descriptionPlace')}
            showCount
          />
        </Form.Item>
      </Form>

      <Collapse
        defaultActiveKey={['address', 'organization', 'checkpoint', 'coordinates']}
        items={[
          {
            key: 'address',
            label: 'Адрес',
            children: (() => {
              const addr = data.address
              return (
              <Form layout="vertical" className="field-tag-form">
                <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 16, marginBottom: 0 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Form.Item label="Страна" style={{ marginBottom: 0 }}>
                      <CountrySelect
                        placeholder="Страна"
                        loading={loading}
                        allowClear
                        value={data.address?.country}
                        onChange={(value) => handleAddressChange('country', value)}
                        countryOptions={countryOptions}
                        normalizeCountryCode={normalizeCountryCode}
                      />
                    </Form.Item>
                    <Form.Item label="Код территории" style={{ marginBottom: 0 }}>
                      <Input
                        placeholder="Код территории"
                        value={data.address?.territoryCode}
                        onChange={(e) => handleAddressChange('territoryCode', e.target.value)}
                        maxLength={getMaxLength('territoryCode')}
                        showCount
                      />
                    </Form.Item>
                    <Form.Item label="Регион" style={{ marginBottom: 0 }}>
                      <Input
                        placeholder="Например: Витебская область"
                        value={data.address?.regionName}
                        onChange={(e) => handleAddressChange('regionName', e.target.value)}
                        maxLength={getMaxLength('regionName')}
                        showCount
                      />
                    </Form.Item>
                    <Form.Item label="Район" style={{ marginBottom: 0 }}>
                      <Input
                        placeholder="Район"
                        value={data.address?.districtName}
                        onChange={(e) => handleAddressChange('districtName', e.target.value)}
                        maxLength={getMaxLength('districtName')}
                        showCount
                      />
                    </Form.Item>
                    <Form.Item label="Город" style={{ marginBottom: 0 }}>
                      <Input
                        placeholder="Город"
                        value={data.address?.cityName}
                        onChange={(e) => handleAddressChange('cityName', e.target.value)}
                        maxLength={getMaxLength('cityName')}
                        showCount
                      />
                    </Form.Item>
                    <Form.Item label="Населённый пункт" style={{ marginBottom: 0 }}>
                      <Input
                        placeholder="Например: г.п. Ушачи"
                        value={data.address?.settlementName}
                        onChange={(e) => handleAddressChange('settlementName', e.target.value)}
                        maxLength={getMaxLength('settlementName')}
                        showCount
                      />
                    </Form.Item>
                    <Form.Item label="Улица" style={{ marginBottom: 0 }}>
                      <Input
                        placeholder="Улица"
                        value={data.address?.streetName}
                        onChange={(e) => handleAddressChange('streetName', e.target.value)}
                        maxLength={getMaxLength('streetName')}
                        showCount
                      />
                    </Form.Item>
                    <Form.Item label="Номер здания" style={{ marginBottom: 0 }}>
                      <Input
                        placeholder="Номер дома, корпус"
                        value={data.address?.buildingNumberId}
                        onChange={(e) => handleAddressChange('buildingNumberId', e.target.value)}
                        maxLength={getMaxLength('buildingNumberId')}
                        showCount
                      />
                    </Form.Item>
                    <Form.Item label="Номер помещения" style={{ marginBottom: 0 }}>
                      <Input
                        placeholder="Квартира, офис, кабинет"
                        value={data.address?.roomNumberId}
                        onChange={(e) => handleAddressChange('roomNumberId', e.target.value)}
                        maxLength={getMaxLength('roomNumberId')}
                        showCount
                      />
                    </Form.Item>
                  </Space>
                </div>
              </Form>
              )
            })(),
          },
          {
            key: 'organization',
            label: 'Организация',
            children: (
              <ManufacturerDetailsEdit
                data={organizationToSupplyChainPartyEdit(data.organization)}
                onChange={handleOrganizationChange}
                title=""
                hideKindField
                embeddedInCollapse
              />
            ),
          },
          {
            key: 'checkpoint',
            label: 'Пункт пропуска',
            children: (
              <Form layout="vertical" className="field-tag-form">
                <p style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>
                  Укажите оба атрибута (код вида пункта пропуска и наименование пункта пропуска) или оставьте оба пустыми.
                </p>
                <Form.Item
                  label="Код вида пункта пропуска"
                  validateStatus={checkpointValidationError ? 'error' : undefined}
                  help={checkpointValidationError}
                >
                  <Select
                    showSearch
                    placeholder="Выберите пункт пропуска (код — наименование)"
                    loading={loadingCheckpoints}
                    value={data.borderCheckpoint?.checkpointCode || undefined}
                    onChange={(code) => {
                      if (!code) {
                        onChange({ ...data, borderCheckpoint: undefined })
                        return
                      }
                      // Подставляем только код в csdo:BorderCheckpointCode; наименование вида только в выпадающем списке (код — наименование), в данные не пишем
                      onChange({
                        ...data,
                        borderCheckpoint: {
                          ...data.borderCheckpoint,
                          checkpointCode: code,
                          checkpointName: data.borderCheckpoint?.checkpointName ?? '',
                        },
                      })
                    }}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={getCheckpointSelectOptions()}
                    style={{ width: '100%' }}
                    allowClear
                  />
                </Form.Item>
                <Form.Item
                  label="Наименование пункта пропуска"
                  help={checkpointValidationError}
                  validateStatus={checkpointValidationError ? 'error' : undefined}
                >
                  <Input
                    placeholder="Введите наименование пункта пропуска"
                    value={data.borderCheckpoint?.checkpointName ?? ''}
                    onChange={(e) => handleCheckpointChange('checkpointName', e.target.value)}
                    maxLength={getMaxLength('checkpointName')}
                    showCount
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'coordinates',
            label: 'Географические координаты',
            children: (
              <Form layout="vertical" className="field-tag-form">
                {geoList.map((coord, idx) => {
                  const hasLon = (coord.longitude ?? '').trim() !== ''
                  const hasLat = (coord.latitude ?? '').trim() !== ''
                  const coordPairError =
                    !hasLon && !hasLat
                      ? 'Заполните обе координаты или удалите запись'
                      : (hasLon && !hasLat) || (!hasLon && hasLat)
                        ? 'Укажите обе координаты: широту и долготу'
                        : undefined
                  return (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                      <Form.Item
                        label="Долгота"
                        style={{ marginBottom: 0, flex: 1, minWidth: 200 }}
                        validateStatus={coordPairError || validateFieldValue('geoCoordinate', coord.longitude?.trim()) ? 'error' : undefined}
                        help={validateFieldValue('geoCoordinate', coord.longitude?.trim()) || coordPairError}
                      >
                        <Input
                          value={coord.longitude ?? ''}
                          onChange={(e) => handleCoordinateChange(idx, 'longitude', e.target.value)}
                          onBlur={(e) => handleCoordinateChange(idx, 'longitude', e.target.value)}
                          placeholder="Число ISO 6709"
                        />
                      </Form.Item>
                      <Form.Item
                        label="Широта"
                        style={{ marginBottom: 0, flex: 1, minWidth: 200 }}
                        validateStatus={coordPairError || validateFieldValue('geoCoordinate', coord.latitude?.trim()) ? 'error' : undefined}
                        help={validateFieldValue('geoCoordinate', coord.latitude?.trim()) || coordPairError}
                      >
                        <Input
                          value={coord.latitude ?? ''}
                          onChange={(e) => handleCoordinateChange(idx, 'latitude', e.target.value)}
                          onBlur={(e) => handleCoordinateChange(idx, 'latitude', e.target.value)}
                          placeholder="Число ISO 6709"
                        />
                      </Form.Item>
                      <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveCoordinate(idx)} style={{ marginTop: 30 }}>
                        Удалить
                      </Button>
                    </div>
                  )
                })}
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddCoordinate}>
                  Добавить координаты
                </Button>
              </Form>
            ),
          },
        ]}
      />
    </div>
  )
}

export default DetectionPlaceTabEdit









