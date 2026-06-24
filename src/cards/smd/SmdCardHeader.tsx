import { Descriptions, Select } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { SmdMetadata } from '@/types/smdCard'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { DATE_TIME_DISPLAY_FORMAT_DATEFNS } from '@/constants/dateFormat'
import { getSmdMessageName, getSmdMessageOptionsForVersion } from '@/constants/smdCard'

interface SmdCardHeaderProps {
  meta: SmdMetadata
  onStatusClick: () => void
  isCreateMode?: boolean
  messageCode?: string | null
  onMessageCodeChange?: (code: string) => void
  /** Новая версия: вид сообщения обязателен, без значения по умолчанию. */
  requireMessageSelection?: boolean
}

const SmdCardHeader: React.FC<SmdCardHeaderProps> = ({
  meta,
  onStatusClick,
  isCreateMode,
  messageCode,
  onMessageCodeChange,
  requireMessageSelection,
}) => {
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()

  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return '—'
    const date = new Date(dateTime)
    if (isNaN(date.getTime())) return dateTime
    return format(date, DATE_TIME_DISPLAY_FORMAT_DATEFNS, { locale: ru })
  }

  const formatDocDate = (d: string | null | undefined) => {
    if (!d?.trim()) return isCreateMode ? '—' : '—'
    const date = new Date(d.slice(0, 10))
    if (isNaN(date.getTime())) return d
    return format(date, 'dd.MM.yyyy', { locale: ru })
  }

  const countryLabel =
    meta.docCountryCode && meta.docCountryName
      ? `${getCountryDisplayLabel(meta.docCountryCode)} — ${meta.docCountryName}`
      : meta.docCountryCode
        ? getCountryDisplayLabel(meta.docCountryCode)
        : meta.docCountryName ?? '—'

  const isEecSource = String(meta.dataSourceKindCode ?? '').trim() === '3'
  const version = meta.smdVersion ?? 1
  const messageOptions = getSmdMessageOptionsForVersion(version).map((o) => ({
    value: o.code,
    label: o.name,
  }))
  const effectiveMessageCode = requireMessageSelection
    ? messageCode?.trim() || undefined
    : messageCode ?? meta.messageCode ?? 'P.SS.09.MSG.001'

  return (
    <Descriptions
      column={{ xxl: 4, xl: 4, lg: 3, md: 2, sm: 1, xs: 1 }}
      bordered
      size="small"
      style={{ margin: 0 }}
      className="card-header-descriptions"
    >
      <Descriptions.Item label="Страна">{countryLabel}</Descriptions.Item>
      <Descriptions.Item label="Номер">{meta.docId?.trim() ? meta.docId : '—'}</Descriptions.Item>
      <Descriptions.Item label="Дата">{formatDocDate(meta.docCreationDate)}</Descriptions.Item>
      <Descriptions.Item label="Версия">{meta.smdVersion ?? '—'}</Descriptions.Item>
      <Descriptions.Item label="Источник">{meta.dataSourceKindName ?? '—'}</Descriptions.Item>
      {!isEecSource ? (
        <Descriptions.Item label="Статус">
          <a onClick={onStatusClick} style={{ cursor: 'pointer' }}>
            {meta.smdStatusName ?? '—'}
          </a>
        </Descriptions.Item>
      ) : (
        <Descriptions.Item label="Статус">—</Descriptions.Item>
      )}
      <Descriptions.Item label="Дополнительные сведения">{meta.smdStatusDesc?.trim() || '—'}</Descriptions.Item>
      <Descriptions.Item label="Результаты рассмотрения">{meta.smrStatusDesc?.trim() || '—'}</Descriptions.Item>
      <Descriptions.Item label="Вид сообщения">
        {isCreateMode && onMessageCodeChange ? (
          <Select
            size="small"
            style={{ minWidth: 280, width: '100%' }}
            value={effectiveMessageCode}
            placeholder={requireMessageSelection ? 'Выберите вид сообщения' : undefined}
            options={messageOptions}
            onChange={onMessageCodeChange}
            status={requireMessageSelection && !effectiveMessageCode ? 'error' : undefined}
          />
        ) : (
          meta.messageName ?? getSmdMessageName(meta.messageCode, version) ?? meta.messageCode ?? '—'
        )}
      </Descriptions.Item>
      <Descriptions.Item label="Дата и время создания">{formatDateTime(meta.creationDateTime)}</Descriptions.Item>
      <Descriptions.Item label="Дата и время изменения">{formatDateTime(meta.modificationDateTime)}</Descriptions.Item>
    </Descriptions>
  )
}

export default SmdCardHeader
