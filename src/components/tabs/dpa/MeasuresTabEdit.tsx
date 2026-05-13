import { useMemo, useState } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Collapse, Select, Upload, message, Modal, InputNumber } from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined, CaretRightOutlined, CaretDownOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/shared/useSanitaryMeasureObjKindOptions'
import { useSanitaryMeasureOptions } from '@/hooks/shared/useSanitaryMeasureOptions'
import { useLanguageOptions } from '@/hooks/shared/useLanguageOptions'
import { useMediaTypeOptions } from '@/hooks/shared/useMediaTypeOptions'
import { useIdentityDocKindOptions } from '@/hooks/shared/useIdentityDocKindOptions'
import { useLegalFormOptions } from '@/hooks/shared/useLegalFormOptions'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import { useIdentificationMethodOptions } from '@/hooks/shared/useIdentificationMethodOptions'
import { useBorderCheckpointOptions } from '@/hooks/shared/useBorderCheckpointOptions'
import { useCommunicationChannelOptions } from '@/hooks/shared/useCommunicationChannelOptions'
import { FieldTagBlock } from '@/components/common/FieldTag'
import { getDefaultAddressKindName, getAddressListFromSubject } from '@/utils/addressFormatUtils'
import CountrySelect from '@/components/common/CountrySelect'
import { DpaEmbeddedUnifiedAuthorityForm } from '@/components/common/DpaEmbeddedUnifiedAuthorityForm'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import { getMaxLength, validateFieldValue, getFormatHint } from '@/constants/xsdFieldConstraints'
import { binaryDownloadFileName, blobMimeTypeFromDocBinaryMediaTypeCode } from '@/utils/docBinaryDownload'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import type { CountryOption } from '@/utils/referenceDataApi'
import type {
  MeasuresData,
  SanitaryMeasure,
  MeasureDocDetails,
  MeasureInitiationBasisItem,
  MeasureImplementationItem,
  SubjectDetails,
  BusinessEntityDetails,
  AddressDetails,
  ContactDetails,
} from '@/types/card'

/** Целое число дней для поля ввода, только если в модели уже PnD с целыми днями; иначе null (сырое значение остаётся только в docValidityDuration). */
function measureDocValidityDaysFromPnD(xmlDuration: string | undefined): number | null {
  const m = (xmlDuration ?? '').trim().match(/^P(\d+)D$/i)
  return m ? parseInt(m[1], 10) : null
}

