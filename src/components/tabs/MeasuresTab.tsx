import { useState, useEffect } from 'react'
import { Table, Button, Descriptions, Collapse } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import ManufacturerDetails from '../common/ManufacturerDetails'
import { getLanguageName } from '@/hooks/useLanguageOptions'
import { useSanitaryMeasureOptions } from '@/hooks/useSanitaryMeasureOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/useSanitaryMeasureObjKindOptions'
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
  const [selectedImplementationIndex, setSelectedImplementationIndex] = useState<number | null>(null)
  const { getNameByCode: getSanitaryMeasureNameByCode } = useSanitaryMeasureOptions()
  const { getNameByCode: getSanitaryMeasureObjKindNameByCode } = useSanitaryMeasureObjKindOptions()

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const getMeasureAffectedObjectKindName = (code?: string): string => {
    if (!code) return '-'
    const name = getSanitaryMeasureObjKindNameByCode(code)
    return name || `Вид объекта (код: ${code})`
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

  const getCountryName = (code?: string): string => {
    const countryMap: Record<string, string> = {
      'RU': 'Россия',
      'BY': 'Беларусь',
      'KZ': 'Казахстан',
    }
    return code ? (countryMap[code] || code) : '-'
  }

  const formatAddress = (address?: any): string => {
    if (!address) return '-'
    if (address.fullAddress) return address.fullAddress

    const parts = []
    if (address.country) parts.push(getCountryName(address.country))
    if (address.cityName) parts.push(address.cityName)
    if (address.streetName) parts.push(address.streetName)
    if (address.buildingNumberId) parts.push(address.buildingNumberId)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

  const columns = [
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
    {
      title: 'Обоснование',
      key: 'justification',
      width: 200,
      render: (_: any, record: SanitaryMeasure) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {record.measureJustificationText || '-'}
        </div>
      ),
    },
    {
      title: 'Описание',
      key: 'description',
      width: 200,
      render: (_: any, record: SanitaryMeasure) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {record.description || '-'}
        </div>
      ),
    },
  ]

  if (!data || !data.measures || data.measures.length === 0) {
    return <div>Данные о принятых мерах не найдены</div>
  }

  const selectedMeasure = selectedMeasureIndex !== null ? data.measures[selectedMeasureIndex] : null

  return (
    <div>
      <Table
        dataSource={data.measures}
        columns={columns}
        rowKey={(record, index) => `measure-${index}`}
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={(record, index) => ({
          onClick: () => {
            setSelectedMeasureIndex(selectedMeasureIndex === index ? null : index)
            setSelectedImplementationIndex(null)
          },
          style: { cursor: 'pointer' },
        })}
        rowClassName={(record, index) => selectedMeasureIndex === index ? 'ant-table-row-selected' : ''}
      />

      {/* Детализация выбранной меры */}
      {selectedMeasure && (
        <div style={{ marginTop: '24px' }}>
          <Collapse
            defaultActiveKey={['measureDoc', 'initialMeasureDoc', 'basis', 'implementation']}
            expandIconPosition="end"
            items={[
              // Документ, регламентирующий введение (отмену) меры
              selectedMeasure.measureDocDetails && {
                key: 'measureDoc',
                label: 'Документ, регламентирующий введение (отмену) меры',
                children: <MeasureDocDetailsView doc={selectedMeasure.measureDocDetails} />,
              },
              // Документ, регламентирующий введение исходной меры
              selectedMeasure.initialMeasureDocDetails && {
                key: 'initialMeasureDoc',
                label: 'Документ, регламентирующий введение исходной меры',
                children: <MeasureDocDetailsView doc={selectedMeasure.initialMeasureDocDetails} />,
              },
              // НПА-основание для введения меры
              selectedMeasure.measureInitiationBasisDetails && selectedMeasure.measureInitiationBasisDetails.length > 0 && {
                key: 'basis',
                label: 'НПА-основание для введения меры',
                children: <MeasureInitiationBasisView items={selectedMeasure.measureInitiationBasisDetails} />,
              },
              // Мероприятия, обеспечивающие соблюдение меры (всегда показываем секцию)
              {
                key: 'implementation',
                label: 'Мероприятия, обеспечивающие соблюдение меры',
                children: selectedMeasure.measureImplementationDetails && selectedMeasure.measureImplementationDetails.length > 0 ? (
                  <MeasureImplementationView
                    items={selectedMeasure.measureImplementationDetails}
                    selectedIndex={selectedImplementationIndex}
                    onRowClick={(index) => {
                      setSelectedImplementationIndex(selectedImplementationIndex === index ? null : index)
                    }}
                  />
                ) : (
                  <div style={{ color: '#999', fontStyle: 'italic' }}>
                    Мероприятия не указаны
                  </div>
                ),
              },
            ].filter(Boolean)}
          />

        </div>
      )}
    </div>
  )
}

