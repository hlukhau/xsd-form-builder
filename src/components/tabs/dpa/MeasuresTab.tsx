import { useState } from 'react'
import { Table, Button, Descriptions, Collapse } from 'antd'
import { DownloadOutlined, CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { getLanguageName } from '@/hooks/shared/useLanguageOptions'
import {
  getAddressListFromSubject,
  getAddressListFromOrganization,
  formatAddressList,
  getDefaultAddressKindName,
} from '@/utils/addressFormatUtils'
import { useSanitaryMeasureOptions } from '@/hooks/shared/useSanitaryMeasureOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/shared/useSanitaryMeasureObjKindOptions'
import { useIdentityDocKindOptions } from '@/hooks/shared/useIdentityDocKindOptions'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import type {
  MeasuresData,
  SanitaryMeasure,
  MeasureDocDetails,
  MeasureInitiationBasisItem,
  MeasureImplementationItem,
  SubjectDetails,
  DocumentReferenceDetails,
  MeasurePlaceDetails,
} from '@/types/card'

interface MeasuresTabProps {
  data: MeasuresData
}

const MeasuresTab: React.FC<MeasuresTabProps> = ({ data }) => {
  const [selectedMeasureIndex, setSelectedMeasureIndex] = useState<number | null>(null)
  const { getNameByCode: getSanitaryMeasureNameByCode } = useSanitaryMeasureOptions()
  const { getNameByCode: getSanitaryMeasureObjKindNameByCode } = useSanitaryMeasureObjKindOptions()

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const getMeasureAffectedObjectKindName = (codeOrCodes?: string): string => {
    if (!codeOrCodes) return '-'
    const codes = codeOrCodes.split(';').map((c) => c.trim()).filter(Boolean)
    if (codes.length === 0) return '-'
    const names = codes.map((code) => getSanitaryMeasureObjKindNameByCode(code) || `Вид объекта (код: ${code})`)
    return names.join(';')
  }

  const getMeasureName = (measure: SanitaryMeasure): string => {
    // Если указаны MeasureCode и codeListId, используем справочник
    if (measure.measureCode && measure.measureCodeListId) {
      const nameFromDict = getSanitaryMeasureNameByCode(measure.measureCode)
      if (nameFromDict) {
        return nameFromDict
      }
    }
    // Иначе используем MeasureName
    return measure.measureName || '-'
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
      title: 'Язык',
      key: 'language',
      width: 150,
      render: (_: any, record: SanitaryMeasure) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {record.languageCode ? `${record.languageCode.toUpperCase()} - ${getLanguageName(record.languageCode)}` : '-'}
        </div>
      ),
    },
    {
      title: 'Наименование меры',
      key: 'measureName',
      width: 300,
      render: (_: any, record: SanitaryMeasure) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {getMeasureName(record)}
        </div>
      ),
    },
    {
      title: 'Вид объекта действия',
      key: 'affectedObject',
      width: 150,
      render: (_: any, record: SanitaryMeasure) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {getMeasureAffectedObjectKindName(record.measureAffectedObjectKindCode)}
        </div>
      ),
    },
    {
      title: 'Начальная дата',
      key: 'startDate',
      width: 120,
      render: (_: any, record: SanitaryMeasure) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {formatDate(record.startDate)}
        </div>
      ),
    },
    {
      title: 'Конечная дата',
      key: 'endDate',
      width: 120,
      render: (_: any, record: SanitaryMeasure) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {formatDate(record.endDate)}
        </div>
      ),
    },
  ]

  if (!data || !data.measures || data.measures.length === 0) {
    return <div>Данные о принятых мерах не найдены</div>
  }

  const renderMeasureDetail = (measure: SanitaryMeasure) => (
    <div style={{ padding: '12px 24px 12px 0', background: '#fafafa' }}>
      <Descriptions column={1} bordered size="small" style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Обоснование">{measure.measureJustificationText || '—'}</Descriptions.Item>
        <Descriptions.Item label="Описание">{measure.description || '—'}</Descriptions.Item>
      </Descriptions>
      <Collapse
        defaultActiveKey={['measureDoc', 'initialMeasureDoc', 'basis', 'implementation']}
        expandIconPosition="end"
        items={[
          measure.measureDocDetails && {
            key: 'measureDoc',
            label: 'Документ, регламентирующий введение (отмену) меры',
            children: <MeasureDocDetailsView doc={measure.measureDocDetails} />,
          },
          measure.initialMeasureDocDetails && {
            key: 'initialMeasureDoc',
            label: 'Документ, регламентирующий введение исходной меры',
            children: <MeasureDocDetailsView doc={measure.initialMeasureDocDetails} />,
          },
          measure.measureInitiationBasisDetails && measure.measureInitiationBasisDetails.length > 0 && {
            key: 'basis',
            label: 'НПА-основание для введения меры',
            children: <MeasureInitiationBasisView items={measure.measureInitiationBasisDetails} />,
          },
          {
            key: 'implementation',
            label: 'Мероприятия, обеспечивающие соблюдение меры',
            children: measure.measureImplementationDetails && measure.measureImplementationDetails.length > 0 ? (
              <MeasureImplementationView items={measure.measureImplementationDetails} />
            ) : (
              <div style={{ color: '#999', fontStyle: 'italic' }}>Мероприятия не указаны</div>
            ),
          },
        ].filter(Boolean)}
      />
    </div>
  )

  return (
    <div>
      <p style={{ marginBottom: 8, color: '#666', fontSize: '12px' }}>Нажмите на иконку раскрытия (▶) у строки меры для просмотра детализации (обоснование, описание, документы, мероприятия).</p>
      <Table
        dataSource={data.measures}
        columns={columns}
        rowKey={(record, index) => `measure-${index}`}
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={() => ({})}
        rowClassName={(record, index) => selectedMeasureIndex === index ? 'ant-table-row-selected' : ''}
        expandable={{
          expandedRowKeys: selectedMeasureIndex !== null ? [`measure-${selectedMeasureIndex}`] : [],
          expandedRowRender: (record) => renderMeasureDetail(record),
          expandIcon: () => null,
          expandIconColumnIndex: -1,
        }}
      />
    </div>
  )
}

