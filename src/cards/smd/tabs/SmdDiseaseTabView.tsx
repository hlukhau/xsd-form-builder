import { Collapse, Descriptions, Empty, Table } from 'antd'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { CardData, DetectionPlaceData } from '@/types/card'
import DetectionPlaceTab from '@/components/tabs/dpa/DetectionPlaceTab'
import { useAgeGroupOptions } from '@/hooks/shared/useAgeGroupOptions'
import { useDiseaseOutcomeOptions } from '@/hooks/shared/useDiseaseOutcomeOptions'

const INDICATOR_LABELS: Record<0 | 1 | null | undefined, string> = {
  0: 'Нет',
  1: 'Да',
  null: 'Не указано',
  undefined: 'Не указано',
}

function formatDate(date: string | null | undefined) {
  if (!date?.trim()) return '—'
  const dateOnly = String(date).trim().slice(0, 10)
  if (dateOnly.length !== 10) return date
  try {
    return format(parseISO(dateOnly), 'dd.MM.yyyy', { locale: ru })
  } catch {
    return date
  }
}

function formatCodeName(code: string | undefined, getName: (c: string | undefined) => string | null): string {
  const c = (code ?? '').trim()
  if (!c) return '—'
  const name = getName(c)
  return name ? `${c} — ${name}` : c
}

function hasDetectionPlaceContent(place?: DetectionPlaceData): boolean {
  if (!place) return false
  return !!(place.organization || place.borderCheckpoint || place.address || place.geoCoordinates || place.description)
}

function hasIncidentContent(data: CardData): boolean {
  const d = data.phaDisease
  const groups = data.phaPatientGroups ?? []
  const zones = data.spreadingZones?.length
    ? data.spreadingZones
    : data.spreadingZone
      ? [data.spreadingZone]
      : []
  return !!(
    d?.diseaseCode?.trim() ||
    d?.diseaseName?.trim() ||
    d?.firstCaseDate?.trim() ||
    d?.lastCaseDate?.trim() ||
    d?.crossborderSpreadRiskIndicator != null ||
    (d?.pathogens?.length ?? 0) > 0 ||
    groups.length > 0 ||
    hasDetectionPlaceContent(data.detectionPlace) ||
    zones.some((z) => hasDetectionPlaceContent(z))
  )
}

/**
 * Болезнь SMD (smcdo:PublicHealthIncidentDetails) — SS.09, все блоки на одной вкладке.
 */
const SmdDiseaseTabView: React.FC<{ data: CardData }> = ({ data }) => {
  const d = data.phaDisease
  const pathogens = d?.pathogens ?? []
  const groups = data.phaPatientGroups ?? []
  const spreadingZones =
    data.spreadingZones && data.spreadingZones.length > 0
      ? data.spreadingZones
      : data.spreadingZone
        ? [data.spreadingZone]
        : []

  const { getNameByCode: getAgeGroupNameByCode } = useAgeGroupOptions()
  const { getNameByCode: getDiseaseOutcomeNameByCode } = useDiseaseOutcomeOptions()

  if (!hasIncidentContent(data)) {
    return <Empty description="Нет данных по болезни" />
  }

  const crossborderLabel =
    d?.crossborderSpreadRiskIndicator != null
      ? INDICATOR_LABELS[d.crossborderSpreadRiskIndicator as 0 | 1]
      : INDICATOR_LABELS.undefined

  return (
    <div>
      <Descriptions column={1} bordered title="Болезнь" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Код болезни">{d?.diseaseCode?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Наименование болезни">{d?.diseaseName?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Дата первого случая">{formatDate(d?.firstCaseDate)}</Descriptions.Item>
        <Descriptions.Item label="Дата последнего случая" title="Дата закрытия (архивации) нежелательной ситуации">
          {formatDate(d?.lastCaseDate)}
        </Descriptions.Item>
        <Descriptions.Item label="Риск трансграничного распространения">{crossborderLabel}</Descriptions.Item>
      </Descriptions>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Возбудитель</div>
        {pathogens.length > 0 ? (
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={pathogens}
            pagination={false}
            columns={[
              { title: 'Тип', dataIndex: 'pathogenKindName', key: 'type', render: (v: string) => v?.trim() || '—' },
              { title: 'Наименование', dataIndex: 'pathogenName', key: 'name', render: (v: string) => v?.trim() || '—' },
            ]}
          />
        ) : (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Сведения">Нет записей о возбудителях.</Descriptions.Item>
          </Descriptions>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Группа пациентов</div>
        {groups.length > 0 ? (
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={groups}
            pagination={false}
            columns={[
              {
                title: 'Количество человек',
                dataIndex: 'personQuantity',
                key: 'personQuantity',
                render: (v: string) => v?.trim() || '—',
              },
              {
                title: 'Возрастная группа',
                dataIndex: 'ageGroupCode',
                key: 'ageGroupCode',
                render: (v: string) => formatCodeName(v, getAgeGroupNameByCode),
              },
              {
                title: 'Исход болезни',
                dataIndex: 'diseaseOutcomeCode',
                key: 'diseaseOutcomeCode',
                render: (v: string) => formatCodeName(v, getDiseaseOutcomeNameByCode),
              },
              {
                title: 'Наличие лабораторного подтверждения',
                dataIndex: 'laboratoryConfirmedIndicator',
                key: 'laboratoryConfirmedIndicator',
                render: (v: 0 | 1 | null | undefined) => INDICATOR_LABELS[v ?? undefined],
              },
            ]}
          />
        ) : (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Сведения">Нет данных о группах пациентов.</Descriptions.Item>
          </Descriptions>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Место обнаружения</div>
        {hasDetectionPlaceContent(data.detectionPlace) && data.detectionPlace ? (
          <DetectionPlaceTab data={data.detectionPlace} label="месте обнаружения" />
        ) : (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Сведения">Нет данных о месте обнаружения.</Descriptions.Item>
          </Descriptions>
        )}
      </div>

      <div>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Зона распространения</div>
        {spreadingZones.length > 0 ? (
          <Collapse
            accordion
            expandIconPosition="end"
            items={spreadingZones.map((zone, i) => ({
              key: String(i),
              label: `Зона распространения ${i + 1}`,
              children: <DetectionPlaceTab data={zone} label="зоне распространения" />,
            }))}
          />
        ) : (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Сведения">Нет данных о зонах распространения.</Descriptions.Item>
          </Descriptions>
        )}
      </div>
    </div>
  )
}

export default SmdDiseaseTabView
