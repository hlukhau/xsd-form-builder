import { Descriptions, Table } from 'antd'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { CardData } from '@/types/card'
import DetectionPlaceTab from '@/components/tabs/dpa/DetectionPlaceTab'
import SpreadingZonesTable from '@/components/tabs/shared/SpreadingZonesTable'
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

/** ТЗ: «код - наименование» для справочников agegr и diseaseoutcome. */
function formatCodeName(code: string | undefined, getName: (c: string | undefined) => string | null): string {
  const c = (code ?? '').trim()
  if (!c) return '—'
  const name = getName(c)
  return name ? `${c} - ${name}` : c
}

function spreadingZonesList(data: CardData) {
  if (data.spreadingZones && data.spreadingZones.length > 0) return data.spreadingZones
  if (data.spreadingZone) return [data.spreadingZone]
  return []
}

/**
 * Болезнь SMD (smcdo:PublicHealthIncidentDetails) — R.SM.SS.09.001, все блоки на одной вкладке.
 */
const SmdDiseaseTabView: React.FC<{ data: CardData }> = ({ data }) => {
  const d = data.phaDisease
  const pathogens = d?.pathogens ?? []
  const groups = data.phaPatientGroups ?? []
  const spreadingZones = spreadingZonesList(data)

  const { getNameByCode: getAgeGroupNameByCode } = useAgeGroupOptions()
  const { getNameByCode: getDiseaseOutcomeNameByCode } = useDiseaseOutcomeOptions()

  const crossborderLabel =
    d?.crossborderSpreadRiskIndicator != null
      ? INDICATOR_LABELS[d.crossborderSpreadRiskIndicator as 0 | 1]
      : INDICATOR_LABELS.undefined

  return (
    <div>
      <Descriptions column={1} bordered title="Болезнь" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Код болезни">—</Descriptions.Item>
        <Descriptions.Item label="Наименование болезни">{d?.diseaseName?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Дата первого случая">{formatDate(d?.firstCaseDate)}</Descriptions.Item>
        <Descriptions.Item
          label={
            <span title="Дата закрытия (архивации) нежелательной ситуации">Дата последнего случая</span>
          }
        >
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
          <div style={{ color: '#8c8c8c' }}>Нет записей о возбудителях.</div>
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
          <div style={{ color: '#8c8c8c' }}>Нет данных о группах пациентов.</div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Место обнаружения</div>
        <DetectionPlaceTab data={data.detectionPlace ?? {}} label="месте обнаружения" />
      </div>

      <div>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Зона распространения</div>
        <SpreadingZonesTable zones={spreadingZones} />
      </div>
    </div>
  )
}

export default SmdDiseaseTabView