// Компонент для отображения MeasureDocDetails
const MeasureDocDetailsView: React.FC<{ doc: MeasureDocDetails }> = ({ doc }) => {
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="Страна">{getCountryDisplayLabel(doc.country)}</Descriptions.Item>
      <Descriptions.Item label="Язык">{getLanguageName(doc.languageCode)}</Descriptions.Item>
      <Descriptions.Item label="Вид">{doc.docKindName || '-'}</Descriptions.Item>
      <Descriptions.Item label="Наименование">{doc.docName || '-'}</Descriptions.Item>
      <Descriptions.Item label="Серия">{doc.docSeriesId || '-'}</Descriptions.Item>
      <Descriptions.Item label="Номер">{doc.docId || '-'}</Descriptions.Item>
      <Descriptions.Item label="Дата документа">{formatDate(doc.docCreationDate)}</Descriptions.Item>
      <Descriptions.Item label="Срок действия. Начало">{formatDate(doc.docStartDate)}</Descriptions.Item>
      <Descriptions.Item label="Срок действия. Окончание">{formatDate(doc.docValidityDate)}</Descriptions.Item>
      <Descriptions.Item label="Срок действия">{doc.docValidityDuration || '-'}</Descriptions.Item>
      <Descriptions.Item label="Уполномоченный орган. Идентификатор">{doc.authorityId || '-'}</Descriptions.Item>
      <Descriptions.Item label="Уполномоченный орган. Наименование">{doc.authorityName || '-'}</Descriptions.Item>
      <Descriptions.Item label="Описание">{doc.description || '-'}</Descriptions.Item>
      <Descriptions.Item label="Количество листов">{doc.pageQuantity || '-'}</Descriptions.Item>
      {doc.docBinaryText && doc.docBinaryText.content && (
        <Descriptions.Item label="Документ в бинарном виде">
          <Button 
            type="link" 
            icon={<DownloadOutlined />}
            onClick={() => {
              try {
                // Конвертируем base64 в blob
                const base64Content = doc.docBinaryText!.content!
                const binaryString = atob(base64Content)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i)
                }
                const blob = new Blob([bytes], { 
                  type: doc.docBinaryText!.mediaTypeCode || 'application/octet-stream' 
                })
                
                // Создаем ссылку для скачивания
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `document.${doc.docBinaryText!.mediaTypeCode?.split('/').pop() || 'bin'}`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
              } catch (error) {
                console.error('Ошибка при скачивании файла:', error)
                alert('Ошибка при скачивании файла')
              }
            }}
          >
            Скачать ({doc.docBinaryText.mediaTypeCode || 'файл'})
          </Button>
        </Descriptions.Item>
      )}
      {doc.xmlDocument && (
        <Descriptions.Item label="XML">
          <Button 
            type="link" 
            icon={<DownloadOutlined />}
            onClick={() => {
              try {
                const blob = new Blob([doc.xmlDocument!], { type: 'application/xml' })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = 'document.xml'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
              } catch (error) {
                console.error('Ошибка при скачивании XML:', error)
                alert('Ошибка при скачивании XML')
              }
            }}
          >
            Скачать XML
          </Button>
        </Descriptions.Item>
      )}
    </Descriptions>
  )
}