/** Документ, регламентирующий введение меры — вынесен на уровень модуля, чтобы при вводе не терялся фокус (компонент не пересоздаётся при каждом рендере). */
const MeasureDocDetailsEditStandalone: React.FC<{
  doc?: MeasureDocDetails
  onChange: (doc: MeasureDocDetails) => void
  title: string
  defaultLanguageCode?: string
  loadingCountries: boolean
  countryOptions: CountryOption[]
  normalizeCountryCode: (code: string | undefined) => string | undefined
  loadingMediaTypes: boolean
  getMediaTypeSelectOptions: () => Array<{ value: string; label: string }>
  getMediaTypeNameByCode: (code: string | undefined) => string | null
  getMediaTypeCodeByName: (name: string | undefined) => string | null
  /** DPR DocContentDetails: поле csdo:AuthorityId по XSD DocContentDetailsType. */
  showAuthorityId?: boolean
  /** Скрыть нижнюю кнопку «Удалить документ» (удаление строки — снаружи). */
  hideInternalRemove?: boolean
}> = ({
  doc,
  onChange,
  title,
  defaultLanguageCode,
  loadingCountries,
  countryOptions,
  normalizeCountryCode,
  getMediaTypeSelectOptions,
  getMediaTypeNameByCode,
  getMediaTypeCodeByName,
  showAuthorityId,
  hideInternalRemove,
}) => {
  const [uploadedFileName, setUploadedFileName] = useState<string>('')
  const { getSelectOptions: getShipDocKindSelectOptions, loading: loadingShipDocKinds } = useShipDocKindOptions()
  const { getLangCatalogSelectOptions } = useLanguageOptions()

  const detectMediaType = (file: File): { mime: string; ext: string } => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const byExt: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      txt: 'text/plain',
      xml: 'application/xml',
    }
    return { mime: byExt[ext] || file.type || 'application/octet-stream', ext }
  }

  const downloadBinary = () => {
    if (!doc) return
    const bin = doc.docBinaryText
    if (!bin?.content) return
    try {
      const bytes = Uint8Array.from(atob(bin.content), (c) => c.charCodeAt(0))
      const mime = blobMimeTypeFromDocBinaryMediaTypeCode(bin.mediaTypeCode)
      const blob = new Blob([bytes], { type: mime })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const dictExt = getMediaTypeCodeByName(bin.mediaTypeCode)
      link.download = binaryDownloadFileName(bin.mediaTypeCode, uploadedFileName, dictExt)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } catch {
      message.error('Не удалось скачать файл')
    }
  }

  if (!doc) {
    return (
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={() => onChange(defaultLanguageCode ? { languageCode: defaultLanguageCode } : {})}
        style={{ width: '100%' }}
      >
        Добавить {title}
      </Button>
    )
  }
  return (
    <Form layout="vertical" className="field-tag-form">
      <Form.Item label="Страна">
        <CountrySelect
          value={doc.country}
          onChange={(value) => onChange({ ...doc, country: value || '' })}
          loading={loadingCountries}
          countryOptions={countryOptions}
          normalizeCountryCode={normalizeCountryCode}
          allowClear
        />
      </Form.Item>
      <Form.Item label="Язык">
        <Select
          showSearch
          placeholder="Выберите язык"
          allowClear
          value={doc.languageCode || undefined}
          onChange={(value) => onChange({ ...doc, languageCode: value ?? undefined })}
          onClear={() => onChange({ ...doc, languageCode: undefined })}
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '100%' }}
          options={getLangCatalogSelectOptions()}
        />
      </Form.Item>
      <Form.Item label="Вид">
        <Select
          showSearch
          allowClear
          loading={loadingShipDocKinds}
          placeholder="Выберите вид из справочника"
          disabled={!!(doc.docKindName?.trim() && !doc.docKindCode?.trim())}
          value={doc.docKindCode || undefined}
          onChange={(code) => {
            if (!code) {
              onChange({ ...doc, docKindCode: undefined, docKindCodeListId: undefined })
            } else {
              onChange({
                ...doc,
                docKindCode: code,
                docKindCodeListId: '2009',
                docKindName: undefined,
              })
            }
          }}
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={getShipDocKindSelectOptions()}
          style={{ maxWidth: 520, width: '100%' }}
        />
      </Form.Item>
      {!doc.docKindCode?.trim() && (
        <Form.Item label="Вид (текст, если не из справочника)">
          <Input
            value={doc.docKindName ?? ''}
            onChange={(e) =>
              onChange({
                ...doc,
                docKindName: e.target.value || undefined,
                docKindCode: undefined,
                docKindCodeListId: undefined,
              })
            }
            maxLength={getMaxLength('docKindName')}
            showCount
          />
        </Form.Item>
      )}
      <Form.Item label={labelWithHelp('Наименование', FIELD_HELP.measureDocDetails)}>
        <Input
          value={doc.docName}
          onChange={(e) => onChange({ ...doc, docName: e.target.value })}
          maxLength={getMaxLength('measureDocDetailsDocName')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Серия" extra={getFormatHint('measureDocDetailsDocSeriesId')}>
        <Input
          value={doc.docSeriesId}
          onChange={(e) => onChange({ ...doc, docSeriesId: e.target.value })}
          maxLength={getMaxLength('measureDocDetailsDocSeriesId')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Номер">
        <Input
          value={doc.docId}
          onChange={(e) => onChange({ ...doc, docId: e.target.value })}
          maxLength={getMaxLength('docId')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Дата документа">
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={doc.docCreationDate ? dayjs(doc.docCreationDate) : null}
          onChange={(date) => onChange({ ...doc, docCreationDate: date ? date.format('YYYY-MM-DD') : undefined })}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Form.Item label="Срок действия. Начало">
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={doc.docStartDate ? dayjs(doc.docStartDate) : null}
          onChange={(date) => onChange({ ...doc, docStartDate: date ? date.format('YYYY-MM-DD') : undefined })}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Form.Item label="Срок действия. Окончание">
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={doc.docValidityDate ? dayjs(doc.docValidityDate) : null}
          onChange={(date) => onChange({ ...doc, docValidityDate: date ? date.format('YYYY-MM-DD') : undefined })}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Form.Item label={labelWithHelp('Срок действия документа в днях', FIELD_HELP.measureDocValidityDuration)}>
        <InputNumber
          min={1}
          precision={0}
          style={{ width: '100%' }}
          placeholder="Целое число дней"
          value={measureDocValidityDaysFromPnD(doc.docValidityDuration) ?? undefined}
          onChange={(v) => {
            if (v == null) {
              onChange({ ...doc, docValidityDuration: undefined })
              return
            }
            const n = typeof v === 'number' ? v : parseInt(String(v), 10)
            if (!Number.isFinite(n) || n < 1) {
              onChange({ ...doc, docValidityDuration: undefined })
              return
            }
            onChange({ ...doc, docValidityDuration: `P${Math.floor(n)}D` })
          }}
        />
      </Form.Item>
      {showAuthorityId ? (
        <Form.Item label="Уполномоченный орган. Идентификатор">
          <Input
            value={doc.authorityId ?? ''}
            onChange={(e) => onChange({ ...doc, authorityId: e.target.value || undefined })}
            maxLength={getMaxLength('authorityId')}
            showCount
          />
        </Form.Item>
      ) : null}
      <Form.Item label="Уполномоченный орган. Наименование">
        <Input
          value={doc.authorityName}
          onChange={(e) => onChange({ ...doc, authorityName: e.target.value })}
          maxLength={getMaxLength('authorityName')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Описание">
        <Input.TextArea
          rows={3}
          value={doc.description}
          onChange={(e) => onChange({ ...doc, description: e.target.value })}
          maxLength={getMaxLength('description')}
          showCount
        />
      </Form.Item>
      <Form.Item
        label={labelWithHelp('Количество листов', FIELD_HELP.measureDocPageQuantity)}
        validateStatus={validateFieldValue('measureDocPageQuantity', doc.pageQuantity ?? '') ? 'error' : undefined}
        help={
          validateFieldValue('measureDocPageQuantity', doc.pageQuantity ?? '') ??
          getFormatHint('measureDocPageQuantity')
        }
      >
        <Input
          inputMode="numeric"
          placeholder="До 4 цифр"
          value={doc.pageQuantity ?? ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
            onChange({ ...doc, pageQuantity: digits ? digits : undefined })
          }}
          maxLength={4}
        />
      </Form.Item>
      <Form.Item label="Документ в бинарном виде">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!doc.docBinaryText?.content && (
            <Upload
              beforeUpload={(file) => {
                const detected = detectMediaType(file)
                const allowed = getMediaTypeSelectOptions()
                const allowedCodes = new Set(allowed.map((o) => String(o.value)))
                const mimeToCode: Record<string, string> = {
                  'application/pdf': 'pdf',
                  'application/msword': 'doc',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                  'application/zip': 'zip',
                  'application/x-zip-compressed': 'zip',
                  'image/jpeg': 'jpeg',
                  'image/png': 'png',
                  'image/tiff': 'tiff',
                }
                const normalizedCode =
                  (detected.ext && allowedCodes.has(detected.ext) ? detected.ext : undefined) ||
                  mimeToCode[detected.mime]
                if (!normalizedCode || !allowedCodes.has(normalizedCode)) {
                  Modal.warning({
                    title: 'Недопустимый тип файла',
                    content: `Выберите файл одного из допустимых типов: ${allowed.map((o) => String(o.value)).join(', ')}`,
                  })
                  return false
                }
                const mediatypeName = getMediaTypeNameByCode(normalizedCode)?.trim()
                if (!mediatypeName) {
                  Modal.warning({
                    title: 'Справочник типов файла',
                    content: 'Не удалось получить MEDIATYPENAME по MEDIATYPECODE. Повторите попытку позже.',
                  })
                  return false
                }
                const reader = new FileReader()
                reader.onload = (e) => {
                  const result = e.target?.result as string
                  const base64Content = result.includes(',') ? result.split(',')[1] : result
                  setUploadedFileName(file.name)
                  onChange({
                    ...doc,
                    docBinaryText: { content: base64Content, mediaTypeCode: mediatypeName },
                  })
                  message.success(`Файл "${file.name}" загружен`)
                }
                reader.onerror = () => message.error('Ошибка при чтении файла')
                reader.readAsDataURL(file)
                return false
              }}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>Загрузить файл</Button>
            </Upload>
          )}
          {doc.docBinaryText?.content && (
            <div style={{ fontSize: '12px', color: '#999', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#1677ff', fontWeight: 600 }}>
                Файл в бинарном виде: {uploadedFileName || 'файл'}
                {(() => {
                  const ext = getMediaTypeCodeByName(doc.docBinaryText.mediaTypeCode)
                  return ext ? ` (${ext})` : ''
                })()}
              </span>
              <Button size="small" icon={<DownloadOutlined />} onClick={downloadBinary}>
                Выгрузить файл
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  setUploadedFileName('')
                  onChange({ ...doc, docBinaryText: undefined })
                }}
              >
                Удалить файл
              </Button>
            </div>
          )}
        </div>
      </Form.Item>
      {!hideInternalRemove ? (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onChange(undefined as any)}
        >
          Удалить документ
        </Button>
      ) : null}
    </Form>
  )
}

export { MeasureDocDetailsEditStandalone }

interface MeasuresTabEditProps {
  data: MeasuresData
  onChange: (data: MeasuresData) => void
}

const EAUE_COUNTRY_CODES = new Set(['AM', 'BY', 'KZ', 'KG', 'RU'])

