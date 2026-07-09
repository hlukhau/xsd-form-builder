import { Descriptions } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { MeasureDocDetails } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { formatSmrCountryName } from '@/cards/smr/smrDisplayUtils'

function formatDocDate(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  const dateObj = new Date(value)
  if (Number.isNaN(dateObj.getTime())) return value.trim()
  return format(dateObj, 'dd.MM.yyyy', { locale: ru })
}

interface SmrSourceMeasureCardViewProps {
  doc: MeasureDocDetails | null | undefined
  /** Страна из шапки карты (если в doc пусто). */
  countryCodeFallback?: string | null
  docIdFallback?: string | null
  docDateFallback?: string | null
}

/** Только страна, номер и дата исходной карты SMD (smcdo:MeasureDocDetails). */
export function SmrSourceMeasureCardView({
  doc,
  countryCodeFallback,
  docIdFallback,
  docDateFallback,
}: SmrSourceMeasureCardViewProps) {
  const { countryOptions } = useCountryOptions()
  const countryCode = (doc?.country ?? countryCodeFallback ?? '').trim()
  const docId = (doc?.docId ?? docIdFallback ?? '').trim()
  const docDate = (doc?.docCreationDate ?? docDateFallback ?? '').trim()

  return (
    <Descriptions
      column={1}
      bordered
      size="small"
      className="smr-source-measure-card-descriptions"
      labelStyle={{ width: 200, padding: '4px 12px' }}
      contentStyle={{ padding: '4px 12px' }}
    >
      <Descriptions.Item label="Страна">
        {formatSmrCountryName(countryCode, countryOptions)}
      </Descriptions.Item>
      <Descriptions.Item label="Номер документа">{docId || '—'}</Descriptions.Item>
      <Descriptions.Item label="Дата документа">{formatDocDate(docDate)}</Descriptions.Item>
    </Descriptions>
  )
}