// Компонент для отображения MeasureInitiationBasisDetails
const MeasureInitiationBasisView: React.FC<{ items: MeasureInitiationBasisItem[] }> = ({ items }) => {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const columns = [
    { title: 'Вид', dataIndex: 'docKindName', key: 'docKindName', render: (text: string) => text || '-' },
    { title: 'Наименование', dataIndex: 'docName', key: 'docName', render: (text: string) => text || '-' },
    { title: 'Номер', dataIndex: 'docId', key: 'docId', render: (text: string) => text || '-' },
    { title: 'Дата', key: 'date', render: (_: any, record: MeasureInitiationBasisItem) => formatDate(record.docCreationDate) },
  ]

  return <Table dataSource={items} columns={columns} rowKey={(record, index) => `basis-${index}`} pagination={false} />
}

// Компонент для отображения MeasureImplementationDetails — все записи в аккордеоне
const MeasureImplementationView: React.FC<{ items: MeasureImplementationItem[] }> = ({ items }) => {
  const accordionItems = items.map((item, index) => ({
    key: String(index),
    label: `Сведения об исполнителе — ${index + 1}`,
    children: <MeasureImplementationDetailView item={item} />,
  }))
  return (
    <div>
      <Collapse accordion={false} defaultActiveKey={accordionItems.map((i) => i.key)} items={accordionItems} />
    </div>
  )
}

