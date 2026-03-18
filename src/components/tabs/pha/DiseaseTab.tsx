import { Descriptions, Table } from 'antd'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { CardData } from '@/types/card'

interface DiseaseTabProps {
  data: CardData
}

const CROSSBORDER_LABELS: Record<0 | 1 | null | undefined, string> = {
  0: 'Нет',
  1: 'Да',
  null: 'Не указано',
  undefined: 'Не указано',
}

/**
 * Болезнь — общие данные по болезни (R.SM.SS.08.001):
 * smcdo:DiseaseHealthProblemDetails, csdo:EventDate, csdo:EndDate, smsdo:CrossborderSpreadRiskIndicator, таблица smcdo:PathogenDetails.
 */
const DiseaseTab: React.FC<DiseaseTabProps> = ({ data }) => {
  const d = data.phaDisease
  const pathogens = d?.pathogens ?? []

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—'
    const dateOnly = String(date).trim().slice(0, 10)
    if (dateOnly.length !== 10) return date
    try {
      return format(parseISO(dateOnly), 'dd.MM.yyyy', { locale: ru })
    } catch {
      return date
    }
  }

  const crossborderLabel = d?.crossborderSpreadRiskIndicator != null
    ? CROSSBORDER_LABELS[d.crossborderSpreadRiskIndicator as 0 | 1]
    : CROSSBORDER_LABELS.undefined

  if (!d) {
    return (
      <Descriptions column={1} bordered title="Болезнь">
        <Descriptions.Item label="Сведения">Нет данных по болезни.</Descriptions.Item>
      </Descriptions>
    )
  }

  return (
    <div>
      <Descriptions column={1} bordered title="Общие данные по болезни (smcdo:DiseaseHealthProblemDetails, EventDate, EndDate, CrossborderSpreadRiskIndicator)">
        <Descriptions.Item label="Код болезни">
          {d.diseaseCode ?? '—'}
          <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>smsdo:DiseaseHealthProblemCode. Справочник ЕЭК на данный момент отсутствует (атрибут не заполняется).</div>
        </Descriptions.Item>
        <Descriptions.Item label="Наименование болезни">
          {d.diseaseName ?? '—'}
          <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>smsdo:DiseaseHealthProblemName. Для исходящих — справочник болезней (diseasehealthproblem).</div>
        </Descriptions.Item>
        <Descriptions.Item label="Дата первого случая">
          {formatDate(d.firstCaseDate)}
          <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>csdo:EventDate.</div>
        </Descriptions.Item>
        <Descriptions.Item label="Дата последнего случая">
          {formatDate(d.lastCaseDate)}
          <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>csdo:EndDate (дата закрытия/архивации нежелательной ситуации).</div>
        </Descriptions.Item>
        <Descriptions.Item label="Риск трансграничного распространения">
          {crossborderLabel}
          <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>smsdo:CrossborderSpreadRiskIndicator: 0 — Нет, 1 — Да, отсутствует — Не указано.</div>
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>Возбудитель (smcdo:PathogenDetails)</strong>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>Тип — smsdo:PathogenKindName (справочник pathogenkind). Наименование — smsdo:PathogenName.</div>
        </div>
        {pathogens.length > 0 ? (
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={pathogens}
            pagination={false}
            columns={[
              { title: 'Тип', dataIndex: 'pathogenKindName', key: 'pathogenKindName', render: (v: string) => v ?? '—' },
              { title: 'Наименование', dataIndex: 'pathogenName', key: 'pathogenName', render: (v: string) => v ?? '—' },
            ]}
          />
        ) : (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Сведения">Нет записей о возбудителях.</Descriptions.Item>
          </Descriptions>
        )}
      </div>
    </div>
  )
}

export default DiseaseTab