// Компонент для отображения MeasureDocDetails
const MeasureDocDetailsView: React.FC<{ doc: MeasureDocDetails }> = ({ doc }) => {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const getCountryName = (code?: string): string => {
    const countryMap: Record<string, string> = {
      'RU': 'Россия',
      'BY': 'Беларусь',
      'KZ': 'Казахстан',
    }
    return code ? (countryMap[code] || code) : '-'
  }

  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="Страна">{getCountryName(doc.country)}</Descriptions.Item>
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
      {doc.docBinaryText && (
        <Descriptions.Item label="Документ в бинарном виде">
          <Button type="link" icon={<DownloadOutlined />}>
            Скачать ({doc.docBinaryText.mediaTypeCode || 'файл'})
          </Button>
        </Descriptions.Item>
      )}
      {doc.xmlDocument && (
        <Descriptions.Item label="XML">
          <Button type="link" icon={<DownloadOutlined />}>
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

// Компонент для отображения MeasureImplementationDetails
const MeasureImplementationView: React.FC<{
  items: MeasureImplementationItem[]
  selectedIndex: number | null
  onRowClick: (index: number) => void
}> = ({ items, selectedIndex, onRowClick }) => {
  const { getNameByCode: getSanitaryMeasureObjKindNameByCode } = useSanitaryMeasureObjKindOptions()
  const [objKindNamesCache, setObjKindNamesCache] = useState<Record<string, string>>({})

  // Загружаем названия видов объектов действия
  useEffect(() => {
    const loadObjKindNames = async () => {
      const names: Record<string, string> = {}
      for (const item of items) {
        if (item.measureAffectedObjectKindCode) {
          try {
            const name = await getSanitaryMeasureObjKindNameByCode(item.measureAffectedObjectKindCode)
            if (name) {
              names[item.measureAffectedObjectKindCode] = name
            }
          } catch (error) {
            console.error('Ошибка загрузки названия вида объекта действия:', error)
          }
        }
      }
      setObjKindNamesCache(names)
    }

    loadObjKindNames()
  }, [items, getSanitaryMeasureObjKindNameByCode])

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const getCountryName = (code?: string): string => {
    const countryMap: Record<string, string> = {
      'RU': 'Россия',
      'BY': 'Беларусь',
      'KZ': 'Казахстан',
    }
    return code ? (countryMap[code] || code) : '-'
  }

  const getMeasureAffectedObjectKindName = (code?: string): string => {
    if (!code) return '-'
    const name = getSanitaryMeasureObjKindNameByCode(code)
    return name || `Вид объекта (код: ${code})`
  }

  const columns = [
    { title: 'Страна', key: 'country', render: (_: any, record: MeasureImplementationItem) => getCountryName(record.country) },
    { title: 'Начальная дата', key: 'startDate', render: (_: any, record: MeasureImplementationItem) => formatDate(record.startDate) },
    { title: 'Конечная дата', key: 'endDate', render: (_: any, record: MeasureImplementationItem) => formatDate(record.endDate) },
    { title: 'Описание', dataIndex: 'description', key: 'description', render: (text: string) => text || '-' },
    { title: 'Вид объекта действия', key: 'affectedObject', render: (_: any, record: MeasureImplementationItem) => getMeasureAffectedObjectKindName(record.measureAffectedObjectKindCode) },
  ]

  return (
    <div>
      <Table
        dataSource={items}
        columns={columns}
        rowKey={(record, index) => `impl-${index}`}
        pagination={false}
        onRow={(record, index) => ({
          onClick: () => onRowClick(index),
          style: { cursor: 'pointer' },
        })}
        rowClassName={(record, index) => selectedIndex === index ? 'ant-table-row-selected' : ''}
      />
      {selectedIndex !== null && items[selectedIndex] && (
        <div style={{ marginTop: '16px' }}>
          <MeasureImplementationDetailView item={items[selectedIndex]} />
        </div>
      )}
    </div>
  )
}

// Компонент для детализации мероприятия
const MeasureImplementationDetailView: React.FC<{ item: MeasureImplementationItem }> = ({ item }) => {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const getCountryName = (code?: string): string => {
    const countryMap: Record<string, string> = {
      'RU': 'Россия',
      'BY': 'Беларусь',
      'KZ': 'Казахстан',
    }
    return code ? (countryMap[code] || code) : '-'
  }

  const formatAddress = (address?: any): string => {
    if (!address) return '-'
    if (address.fullAddress) return address.fullAddress
    const parts = []
    if (address.country) parts.push(getCountryName(address.country))
    if (address.cityName) parts.push(address.cityName)
    if (address.streetName) parts.push(address.streetName)
    if (address.buildingNumberId) parts.push(address.buildingNumberId)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

  return (
    <Collapse
      defaultActiveKey={['authority', 'subject', 'document', 'place']}
      items={[
        item.authority && {
          key: 'authority',
          label: 'Уполномоченный орган',
          children: (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Страна">{getCountryName(item.authority.country)}</Descriptions.Item>
              <Descriptions.Item label="Идентификатор">{item.authority.authorityId || '-'}</Descriptions.Item>
              <Descriptions.Item label="Наименование">{item.authority.authorityName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Краткое наименование">{item.authority.authorityBriefName || '-'}</Descriptions.Item>
            </Descriptions>
          ),
        },
        item.subjectDetails && {
          key: 'subject',
          label: item.subjectDetails.businessEntity ? 'Субъект-исполнитель (юрлицо ИП)' : 'Субъект-исполнитель (физлицо)',
          children: item.subjectDetails.businessEntity ? (
            <ManufacturerDetails data={item.subjectDetails.businessEntity} title="Организация" />
          ) : (
            <SubjectPhysicalPersonView subject={item.subjectDetails} />
          ),
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

// Компонент для отображения физлица
const SubjectPhysicalPersonView: React.FC<{ subject: SubjectDetails }> = ({ subject }) => {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const getCountryName = (code?: string): string => {
    const countryMap: Record<string, string> = {
      'RU': 'Россия',
      'BY': 'Беларусь',
      'KZ': 'Казахстан',
    }
    return code ? (countryMap[code] || code) : '-'
  }

  const formatAddress = (address?: any): string => {
    if (!address) return '-'
    if (address.fullAddress) return address.fullAddress
    const parts = []
    if (address.country) parts.push(getCountryName(address.country))
    if (address.cityName) parts.push(address.cityName)
    if (address.streetName) parts.push(address.streetName)
    if (address.buildingNumberId) parts.push(address.buildingNumberId)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="Страна">{getCountryName(subject.country)}</Descriptions.Item>
      <Descriptions.Item label="ФИО">{subject.subjectName || '-'}</Descriptions.Item>
      {subject.identityDoc && (
        <>
          <Descriptions.Item label="Удостоверение личности. Страна">{getCountryName(subject.identityDoc.country)}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Вид документа">{subject.identityDoc.docKindName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Серия">{subject.identityDoc.docSeriesId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Номер">{subject.identityDoc.docId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Дата">{formatDate(subject.identityDoc.docCreationDate)}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Срок действия">{formatDate(subject.identityDoc.docValidityDate)}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Уполномоченный орган. Идентификатор">{subject.identityDoc.authorityId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Уполномоченный орган. Наименование">{subject.identityDoc.authorityName || '-'}</Descriptions.Item>
        </>
      )}
      <Descriptions.Item label="Удостоверение личности. Адрес регистрации">{formatAddress(subject.registrationAddress)}</Descriptions.Item>
      <Descriptions.Item label="Удостоверение личности. Фактический адрес">{formatAddress(subject.actualAddress)}</Descriptions.Item>
      <Descriptions.Item label="Удостоверение личности. Почтовый адрес">{formatAddress(subject.mailingAddress)}</Descriptions.Item>
      {subject.contacts && subject.contacts.length > 0 && (
        <Descriptions.Item label="Удостоверение личности. Контактный реквизит">
          <div>
            {subject.contacts.map((contact, index) => (
              <div key={index}>
                {contact.contactKind || ''}: {contact.contactValue || ''}
              </div>
            ))}
          </div>
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

