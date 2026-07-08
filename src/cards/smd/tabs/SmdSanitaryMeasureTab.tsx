import { Collapse, Descriptions } from 'antd'
import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { CardData } from '@/types/card'
import {
  MeasureDocDetailsView,
  MeasureInitiationBasisView,
} from '@/components/tabs/dpa/MeasuresTab'
import { useLanguageOptions } from '@/hooks/shared/useLanguageOptions'
import { useSanitaryMeasureOptions } from '@/hooks/shared/useSanitaryMeasureOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/shared/useSanitaryMeasureObjKindOptions'
import { useSanitaryMeasureReasonOptions } from '@/hooks/shared/useSanitaryMeasureReasonOptions'
import { getSmdPrimaryMeasure } from '../smdSanitaryMeasureModel'
import { getSmdRegulatoryMeasureDoc } from '../smdMeasureDoc'
import SmdSanitaryMeasureTabEdit from './SmdSanitaryMeasureTabEdit'
import SmdIncidentAlertsView from './SmdIncidentAlertsView'

interface SmdSanitaryMeasureTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
  regulatoryDocReadOnly?: boolean
}

const formatDate = (d: string | null | undefined) => {
  if (!d?.trim()) return '—'
  const date = new Date(d.slice(0, 10))
  if (isNaN(date.getTime())) return d
  return format(date, 'dd.MM.yyyy', { locale: ru })
}

/**
 * Санитарная мера (smcdo:SanitaryMeasureDetails) — SS.09.
 * Режим просмотра повторяет структуру формы редактирования без дублирования шапки карты.
 */
const SmdSanitaryMeasureTab: React.FC<SmdSanitaryMeasureTabProps> = ({
  data,
  editMode,
  onChange,
  regulatoryDocReadOnly,
}) => {
  const { getLangCatalogSelectOptions, getLanguageName } = useLanguageOptions()
  const { getNameByCode: getSanitaryMeasureNameByCode } = useSanitaryMeasureOptions()
  const { getNameByCode: getObjKindNameByCode } = useSanitaryMeasureObjKindOptions()
  const { getNameByCode: getReasonNameByCode } = useSanitaryMeasureReasonOptions()

  if (editMode && onChange) {
    return (
      <SmdSanitaryMeasureTabEdit
        data={data}
        onChange={onChange}
        regulatoryDocReadOnly={regulatoryDocReadOnly}
      />
    )
  }

  const measure = getSmdPrimaryMeasure(data)
  const regulatoryDoc = getSmdRegulatoryMeasureDoc(data)
  const langCode = (measure.languageCode || 'ru').trim().toLowerCase()
  const langLabel =
    getLangCatalogSelectOptions().find((o) => o.value === langCode)?.label ??
    `${langCode} — ${getLanguageName(langCode)}`

  const measureName = (() => {
    const code = measure.measureCode?.trim()
    if (code) {
      const name = getSanitaryMeasureNameByCode(code)
      return name ? `${code} — ${name}` : code
    }
    return measure.measureName?.trim() || '—'
  })()

  const objectKindLabel = (() => {
    const codes = (measure.measureAffectedObjectKindCode ?? '')
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
    if (codes.length === 0) return '—'
    return codes
      .map((code) => {
        const name = getObjKindNameByCode(code)
        return name ? `${code} — ${name}` : code
      })
      .join('; ')
  })()

  const basisList = measure.measureInitiationBasisDetails ?? []

  return (
    <div>
      <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Язык">{langLabel}</Descriptions.Item>
        <Descriptions.Item label="Наименование меры">{measureName}</Descriptions.Item>
        <Descriptions.Item label="Начальная дата">{formatDate(measure.startDate)}</Descriptions.Item>
        <Descriptions.Item label="Конечная дата">{formatDate(measure.endDate)}</Descriptions.Item>
        <Descriptions.Item label="Обоснование">{measure.measureJustificationText?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Описание">{measure.description?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Вид объекта действия меры">{objectKindLabel}</Descriptions.Item>
        <Descriptions.Item label="Код причины (основания) введения временной меры">
          {(() => {
            const code = measure.measureReasonCode?.trim()
            if (!code) return '—'
            const name = getReasonNameByCode(code)
            return name ? `${code} — ${name}` : code
          })()}
        </Descriptions.Item>
        <Descriptions.Item label="Условие снятия меры">
          {measure.measureRepealConditionText?.trim() || '—'}
        </Descriptions.Item>
      </Descriptions>

      <Collapse
        defaultActiveKey={['measureDoc']}
        expandIconPosition="end"
        items={[
          regulatoryDoc && {
            key: 'measureDoc',
            label: 'Документ, регламентирующий введение (отмену) меры',
            children: <MeasureDocDetailsView doc={regulatoryDoc} />,
          },
          measure.initialMeasureDocDetails && {
            key: 'initialMeasureDoc',
            label: 'Документ, регламентирующий введение исходной меры',
            children: <MeasureDocDetailsView doc={measure.initialMeasureDocDetails} />,
          },
          basisList.length > 0 && {
            key: 'basis',
            label: 'Основание для введения меры',
            children: <MeasureInitiationBasisView items={basisList} />,
          },
          {
            key: 'incident',
            label: 'Уведомление о нежелательной ситуации',
            children: <SmdIncidentAlertsView data={data} />,
          },
        ].filter(Boolean) as { key: string; label: string; children: ReactNode }[]}
      />
    </div>
  )
}

export default SmdSanitaryMeasureTab