const MeasuresTabEdit: React.FC<MeasuresTabEditProps> = ({ data, onChange }) => {
  const [selectedMeasureIndex, setSelectedMeasureIndex] = useState<number | null>(null)
  const { countryOptions, loading: loadingCountries, normalizeCountryCode } = useCountryOptions()
  const eaueCountryOptions = useMemo(
    () => countryOptions.filter((opt) => EAUE_COUNTRY_CODES.has(String(opt.code || '').toUpperCase())),
    [countryOptions]
  )
  const { getSelectOptions: getSanitaryMeasureObjKindSelectOptions, getNameByCode: getSanitaryMeasureObjKindNameByCode } = useSanitaryMeasureObjKindOptions()
  const { getSelectOptions: getSanitaryMeasureSelectOptions, loading: loadingSanitaryMeasures } = useSanitaryMeasureOptions()
  const { getLanguageName, getLangCatalogSelectOptions } = useLanguageOptions()
  const {
    getSelectOptions: getMediaTypeSelectOptions,
    getNameByCode: getMediaTypeNameByCode,
    getCodeByName: getMediaTypeCodeByName,
    loading: loadingMediaTypes,
  } = useMediaTypeOptions()

  const handleAddMeasure = () => {
    const newMeasure: SanitaryMeasure = {
      languageCode: 'ru',
      startDate: '',
    }
    onChange({
      ...data,
      measures: [...(data.measures || []), newMeasure],
    })
  }

  const handleRemoveMeasure = (index: number) => {
    const updated = [...(data.measures || [])]
    updated.splice(index, 1)
    onChange({
      ...data,
      measures: updated,
    })
  }

  const handleMeasureChange = (index: number, field: string, value: any) => {
    const updated = [...(data.measures || [])]
    updated[index] = {
      ...updated[index],
      [field]: value,
    }
    onChange({
      ...data,
      measures: updated,
    })
  }

  // MeasureInitiationBasis handlers
  const handleAddBasis = (measureIndex: number) => {
    const measure = data.measures[measureIndex]
    const newBasis: MeasureInitiationBasisItem = {
      docKindName: '',
      docName: '',
      docId: '',
      docCreationDate: '',
    }
    handleMeasureChange(measureIndex, 'measureInitiationBasisDetails', [
      ...(measure.measureInitiationBasisDetails || []),
      newBasis,
    ])
  }

  const handleRemoveBasis = (measureIndex: number, basisIndex: number) => {
    const measure = data.measures[measureIndex]
    const updated = [...(measure.measureInitiationBasisDetails || [])]
    updated.splice(basisIndex, 1)
    handleMeasureChange(measureIndex, 'measureInitiationBasisDetails', updated)
  }

  const handleBasisChange = (measureIndex: number, basisIndex: number, field: string, value: any) => {
    const measure = data.measures[measureIndex]
    const updated = [...(measure.measureInitiationBasisDetails || [])]
    updated[basisIndex] = {
      ...updated[basisIndex],
      [field]: value,
    }
    handleMeasureChange(measureIndex, 'measureInitiationBasisDetails', updated)
  }

  // MeasureImplementation handlers
  const handleAddImplementation = (measureIndex: number) => {
    const measure = data.measures[measureIndex]
    const newImpl: MeasureImplementationItem = {
      country: '',
      startDate: '',
      description: '',
    }
    handleMeasureChange(measureIndex, 'measureImplementationDetails', [
      ...(measure.measureImplementationDetails || []),
      newImpl,
    ])
  }

  const handleRemoveImplementation = (measureIndex: number, implIndex: number) => {
    const measure = data.measures[measureIndex]
    const updated = [...(measure.measureImplementationDetails || [])]
    updated.splice(implIndex, 1)
    handleMeasureChange(measureIndex, 'measureImplementationDetails', updated)
  }

  const handleImplementationChange = (measureIndex: number, implIndex: number, field: string, value: any) => {
    const measure = data.measures[measureIndex]
    const updated = [...(measure.measureImplementationDetails || [])]
    updated[implIndex] = {
      ...updated[implIndex],
      [field]: value,
    }
    handleMeasureChange(measureIndex, 'measureImplementationDetails', updated)
  }

  const columns = [
    {
      title: '',
      key: 'expand',
      width: 40,
      align: 'center' as const,
      render: (_: any, __: SanitaryMeasure, index: number) => (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedMeasureIndex(selectedMeasureIndex === index ? null : index)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSelectedMeasureIndex(selectedMeasureIndex === index ? null : index)
            }
          }}
          style={{ cursor: 'pointer' }}
          aria-label={selectedMeasureIndex === index ? 'Свернуть детализацию' : 'Развернуть детализацию'}
        >
          {selectedMeasureIndex === index ? (
            <CaretDownOutlined />
          ) : (
            <CaretRightOutlined />
          )}
        </span>
      ),
    },
    {
      title: labelWithHelp('Язык', FIELD_HELP.languageCode),
      key: 'language',
      width: 140,
      render: (_: unknown, record: SanitaryMeasure) => (
        <span style={{ color: 'rgba(0,0,0,0.65)' }}>
          {record.languageCode
            ? (getLangCatalogSelectOptions().find((o) => o.value === record.languageCode)?.label ??
                `${record.languageCode.toUpperCase()}-${getLanguageName(record.languageCode)}`)
            : '—'}
        </span>
      ),
    },
    {
      title: labelWithHelp('Наименование меры', FIELD_HELP.measureName),
      key: 'measureName',
      width: 360,
      render: (_: unknown, record: SanitaryMeasure, index: number) => (
        <div className="measure-name-cell" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Select
            showSearch
            placeholder="Выберите меру (код — наименование)"
            loading={loadingSanitaryMeasures}
            value={record.measureCode || undefined}
            onChange={(value) => {
              const updatedMeasures = [...(data.measures || [])]
              const cur = updatedMeasures[index] ?? {}
              if (value == null || value === '') {
                updatedMeasures[index] = {
                  ...cur,
                  measureCode: undefined,
                  measureCodeListId: undefined,
                }
              } else {
                updatedMeasures[index] = {
                  ...cur,
                  measureCode: value,
                  measureCodeListId: '1067',
                  measureName: undefined,
                }
              }
              onChange({ ...data, measures: updatedMeasures })
            }}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={getSanitaryMeasureSelectOptions()}
            style={{ width: '100%' }}
            allowClear
          />
          {!record.measureCode?.trim() && (
            <Input
              value={record.measureName ?? ''}
              onChange={(e) => {
                const v = e.target.value
                const updatedMeasures = [...(data.measures || [])]
                const cur = updatedMeasures[index] ?? {}
                updatedMeasures[index] = {
                  ...cur,
                  measureName: v || undefined,
                  measureCode: undefined,
                  measureCodeListId: undefined,
                }
                onChange({ ...data, measures: updatedMeasures })
              }}
              maxLength={getMaxLength('measureName')}
              showCount
              placeholder="Или введите наименование меры текстом"
              size="small"
            />
          )}
        </div>
      ),
    },
    {
      title: labelWithHelp('Вид объекта действия меры', FIELD_HELP.measureAffectedObjectKind),
      key: 'affectedObject',
      width: 200,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <Select
          mode="multiple"
          showSearch
          placeholder="Выберите вид объекта"
          value={record.measureAffectedObjectKindCode ? record.measureAffectedObjectKindCode.split(';').map((c) => c.trim()).filter(Boolean) : undefined}
          onChange={(value) => handleMeasureChange(index, 'measureAffectedObjectKindCode', Array.isArray(value) ? value.join(';') : '')}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={getSanitaryMeasureObjKindSelectOptions()}
          style={{ width: '100%' }}
          allowClear
        />
      ),
    },
    {
      title: labelWithHelp('Начальная дата', FIELD_HELP.measureStartDate),
      key: 'startDate',
      width: 120,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={record.startDate ? dayjs(record.startDate) : null}
          onChange={(date) => handleMeasureChange(index, 'startDate', date ? date.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: labelWithHelp('Конечная дата', FIELD_HELP.measureEndDate),
      key: 'endDate',
      width: 120,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={record.endDate ? dayjs(record.endDate) : null}
          onChange={(date) => handleMeasureChange(index, 'endDate', date ? date.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <Space>
          <Button
            type="link"
            onClick={() => setSelectedMeasureIndex(selectedMeasureIndex === index ? null : index)}
          >
            {selectedMeasureIndex === index ? 'Скрыть' : 'Детали'}
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveMeasure(index)}
          >
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  const renderMeasureDetailContent = (measureIndex: number) => {
    const measure = data.measures?.[measureIndex]
    if (!measure) return null
    return (
      <div style={{ padding: '16px', background: '#fafafa', borderRadius: '4px' }}>
        <h4>Детализация меры</h4>
        <Form layout="vertical" className="field-tag-form">
          <Form.Item label={labelWithHelp('Обоснование', FIELD_HELP.measureJustification)}>
            <Input.TextArea
              rows={3}
              value={measure.measureJustificationText}
              onChange={(e) => handleMeasureChange(measureIndex, 'measureJustificationText', e.target.value)}
              maxLength={getMaxLength('measureJustification')}
              showCount
            />
          </Form.Item>
          <Form.Item label="Описание">
            <Input.TextArea
              rows={3}
              value={measure.description}
              onChange={(e) => handleMeasureChange(measureIndex, 'description', e.target.value)}
              maxLength={getMaxLength('description')}
              showCount
            />
          </Form.Item>
        </Form>

        <Collapse
          defaultActiveKey={['measureDoc', 'initialMeasureDoc', 'basis', 'implementation']}
          items={[
            {
              key: 'measureDoc',
              label: labelWithHelp('Документ, регламентирующий введение (отмену) меры', FIELD_HELP.measureDocDetails),
              children: (
                <MeasureDocDetailsEditStandalone
                  doc={measure.measureDocDetails}
                  onChange={(doc) => handleMeasureChange(measureIndex, 'measureDocDetails', doc)}
                  title="документ"
                  defaultLanguageCode="ru"
                  loadingCountries={loadingCountries}
                  countryOptions={countryOptions}
                  normalizeCountryCode={normalizeCountryCode}
                  loadingMediaTypes={loadingMediaTypes}
                  getMediaTypeSelectOptions={getMediaTypeSelectOptions}
                  getMediaTypeNameByCode={getMediaTypeNameByCode}
                  getMediaTypeCodeByName={getMediaTypeCodeByName}
                />
              ),
            },
            {
              key: 'initialMeasureDoc',
              label: labelWithHelp('Документ, регламентирующий введение исходной меры', FIELD_HELP.initialMeasureDocDetails),
              children: (
                <MeasureDocDetailsEditStandalone
                  doc={measure.initialMeasureDocDetails}
                  onChange={(doc) => handleMeasureChange(measureIndex, 'initialMeasureDocDetails', doc)}
                  title="исходный документ"
                  defaultLanguageCode={undefined}
                  loadingCountries={loadingCountries}
                  countryOptions={countryOptions}
                  normalizeCountryCode={normalizeCountryCode}
                  loadingMediaTypes={loadingMediaTypes}
                  getMediaTypeSelectOptions={getMediaTypeSelectOptions}
                  getMediaTypeNameByCode={getMediaTypeNameByCode}
                  getMediaTypeCodeByName={getMediaTypeCodeByName}
                />
              ),
            },
            {
              key: 'basis',
              label: labelWithHelp('Основание для введения меры', FIELD_HELP.measureInitiationBasis),
              children: (
                <div>
                  <Table
                    dataSource={measure.measureInitiationBasisDetails || []}
                    columns={[
                      {
                        title: 'Вид',
                        key: 'docKindName',
                        render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                          <Input
                            value={record.docKindName}
                            onChange={(e) => handleBasisChange(measureIndex, basisIndex, 'docKindName', e.target.value)}
                            maxLength={getMaxLength('measureInitiationBasisDocKind')}
                            showCount
                          />
                        ),
                      },
                      {
                        title: 'Наименование',
                        key: 'docName',
                        render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                          <Input
                            value={record.docName}
                            onChange={(e) => handleBasisChange(measureIndex, basisIndex, 'docName', e.target.value)}
                            maxLength={getMaxLength('measureInitiationBasisDocName')}
                            showCount
                          />
                        ),
                      },
                      {
                        title: 'Номер',
                        key: 'docId',
                        render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                          <Input
                            value={record.docId}
                            onChange={(e) => handleBasisChange(measureIndex, basisIndex, 'docId', e.target.value)}
                            maxLength={getMaxLength('docId')}
                            showCount
                          />
                        ),
                      },
                      {
                        title: 'Дата',
                        key: 'docCreationDate',
                        render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                          <DatePicker
                            format={DATE_DISPLAY_FORMAT}
                            value={record.docCreationDate ? dayjs(record.docCreationDate) : null}
                            onChange={(date) => handleBasisChange(measureIndex, basisIndex, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')}
                            style={{ width: '100%' }}
                          />
                        ),
                      },
                      {
                        title: 'Действия',
                        key: 'actions',
                        render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                          <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveBasis(measureIndex, basisIndex)}
                          >
                            Удалить
                          </Button>
                        ),
                      },
                    ]}
                    rowKey={(record, index) => `basis-${index}`}
                    pagination={false}
                    size="small"
                  />
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => handleAddBasis(measureIndex)}
                    style={{ width: '100%', marginTop: '8px' }}
                  >
                    Добавить НПА-основание
                  </Button>
                </div>
              ),
            },
            {
              key: 'implementation',
              label: labelWithHelp('Мероприятия', FIELD_HELP.measureImplementation),
              children: (
                <div>
                  <Collapse
                    accordion={false}
                    items={(measure.measureImplementationDetails || []).map((item, implIndex) => ({
                      key: String(implIndex),
                      label: `Сведения о мероприятии — ${implIndex + 1}`,
                      extra: (
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveImplementation(measureIndex, implIndex)
                          }}
                        >
                          Удалить
                        </Button>
                      ),
                      children: (
                        <MeasureImplementationDetailsEdit
                          measureIndex={measureIndex}
                          implIndex={implIndex}
                          item={item}
                          onChange={(field, value) => handleImplementationChange(measureIndex, implIndex, field, value)}
                          countryOptions={countryOptions}
                          authorityCountryOptions={eaueCountryOptions}
                          loadingCountries={loadingCountries}
                          normalizeCountryCode={normalizeCountryCode}
                          getSanitaryMeasureObjKindSelectOptions={getSanitaryMeasureObjKindSelectOptions}
                          getSanitaryMeasureObjKindNameByCode={getSanitaryMeasureObjKindNameByCode}
                        />
                      ),
                    }))}
                  />
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => handleAddImplementation(measureIndex)}
                    style={{ width: '100%', marginTop: '8px' }}
                  >
                    Добавить мероприятие
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3>Принятые меры</h3>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddMeasure}
        >
          Добавить меру
        </Button>
      </div>
      <Table
        className="measures-edit-table"
        dataSource={data.measures || []}
        columns={columns}
        rowKey={(record, index) => `measure-${index}`}
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={() => ({})}
        rowClassName={(record, index) => selectedMeasureIndex === index ? 'ant-table-row-selected' : ''}
        expandable={{
          expandedRowKeys: selectedMeasureIndex !== null ? [`measure-${selectedMeasureIndex}`] : [],
          expandedRowRender: (record) => renderMeasureDetailContent((data.measures || []).indexOf(record)),
          expandIcon: () => null,
          expandIconColumnIndex: -1,
        }}
      />
    </div>
  )
}