// Компонент для детализации одной записи мероприятия (Уполномоченный орган + Субъект-исполнитель + Документ + Место)
const MeasureImplementationDetailView: React.FC<{ item: MeasureImplementationItem }> = ({ item }) => {
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()

  return (
    <Collapse
      defaultActiveKey={['authority', 'subject', 'document', 'place']}
      items={[
        item.authority && {
          key: 'authority',
          label: 'Уполномоченный орган',
          children: (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Страна">{getCountryDisplayLabel(item.authority.country)}</Descriptions.Item>
              <Descriptions.Item label="Идентификатор">—</Descriptions.Item>
              <Descriptions.Item label="Наименование">{item.authority.authorityName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Краткое наименование">{item.authority.authorityBriefName || '-'}</Descriptions.Item>
            </Descriptions>
          ),
        },
        item.subjectDetails && {
          key: 'subject',
          label: 'Субъект-исполнитель',
          children: <SubjectDetailsUnifiedView subject={item.subjectDetails} />,
        },
        item.documentDetails && {
          key: 'document',
          label: 'Документ, устанавливающий мероприятие',
          children: <DocumentReferenceView doc={item.documentDetails} />,
        },
        item.placeDetails && {
          key: 'place',
          label: 'Место проведения мероприятия',
          children: (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Регион">{item.placeDetails.regionName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Код пункта пропуска">{item.placeDetails.borderCheckpointCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="Наименование пункта пропуска">{item.placeDetails.borderCheckpointName || '-'}</Descriptions.Item>
            </Descriptions>
          ),
        },
      ].filter(Boolean)}
    />
  )
}

// Единое отображение субъекта-исполнителя (без разделения на юрлицо/физлицо), порядок полей по ТЗ
const SubjectDetailsUnifiedView: React.FC<{ subject: SubjectDetails }> = ({ subject }) => {
  const { getNameByCode: getIdentityDocKindNameByCode } = useIdentityDocKindOptions()
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const be = subject.businessEntity
  const country = subject.country ?? be?.country
  const subjectName = subject.subjectName ?? be?.businessEntityName
  const briefName = be?.businessEntityBriefName
  const orgForm = be?.businessEntityTypeName || (be?.businessEntityTypeCode ? `Код: ${be.businessEntityTypeCode}` : undefined)
  const subjectId = be?.businessEntityId
  const identificationMethod = be?.identificationMethod
  const customsNumber = be?.customsNumber
  const taxpayerId = be?.taxpayerId
  const addressList = be?.addresses?.length
    ? getAddressListFromOrganization(be)
    : getAddressListFromSubject(subject)
  const addressLines = formatAddressList(addressList, getDefaultAddressKindName, getCountryDisplayLabel)
  const contacts = subject.contacts ?? be?.contacts ?? []

  return (
    <Descriptions column={1} bordered size="small">
      <Descriptions.Item label="Страна">{getCountryDisplayLabel(country)}</Descriptions.Item>
      <Descriptions.Item label="Наименование субъекта">{subjectName || '-'}</Descriptions.Item>
      <Descriptions.Item label="Краткое наименование">{briefName || '-'}</Descriptions.Item>
      <Descriptions.Item label="Организационно-правовая форма">{orgForm || '-'}</Descriptions.Item>
      <Descriptions.Item label="Идентификатор субъекта">{subjectId || '-'}</Descriptions.Item>
      <Descriptions.Item label="Метод идентификации">{identificationMethod || '-'}</Descriptions.Item>
      <Descriptions.Item label="Таможенный номер">{customsNumber || '-'}</Descriptions.Item>
      <Descriptions.Item label="Идентификатор налогоплательщика">{taxpayerId || '-'}</Descriptions.Item>
      {subject.identityDoc && (
        <>
          <Descriptions.Item label="Удостоверение личности. Страна">{getCountryDisplayLabel(subject.identityDoc.country)}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Вид документа">
            {subject.identityDoc.docKindCode && subject.identityDoc.docKindCodeListId === '2053'
              ? (getIdentityDocKindNameByCode(subject.identityDoc.docKindCode) ?? subject.identityDoc.docKindName ?? '-')
              : (subject.identityDoc.docKindName ?? '-')}
          </Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Серия">{subject.identityDoc.docSeriesId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Номер">{subject.identityDoc.docId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Дата">{formatDate(subject.identityDoc.docCreationDate)}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Срок действия">{formatDate(subject.identityDoc.docValidityDate)}</Descriptions.Item>
          <Descriptions.Item label="Уполномоченный орган. Идентификатор">{subject.identityDoc.authorityId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Уполномоченный орган. Наименование">{subject.identityDoc.authorityName || '-'}</Descriptions.Item>
        </>
      )}
      {addressLines.length > 0 && (
        <Descriptions.Item label="Адреса">
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {addressLines.map((line, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{line}</li>
            ))}
          </ul>
        </Descriptions.Item>
      )}
      {contacts.length > 0 && (
        <Descriptions.Item label="Контактный реквизит">
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {contacts.map((c, idx) => (
              <li key={idx}>
                {c.contactKind || ''}: {c.contactValue || ''}
              </li>
            ))}
          </ul>
        </Descriptions.Item>
      )}
    </Descriptions>
  )
}

// Компонент для отображения DocumentReferenceDetails
const DocumentReferenceView: React.FC<{ doc: DocumentReferenceDetails }> = ({ doc }) => {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  return (
    <Descriptions column={1} bordered size="small">
      <Descriptions.Item label="Вид">{doc.docKindName || (doc.docKindCode ? `Код: ${doc.docKindCode}` : 'не указан')}</Descriptions.Item>
      <Descriptions.Item label="Наименование">{doc.docName || '-'}</Descriptions.Item>
      <Descriptions.Item label="Номер">{doc.docId || '-'}</Descriptions.Item>
      <Descriptions.Item label="Дата документа">{formatDate(doc.docCreationDate)}</Descriptions.Item>
      <Descriptions.Item label="Срок действия. Начало">{formatDate(doc.docStartDate)}</Descriptions.Item>
    </Descriptions>
  )
}

export default MeasuresTab

