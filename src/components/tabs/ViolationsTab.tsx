import { Descriptions, Table } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ViolationsData, ViolatedRequirement, ViolatedIndicator } from '@/types/card'

interface ViolationsTabProps {
  data: ViolationsData
}

const ViolationsTab: React.FC<ViolationsTabProps> = ({ data }) => {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const formatStructuralElements = (elements?: Array<{ elementName?: string; elementId?: string }>) => {
    if (!elements || elements.length === 0) return '-'
    return elements.map((el, idx) => {
      const name = el.elementName || ''
      const id = el.elementId || ''
      return `${name}${id ? ` ${id}` : ''}`
    }).join('; ')
  }

  const requirementsColumns = [
    {
      title: 'Номер техрегламента',
      dataIndex: 'technicalRegulationId',
      key: 'technicalRegulationId',
      width: 120,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Наименование техрегламента',
      dataIndex: 'technicalRegulationName',
      key: 'technicalRegulationName',
      width: 180,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Регистрационный номер',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
      width: 120,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Вид структурного элемента',
      key: 'structuralElementName',
      width: 120,
      render: (_: any, record: ViolatedRequirement) => {
        if (!record.structuralElements || record.structuralElements.length === 0) return '-'
        const text = record.structuralElements.map(el => el.elementName || '-').join('; ')
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Номер структурного элемента',
      key: 'structuralElementId',
      width: 120,
      render: (_: any, record: ViolatedRequirement) => {
        if (!record.structuralElements || record.structuralElements.length === 0) return '-'
        const text = record.structuralElements.map(el => el.elementId || '-').join('; ')
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Наименование утверждающего документа',
      key: 'approvingDocName',
      width: 180,
      render: (_: any, record: ViolatedRequirement) => {
        const text = record.approvingDocument?.docName || '-'
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Номер утверждающего документа',
      key: 'approvingDocId',
      width: 120,
      render: (_: any, record: ViolatedRequirement) => {
        const text = record.approvingDocument?.docId || '-'
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Дата утверждающего документа',
      key: 'approvingDocDate',
      width: 120,
      render: (_: any, record: ViolatedRequirement) => {
        const text = formatDate(record.approvingDocument?.docCreationDate)
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Дата начала действия утверждающего документа',
      key: 'approvingDocStartDate',
      width: 180,
      render: (_: any, record: ViolatedRequirement) => {
        const text = formatDate(record.approvingDocument?.docStartDate)
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      width: 500,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
  ]

  const indicatorsColumns = [
    {
      title: 'Нормативный показатель',
      key: 'isNormative',
      width: 150,
      render: (_: any, record: ViolatedIndicator) => {
        const text = record.isNormative === undefined 
          ? '-' 
          : (record.isNormative ? 'Да (нормативный)' : 'Нет (фактический)')
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Наименование показателя',
      dataIndex: 'indicatorName',
      key: 'indicatorName',
      width: 200,
      render: (text: string, record: ViolatedIndicator) => {
        const displayText = text || record.indicatorCode || '-'
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {displayText}
          </div>
        )
      },
    },
    {
      title: 'Значение показателя',
      dataIndex: 'indicatorValue',
      key: 'indicatorValue',
      width: 150,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Единица измерения',
      key: 'unit',
      width: 150,
      render: (_: any, record: ViolatedIndicator) => {
        const text = record.unitName || record.unitCode || '-'
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Примечание',
      dataIndex: 'note',
      key: 'note',
      width: 300,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
  ]

  if (!data) {
    return <div>Данные о нарушениях не найдены</div>
  }

  return (
    <div>
      {/* Общая характеристика нарушений */}
      {data.generalDescription && (
        <div style={{ marginBottom: '24px' }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Описание нарушения">
              {data.generalDescription}
            </Descriptions.Item>
          </Descriptions>
        </div>
      )}

      {/* Таблица нарушенных требований */}
      <div style={{ marginBottom: '24px' }}>
        <h3>Перечень нарушенных требований</h3>
        <div style={{ 
          overflowX: 'auto',
          width: '100%',
        }}>
          <Table
            dataSource={data.violatedRequirements || []}
            columns={requirementsColumns}
            rowKey={(record, index) => `requirement-${index}`}
            pagination={false}
            size="small"
            style={{ 
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Таблица нарушенных показателей */}
      <div>
        <h3>Перечень нарушенных показателей</h3>
        <div style={{ 
          overflowX: 'auto',
          width: '100%',
        }}>
          <Table
            dataSource={data.violatedIndicators || []}
            columns={indicatorsColumns}
            rowKey={(record, index) => `indicator-${index}`}
            pagination={false}
            size="small"
            style={{ 
              width: '100%',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default ViolationsTab