// Компонент для детализации мероприятия
const MeasureImplementationDetailsEdit: React.FC<{
  measureIndex: number
  implIndex: number
  item: MeasureImplementationItem
  onChange: (field: string, value: any) => void
  countryOptions: CountryOption[]
  authorityCountryOptions: CountryOption[]
  loadingCountries: boolean
  normalizeCountryCode: (country: string | undefined) => string | undefined
  getSanitaryMeasureObjKindSelectOptions: () => Array<{ value: string; label: string }>
  getSanitaryMeasureObjKindNameByCode: (code: string | undefined) => string | null
}> = ({ item, onChange, countryOptions, authorityCountryOptions, loadingCountries, normalizeCountryCode, getSanitaryMeasureObjKindSelectOptions, getSanitaryMeasureObjKindNameByCode }) => {
  const { getSelectOptions: getShipDocKindSelectOptions, loading: loadingShipDocKinds } = useShipDocKindOptions()
  const { getSelectOptions: getCheckpointSelectOptions, loading: loadingCheckpoints } =
    useBorderCheckpointOptions()
  const authorities = item.authorities?.length ? item.authorities : (item.authority ? [item.authority] : [])
  const subjects = item.subjectDetailsList?.length ? item.subjectDetailsList : (item.subjectDetails ? [item.subjectDetails] : [])

  return (
    <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
      <h5>Детализация мероприятия</h5>
      <Form layout="vertical" className="field-tag-form" style={{ marginBottom: '16px' }}>
        <Form.Item label={labelWithHelp('Код страны', FIELD_HELP.measureImplementationCountry)}>
          <CountrySelect
            value={item.country}
            onChange={(value) => onChange('country', value || '')}
            loading={loadingCountries}
            countryOptions={countryOptions}
            normalizeCountryCode={normalizeCountryCode}
          />
        </Form.Item>
        <Form.Item label={labelWithHelp('Начальная дата', FIELD_HELP.measureImplementationStartDate)}>
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
            value={item.startDate ? dayjs(item.startDate) : null}
            onChange={(date) => onChange('startDate', date ? date.format('YYYY-MM-DD') : undefined)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label={labelWithHelp('Конечная дата', FIELD_HELP.measureImplementationEndDate)}>
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
            value={item.endDate ? dayjs(item.endDate) : null}
            onChange={(date) => onChange('endDate', date ? date.format('YYYY-MM-DD') : undefined)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label={labelWithHelp('Вид объекта действия', FIELD_HELP.measureAffectedObjectKind)}>
          <Select
            mode="multiple"
            showSearch
            placeholder="Выберите вид объекта действия"
            value={item.measureAffectedObjectKindCode ? item.measureAffectedObjectKindCode.split(';').map((c) => c.trim()).filter(Boolean) : undefined}
            onChange={(value) => onChange('measureAffectedObjectKindCode', Array.isArray(value) ? value.join(';') : '')}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={getSanitaryMeasureObjKindSelectOptions()}
            style={{ width: '100%' }}
            allowClear
          />
        </Form.Item>
        <Form.Item label="Описание">
          <Input.TextArea
            rows={3}
            value={item.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Описание мероприятия"
            maxLength={getMaxLength('description')}
            showCount
          />
        </Form.Item>
      </Form>
      <Collapse
        defaultActiveKey={['authority', 'subject', 'document', 'place']}
        items={[
          {
            key: 'authority',
            label: 'Уполномоченный орган',
            children: (
              <div>
                {authorities.map((authority, idx) => (
                  <Form key={`authority-${idx}`} layout="vertical" className="field-tag-form" style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontWeight: 500, marginBottom: 8 }}>Уполномоченный орган — {idx + 1}</div>
                    <DpaEmbeddedUnifiedAuthorityForm
                      value={authority}
                      onChange={(next) => {
                        const nextList = [...authorities]
                        nextList[idx] = next
                        onChange('authorities', nextList)
                      }}
                      countryOptions={authorityCountryOptions}
                      loadingCountries={loadingCountries}
                      normalizeCountryCode={normalizeCountryCode}
                      userFacingLabels
                    />
                    <Button type="link" danger icon={<DeleteOutlined />} onClick={() => {
                      const nextList = authorities.filter((_, i) => i !== idx)
                      onChange('authorities', nextList.length ? nextList : undefined)
                    }}>
                      Удалить уполномоченный орган
                    </Button>
                  </Form>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => {
                  const nextList = [...authorities, {}]
                  onChange('authorities', nextList)
                }} style={{ width: '100%' }}>
                  Добавить уполномоченный орган
                </Button>
              </div>
            ),
          },
          {
            key: 'subject',
            label: 'Субъект-исполнитель',
            children: (
              <div>
                {subjects.map((subject, idx) => (
                  <div key={`subject-${idx}`} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontWeight: 500, marginBottom: 8 }}>Субъект-исполнитель — {idx + 1}</div>
                    <SubjectDetailsUnifiedEdit
                      subject={subject}
                      onChange={(nextSubject) => {
                        const nextList = [...subjects]
                        nextList[idx] = nextSubject
                        onChange('subjectDetailsList', nextList)
                      }}
                      countryOptions={countryOptions}
                      loadingCountries={loadingCountries}
                      normalizeCountryCode={normalizeCountryCode}
                    />
                    <Button type="link" danger icon={<DeleteOutlined />} onClick={() => {
                      const nextList = subjects.filter((_, i) => i !== idx)
                      onChange('subjectDetailsList', nextList.length ? nextList : undefined)
                    }} style={{ marginTop: '8px' }}>
                      Удалить субъект-исполнитель
                    </Button>
                  </div>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => {
                  const nextList = [...subjects, {}]
                  onChange('subjectDetailsList', nextList)
                }} style={{ width: '100%' }}>
                  Добавить субъект-исполнитель
                </Button>
              </div>
            ),
          },
          {
            key: 'document',
            label: labelWithHelp('Документ, устанавливающий мероприятие', FIELD_HELP.documentEstablishingMeasure),
            children: item.documentDetails ? (
              <Form layout="vertical" className="field-tag-form">
                <Form.Item label={labelWithHelp('Код вида документа', FIELD_HELP.implDocKindCode)}>
                  <Select
                    showSearch
                    allowClear
                    loading={loadingShipDocKinds}
                    placeholder="Выберите код вида документа"
                    value={item.documentDetails.docKindCode || undefined}
                    options={getShipDocKindSelectOptions()}
                    onChange={(code) =>
                      onChange('documentDetails', {
                        ...item.documentDetails,
                        docKindCode: code ?? undefined,
                        docKindCodeListId: code ? '2009' : undefined,
                        docKindName: undefined,
                      })
                    }
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ maxWidth: 520, width: '100%' }}
                  />
                </Form.Item>
                <Form.Item label={labelWithHelp('Наименование документа', FIELD_HELP.implDocName)}>
                  <Input
                    value={item.documentDetails.docName}
                    onChange={(e) => onChange('documentDetails', { ...item.documentDetails, docName: e.target.value })}
                    maxLength={getMaxLength('docName500')}
                    showCount
                  />
                </Form.Item>
                <Form.Item label={labelWithHelp('Номер', FIELD_HELP.implDocId)}>
                  <Input
                    value={item.documentDetails.docId}
                    onChange={(e) => onChange('documentDetails', { ...item.documentDetails, docId: e.target.value })}
                    maxLength={getMaxLength('docId')}
                    showCount
                  />
                </Form.Item>
                <Form.Item label={labelWithHelp('Дата', FIELD_HELP.implDocCreationDate)}>
                  <DatePicker
                    format={DATE_DISPLAY_FORMAT}
                    value={item.documentDetails.docCreationDate ? dayjs(item.documentDetails.docCreationDate) : null}
                    onChange={(date) => onChange('documentDetails', { ...item.documentDetails, docCreationDate: date ? date.format('YYYY-MM-DD') : undefined })}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item label={labelWithHelp('Дата начала срока действия', FIELD_HELP.implDocStartDate)}>
                  <DatePicker
                    format={DATE_DISPLAY_FORMAT}
                    value={item.documentDetails.docStartDate ? dayjs(item.documentDetails.docStartDate) : null}
                    onChange={(date) => onChange('documentDetails', { ...item.documentDetails, docStartDate: date ? date.format('YYYY-MM-DD') : undefined })}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onChange('documentDetails', undefined)}
                >
                  Удалить документ
                </Button>
              </Form>
            ) : (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => onChange('documentDetails', {})}
                style={{ width: '100%' }}
              >
                Добавить документ
              </Button>
            ),
          },
          {
            key: 'place',
            label: 'Место проведения мероприятия',
            children: item.placeDetails ? (
              <Form layout="vertical" className="field-tag-form">
                <Form.Item label="Регион">
                  <Input
                    value={item.placeDetails.regionName}
                    onChange={(e) => onChange('placeDetails', { ...item.placeDetails, regionName: e.target.value })}
                    maxLength={getMaxLength('regionName')}
                    showCount
                  />
                </Form.Item>
                <Form.Item label="Код вида пункта пропуска">
                  <Select
                    showSearch
                    allowClear
                    loading={loadingCheckpoints}
                    placeholder="Код вида пункта пропуска"
                    value={item.placeDetails.borderCheckpointCode || undefined}
                    options={getCheckpointSelectOptions()}
                    onChange={(code) => {
                      if (!code) {
                        onChange('placeDetails', {
                          ...item.placeDetails,
                          borderCheckpointCode: undefined,
                        })
                      } else {
                        onChange('placeDetails', {
                          ...item.placeDetails,
                          borderCheckpointCode: code,
                        })
                      }
                    }}
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ maxWidth: 520, width: '100%' }}
                  />
                </Form.Item>
                <Form.Item label="Наименование пункта пропуска">
                  <Input
                    value={item.placeDetails.borderCheckpointName ?? ''}
                    onChange={(e) =>
                      onChange('placeDetails', {
                        ...item.placeDetails,
                        borderCheckpointName: e.target.value || undefined,
                      })
                    }
                    maxLength={getMaxLength('checkpointName')}
                    showCount
                  />
                </Form.Item>
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onChange('placeDetails', undefined)}
                >
                  Удалить место проведения
                </Button>
              </Form>
            ) : (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => onChange('placeDetails', {})}
                style={{ width: '100%' }}
              >
                Добавить место проведения
              </Button>
            ),
          },
        ]}
      />
    </div>
  )
}

