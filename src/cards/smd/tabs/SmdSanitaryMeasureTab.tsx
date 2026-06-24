import { Descriptions } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { CardData } from '@/types/card'
import MeasuresTab from '@/components/tabs/dpa/MeasuresTab'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useLanguageOptions } from '@/hooks/shared/useLanguageOptions'
import { getSmdMessageName } from '@/constants/smdCard'
import { resolveSmdMeasureEndDate, resolveSmdMeasureStartDate } from '../smdMeasureDates'
import { getSmdPrimaryMeasure } from '../smdSanitaryMeasureModel'
import SmdSanitaryMeasureTabEdit from './SmdSanitaryMeasureTabEdit'

interface SmdSanitaryMeasureTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
  regulatoryDocReadOnly?: boolean
}

/**
 * Санитарная мера (smcdo:SanitaryMeasureDetails) — SS.09.
 */
const SmdSanitaryMeasureTab: React.FC<SmdSanitaryMeasureTabProps> = ({
  data,
  editMode,
  onChange,
  regulatoryDocReadOnly,
}) => {
  const { getDisplayLabel } = useCountryOptions()
  const { getLanguageName } = useLanguageOptions()
  const measure = getSmdPrimaryMeasure(data)
  const doc = measure.measureDocDetails
  const countryCode = (doc?.country || data.country || 'BY').trim().toUpperCase().slice(0, 2)
  const countryLabel = `${getDisplayLabel(countryCode)} — ${countryCode}`
  const langCode = (measure.languageCode || 'ru').trim().toLowerCase()
  const messageCode = data.electronicDocument?.messageCode ?? 'P.SS.09.MSG.001'
  const messageLabel = getSmdMessageName(messageCode, data.version) ?? messageCode

  if (editMode && onChange) {
    return (
      <SmdSanitaryMeasureTabEdit
        data={data}
        onChange={onChange}
        regulatoryDocReadOnly={regulatoryDocReadOnly}
      />
    )
  }

  const formatDate = (d: string | null | undefined) => {
    if (!d?.trim()) return '—'
    const date = new Date(d.slice(0, 10))
    if (isNaN(date.getTime())) return d
    return format(date, 'dd.MM.yyyy', { locale: ru })
  }

  return (
    <div>
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Страна">{countryLabel}</Descriptions.Item>
        <Descriptions.Item label="Язык">
          {langCode} — {getLanguageName(langCode)}
        </Descriptions.Item>
        <Descriptions.Item label="Вид сообщения" span={2}>
          {messageLabel}
        </Descriptions.Item>
        <Descriptions.Item label="Начальная дата">
          {formatDate(resolveSmdMeasureStartDate(data))}
        </Descriptions.Item>
        <Descriptions.Item label="Конечная дата">
          {formatDate(resolveSmdMeasureEndDate(data))}
        </Descriptions.Item>
      </Descriptions>
      <MeasuresTab data={{ measures: [measure] }} />
    </div>
  )
}

export default SmdSanitaryMeasureTab