// Единая форма редактирования субъекта-исполнителя (без разделения на юрлицо/физлицо), порядок полей по ТЗ
const SubjectDetailsUnifiedEdit: React.FC<{
  subject: SubjectDetails
  onChange: (subject: SubjectDetails) => void
  countryOptions: CountryOption[]
  loadingCountries: boolean
  normalizeCountryCode: (country: string | undefined) => string | undefined
}> = ({ subject, onChange, countryOptions, loadingCountries, normalizeCountryCode }) => {
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({})
  const embeddedInCollapse = false
  const identityDocCountry = normalizeCountryCode(subject.identityDoc?.country)
  const { getSelectOptions: getIdentityDocKindSelectOptions, loading: loadingIdentityDocKinds } =
    useIdentityDocKindOptions(identityDocCountry)
  const { getSelectOptions: getIdentificationMethodSelectOptions, loading: loadingIdMethods } =
    useIdentificationMethodOptions(normalizeCountryCode(subject.country ?? subject.businessEntity?.country))
  const { getSelectOptions: getCommunicationChannelSelectOptions, loading: loadingCommunicationChannels } =
    useCommunicationChannelOptions()
  const be = subject.businessEntity
  const ensureBe = () => subject.businessEntity ?? {}

  const upd = (patch: Partial<SubjectDetails>, bePatch?: Partial<BusinessEntityDetails>) => {
    const nextBe = bePatch !== undefined ? { ...ensureBe(), ...bePatch } : subject.businessEntity
    onChange({ ...subject, ...patch, ...(nextBe && Object.keys(nextBe).length > 0 ? { businessEntity: nextBe } : {}) })
  }

  const country = subject.country ?? be?.country
  const subjectName = subject.subjectName ?? be?.businessEntityName
  const briefName = be?.businessEntityBriefName
  const countryForLegalForm = normalizeCountryCode(country)
  const { getSelectOptions: getLegalFormSelectOptions, loading: loadingLegalForms } = useLegalFormOptions(countryForLegalForm)
  const LEGAL_FORM_CODE_LIST_ID = '2049'
  const isLegalFormFromRef = !!(be?.businessEntityTypeCode && be?.businessEntityTypeCodeListId === LEGAL_FORM_CODE_LIST_ID)

  const handleLegalFormSelect = (code: string | null) => {
    if (!code) {
      upd({}, { businessEntityTypeCode: undefined, businessEntityTypeCodeListId: undefined })
      return
    }
    upd({}, {
      businessEntityTypeCode: code,
      businessEntityTypeCodeListId: LEGAL_FORM_CODE_LIST_ID,
      businessEntityTypeName: undefined,
    })
  }

  const subjectId = be?.businessEntityId
  const identificationMethod = be?.identificationMethod
  const customsNumber = be?.customsNumber
  const taxpayerId = be?.taxpayerId

  const addressList =
    be?.addresses && be.addresses.length > 0 ? be.addresses : getAddressListFromSubject(subject)
  const syncAddresses = (list: AddressDetails[]) => {
    const addresses = list.length > 0 ? list : undefined
    if (subject.businessEntity != null) {
      upd({}, { addresses })
    } else {
      // Только канонический список адресов + сброс legacy-полей; identityDoc и прочие поля субъекта сохраняются через spread.
      onChange({
        ...subject,
        addresses,
        registrationAddress: undefined,
        actualAddress: undefined,
        mailingAddress: undefined,
      })
    }
  }
  const handleImplAddressChange = (index: number, field: keyof AddressDetails, value: string | undefined) => {
    const list = [...addressList]
    if (!list[index]) return
    let next: AddressDetails = { ...list[index], [field]: value }
    if (field === 'cityName' && value) next = { ...next, settlementName: undefined }
    if (field === 'settlementName' && value) next = { ...next, cityName: undefined }
    list[index] = next
    syncAddresses(list)
  }
  const handleImplAddressAdd = () => syncAddresses([...addressList, { addressKindCode: '1' }])
  const handleImplAddressRemove = (index: number) => syncAddresses(addressList.filter((_, i) => i !== index))

  const contactList = be?.contacts && be.contacts.length > 0 ? be.contacts : (subject.contacts ?? [])
  const syncContacts = (list: ContactDetails[]) => {
    const contacts = list.length > 0 ? list : undefined
    if (subject.businessEntity != null) {
      upd({}, { contacts })
    } else {
      onChange({ ...subject, contacts })
    }
  }
  const handleImplContactChange = (index: number, field: keyof ContactDetails, value: string) => {
    const list = [...contactList]
    const cur = list[index] ?? {}
    let next: ContactDetails = { ...cur }
    if (field === 'communicationChannelCode') {
      next.communicationChannelCode = value || undefined
      if (value) next.communicationChannelName = undefined
    } else if (field === 'communicationChannelName') {
      next.communicationChannelName = value
      if (value.trim()) next.communicationChannelCode = undefined
    } else if (field === 'communicationChannelId' || field === 'contactValue') {
      next.communicationChannelId = value
      next.contactValue = value
    }
    list[index] = next
    syncContacts(list)
  }
  const handleImplContactAdd = () =>
    syncContacts([
      ...contactList,
      { communicationChannelId: '', contactKind: '', contactValue: '' },
    ])
  const handleImplContactRemove = (index: number) => syncContacts(contactList.filter((_, i) => i !== index))

  return (
    <Form layout="vertical" className="field-tag-form">
      <Form.Item label="Страна">
        <CountrySelect
          value={country}
          onChange={(value) => {
            const v = value || ''
            upd({ country: v }, { country: v })
          }}
          loading={loadingCountries}
          countryOptions={countryOptions}
          normalizeCountryCode={normalizeCountryCode}
        />
      </Form.Item>
      <Form.Item label="Наименование субъекта">
        <Input
          value={subjectName}
          onChange={(e) => {
            const v = e.target.value
            upd({ subjectName: v }, { businessEntityName: v })
          }}
          maxLength={getMaxLength('businessEntityName')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Краткое наименование">
        <Input
          value={briefName}
          onChange={(e) => upd({}, { businessEntityBriefName: e.target.value })}
          maxLength={getMaxLength('shortName')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Организационно-правовая форма (справочник)">
        <Select
          showSearch
          allowClear
          placeholder={countryForLegalForm ? 'Выберите значение' : 'Сначала укажите страну'}
          loading={loadingLegalForms}
          value={isLegalFormFromRef ? be?.businessEntityTypeCode : undefined}
          onChange={(v) => handleLegalFormSelect(v ?? null)}
          options={getLegalFormSelectOptions()}
          disabled={!countryForLegalForm}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '100%' }}
        />
      </Form.Item>
      {!isLegalFormFromRef && (
        <Form.Item label="Организационно-правовая форма (ручной ввод)">
          <Input
            value={be?.businessEntityTypeName ?? ''}
            onChange={(e) =>
              upd(
                {},
                {
                  businessEntityTypeName: e.target.value || undefined,
                  businessEntityTypeCode: undefined,
                  businessEntityTypeCodeListId: undefined,
                }
              )
            }
            maxLength={getMaxLength('organizationalForm')}
            showCount
          />
        </Form.Item>
      )}
      <Form.Item label="Идентификатор субъекта">
        <Input
          value={subjectId}
          onChange={(e) => upd({}, { businessEntityId: e.target.value })}
          maxLength={getMaxLength('subjectIdentifier')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Метод идентификации">
        <div className="subject-executor-id-method-wrap">
          <Select
            className="subject-executor-id-method-select"
            showSearch
            allowClear
            placeholder={countryForLegalForm ? 'Выберите значение' : 'Сначала укажите страну'}
            loading={loadingIdMethods}
            disabled={!countryForLegalForm}
            value={identificationMethod || undefined}
            options={getIdentificationMethodSelectOptions().map((o) => ({
              value: String(o.value),
              label: `${o.value} — ${o.label}`,
            }))}
            onChange={(v) => upd({}, { identificationMethod: v ?? undefined })}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>
      </Form.Item>
      <Form.Item label="Таможенный номер">
        <Input
          value={customsNumber}
          onChange={(e) => upd({}, { customsNumber: e.target.value })}
          maxLength={getMaxLength('customsNumber')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Идентификатор налогоплательщика">
        <Input
          value={taxpayerId}
          onChange={(e) => upd({}, { taxpayerId: e.target.value })}
          maxLength={getMaxLength('taxpayerId')}
          showCount
        />
      </Form.Item>
      {/* Удостоверение личности */}
      {subject.identityDoc ? (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 4 }}>
          <h5>Удостоверение личности</h5>
          <Form layout="vertical" className="field-tag-form">
            <Form.Item label="Страна">
              <CountrySelect
                value={subject.identityDoc.country}
                onChange={(value) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, country: value || '' } })}
                loading={loadingCountries}
                countryOptions={countryOptions}
                normalizeCountryCode={normalizeCountryCode}
              />
            </Form.Item>
            <Form.Item label="Вид документа (справочник)">
              <Select
                allowClear
                placeholder={identityDocCountry ? 'Выберите значение' : 'Сначала укажите страну документа'}
                loading={loadingIdentityDocKinds}
                options={getIdentityDocKindSelectOptions()}
                disabled={
                  !identityDocCountry ||
                  !!(subject.identityDoc.docKindName?.trim() && !subject.identityDoc.docKindCode?.trim())
                }
                value={subject.identityDoc.docKindCode || undefined}
                onChange={(code) => {
                  onChange({
                    ...subject,
                    identityDoc: {
                      ...subject.identityDoc!,
                      docKindCode: code ?? undefined,
                      docKindCodeListId: code ? '2053' : undefined,
                      docKindName: undefined,
                    },
                  })
                }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            {!subject.identityDoc.docKindCode?.trim() && (
              <Form.Item label="Вид документа (ручной ввод)">
                <Input
                  value={subject.identityDoc.docKindName ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...subject,
                      identityDoc: {
                        ...subject.identityDoc!,
                        docKindName: e.target.value || undefined,
                        docKindCode: undefined,
                        docKindCodeListId: undefined,
                      },
                    })
                  }
                  maxLength={getMaxLength('docKindName')}
                  showCount
                />
              </Form.Item>
            )}
            <Form.Item label="Серия">
              <Input
                value={subject.identityDoc.docSeriesId}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, docSeriesId: e.target.value } })}
                maxLength={getMaxLength('docSeriesId')}
                showCount
              />
            </Form.Item>
            <Form.Item label="Номер">
              <Input
                value={subject.identityDoc.docId}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, docId: e.target.value } })}
                maxLength={getMaxLength('docId')}
                showCount
              />
            </Form.Item>
            <Form.Item label="Дата">
              <DatePicker
                format={DATE_DISPLAY_FORMAT}
                value={subject.identityDoc.docCreationDate ? dayjs(subject.identityDoc.docCreationDate) : null}
                onChange={(date) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, docCreationDate: date ? date.format('YYYY-MM-DD') : undefined } })}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Срок действия">
              <DatePicker
                format={DATE_DISPLAY_FORMAT}
                value={subject.identityDoc.docValidityDate ? dayjs(subject.identityDoc.docValidityDate) : null}
                onChange={(date) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, docValidityDate: date ? date.format('YYYY-MM-DD') : undefined } })}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Уполномоченный орган. Наименование">
              <Input
                value={subject.identityDoc.authorityName}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, authorityName: e.target.value } })}
                maxLength={getMaxLength('authorityName')}
                showCount
              />
            </Form.Item>
            <Button type="link" danger icon={<DeleteOutlined />} onClick={() => onChange({ ...subject, identityDoc: undefined })}>
              Удалить удостоверение личности
            </Button>
          </Form>
        </div>
      ) : (
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => onChange({ ...subject, identityDoc: {} })} style={{ width: '100%', marginTop: 8 }}>
          Добавить удостоверение личности
        </Button>
      )}
      <div style={{ marginTop: 16 }}>
        <h5>Адреса</h5>
        {addressList.map((addr, index) => (
          <div key={index} style={{ marginBottom: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 4 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                <Select
                  placeholder="Вид адреса"
                  value={addr.addressKindCode || undefined}
                  onChange={(value) => handleImplAddressChange(index, 'addressKindCode', value ?? undefined)}
                  style={{ minWidth: 200 }}
                  options={[
                    { value: '1', label: getDefaultAddressKindName('1') },
                    { value: '2', label: getDefaultAddressKindName('2') },
                    { value: '3', label: getDefaultAddressKindName('3') },
                  ]}
                  allowClear
                />
                <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleImplAddressRemove(index)}>
                  Удалить адрес
                </Button>
              </Space>
              <FieldTagBlock label="Страна">
                <div>
                  <CountrySelect
                    placeholder="Страна"
                    value={addr.country}
                    onChange={(value) => handleImplAddressChange(index, 'country', value)}
                    loading={loadingCountries}
                    countryOptions={countryOptions}
                    normalizeCountryCode={normalizeCountryCode}
                    allowClear={embeddedInCollapse}
                  />
                  {(() => {
                    const s = (v: string | undefined) => (v ?? '').trim()
                    const hasContent = !!(
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
                    if (embeddedInCollapse) return null
                    if (!hasContent || s(addr.country)) return null
                    return <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>При заполнении адреса обязательно укажите страну</div>
                  })()}
                </div>
              </FieldTagBlock>
              <FieldTagBlock label="Почтовый индекс">
                <div>
                  <Input
                    placeholder="Почтовый индекс"
                    value={addr.postCode}
                    onChange={(e) => {
                      const v = e.target.value || undefined
                      handleImplAddressChange(index, 'postCode', v)
                      const msg = validateFieldValue('postCode', v ?? '')
                      setAddressErrors((prev) => ({ ...prev, [`addr-${index}-postCode`]: msg ?? '' }))
                    }}
                    onBlur={(e) => {
                      const msg = validateFieldValue('postCode', e.target.value?.trim() || undefined)
                      setAddressErrors((prev) => ({ ...prev, [`addr-${index}-postCode`]: msg ?? '' }))
                    }}
                    status={addressErrors[`addr-${index}-postCode`] ? 'error' : undefined}
                  />
                  {addressErrors[`addr-${index}-postCode`] && (
                    <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>
                      {addressErrors[`addr-${index}-postCode`]}
                      {getFormatHint('postCode') && ` (${getFormatHint('postCode')})`}
                    </div>
                  )}
                </div>
              </FieldTagBlock>
              <FieldTagBlock label="Код территории">
                <Input
                  placeholder="Код территории"
                  value={addr.territoryCode}
                  onChange={(e) => handleImplAddressChange(index, 'territoryCode', e.target.value || undefined)}
                  maxLength={getMaxLength('territoryCode')}
                  showCount
                />
              </FieldTagBlock>
              <FieldTagBlock label="Регион">
                <Input
                  placeholder="Регион"
                  value={addr.regionName}
                  onChange={(e) => handleImplAddressChange(index, 'regionName', e.target.value || undefined)}
                  maxLength={getMaxLength('regionName')}
                  showCount
                />
              </FieldTagBlock>
              <FieldTagBlock label="Район">
                <Input
                  placeholder="Район"
                  value={addr.districtName}
                  onChange={(e) => handleImplAddressChange(index, 'districtName', e.target.value || undefined)}
                  maxLength={getMaxLength('districtName')}
                  showCount
                />
              </FieldTagBlock>
              <FieldTagBlock label="Город">
                <div>
                  <Input
                    placeholder="Город"
                    value={addr.cityName}
                    onChange={(e) => handleImplAddressChange(index, 'cityName', e.target.value || undefined)}
                    maxLength={getMaxLength('cityName')}
                    showCount
                    status={(() => {
                      const s = (v: string | undefined) => (v ?? '').trim()
                      const hasContent = !!(
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
                      const hasCity = !!s(addr.cityName)
                      const hasSettlement = !!s(addr.settlementName)
                      if (embeddedInCollapse) return undefined
                      const err = hasContent && (hasCity && hasSettlement ? true : !hasCity && !hasSettlement)
                      return err ? 'error' : undefined
                    })()}
                  />
                  {(() => {
                    const s = (v: string | undefined) => (v ?? '').trim()
                    const hasContent = !!(
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
                    const hasCity = !!s(addr.cityName)
                    const hasSettlement = !!s(addr.settlementName)
                    if (embeddedInCollapse) return null
                    if (!hasContent) return null
                    if (hasCity && hasSettlement)
                      return <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>Укажите только один — город или населённый пункт</div>
                    if (!hasCity && !hasSettlement)
                      return (
                        <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>
                          При заполнении адреса обязательно укажите город или населённый пункт
                        </div>
                      )
                    return null
                  })()}
                </div>
              </FieldTagBlock>
              <FieldTagBlock label="Населённый пункт">
                <Input
                  placeholder="Населённый пункт"
                  value={addr.settlementName}
                  onChange={(e) => handleImplAddressChange(index, 'settlementName', e.target.value || undefined)}
                  maxLength={getMaxLength('settlementName')}
                  showCount
                />
              </FieldTagBlock>
              <FieldTagBlock label="Улица">
                <Input
                  placeholder="Улица"
                  value={addr.streetName}
                  onChange={(e) => handleImplAddressChange(index, 'streetName', e.target.value || undefined)}
                  maxLength={getMaxLength('streetName')}
                  showCount
                />
              </FieldTagBlock>
              <Space wrap>
                <FieldTagBlock label="Номер дома" style={{ width: 120 }}>
                  <Input
                    placeholder="Номер дома"
                    value={addr.buildingNumberId}
                    onChange={(e) => handleImplAddressChange(index, 'buildingNumberId', e.target.value || undefined)}
                    style={{ width: 120 }}
                    maxLength={getMaxLength('buildingNumberId')}
                    showCount
                  />
                </FieldTagBlock>
                <FieldTagBlock label="Номер помещения" style={{ width: 120 }}>
                  <Input
                    placeholder="Номер помещения"
                    value={addr.roomNumberId}
                    onChange={(e) => handleImplAddressChange(index, 'roomNumberId', e.target.value || undefined)}
                    style={{ width: 120 }}
                    maxLength={getMaxLength('roomNumberId')}
                    showCount
                  />
                </FieldTagBlock>
              </Space>
              <FieldTagBlock label="Номер абонентского ящика">
                <div>
                  <Input
                    placeholder="Номер абонентского ящика"
                    value={addr.postOfficeBoxId}
                    onChange={(e) => {
                      const v = e.target.value || undefined
                      handleImplAddressChange(index, 'postOfficeBoxId', v)
                      const msg = validateFieldValue('postOfficeBoxId', v ?? '')
                      setAddressErrors((prev) => ({ ...prev, [`addr-${index}-postOfficeBoxId`]: msg ?? '' }))
                    }}
                    onBlur={(e) => {
                      const msg = validateFieldValue('postOfficeBoxId', e.target.value?.trim() || undefined)
                      setAddressErrors((prev) => ({ ...prev, [`addr-${index}-postOfficeBoxId`]: msg ?? '' }))
                    }}
                    maxLength={getMaxLength('postOfficeBoxId')}
                    showCount
                    status={addressErrors[`addr-${index}-postOfficeBoxId`] ? 'error' : undefined}
                  />
                  {addressErrors[`addr-${index}-postOfficeBoxId`] && (
                    <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>{addressErrors[`addr-${index}-postOfficeBoxId`]}</div>
                  )}
                </div>
              </FieldTagBlock>
            </Space>
          </div>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={handleImplAddressAdd} style={{ width: '100%' }}>
          Добавить адрес
        </Button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h5>Контактные реквизиты</h5>
        {contactList.map((contact, index) => (
          <div key={index} style={{ marginBottom: 8, padding: 8, border: '1px solid #d9d9d9', borderRadius: 4 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <FieldTagBlock label="Вид контакта">
                <Select
                  placeholder="Код — наименование"
                  allowClear
                  loading={loadingCommunicationChannels}
                  value={contact.communicationChannelCode || undefined}
                  options={getCommunicationChannelSelectOptions()}
                  disabled={!!contact.communicationChannelName?.trim()}
                  onChange={(value) => handleImplContactChange(index, 'communicationChannelCode', value ?? '')}
                  style={{ width: '100%' }}
                />
              </FieldTagBlock>
              <FieldTagBlock label="Наименование вида связи">
                <Input
                  value={contact.communicationChannelName ?? ''}
                  onChange={(e) => handleImplContactChange(index, 'communicationChannelName', e.target.value)}
                  disabled={!!contact.communicationChannelCode}
                  maxLength={getMaxLength('communicationChannelName')}
                  showCount
                />
              </FieldTagBlock>
              <FieldTagBlock label="Значение">
                <Input
                  value={contact.communicationChannelId ?? contact.contactValue ?? ''}
                  onChange={(e) => handleImplContactChange(index, 'communicationChannelId', e.target.value)}
                  maxLength={getMaxLength('communicationChannelId')}
                  showCount
                />
              </FieldTagBlock>
              <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleImplContactRemove(index)}>
                Удалить контакт
              </Button>
            </Space>
          </div>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={handleImplContactAdd} style={{ width: '100%' }}>
          Добавить контакт
        </Button>
      </div>
    </Form>
  )
}

export default MeasuresTabEdit
