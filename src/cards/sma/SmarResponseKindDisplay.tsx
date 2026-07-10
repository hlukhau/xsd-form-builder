import { Segmented } from 'antd'
import type { SmarResponseKind } from '@/types/smaCard'

const KIND_LABELS: Record<SmarResponseKind, string> = {
  info: 'Дополнительные сведения',
  absent: 'Сведения отсутствуют',
}

export interface SmarResponseKindDisplayProps {
  value: SmarResponseKind
  editable?: boolean
  onChange?: (next: SmarResponseKind) => void
}

/** Вид ответа SMAR: в просмотре — яркая метка, в редактировании — Segmented. */
export function SmarResponseKindDisplay({ value, editable, onChange }: SmarResponseKindDisplayProps) {
  if (editable) {
    return (
      <Segmented
        value={value}
        onChange={(v) => onChange?.(v as SmarResponseKind)}
        options={[
          { label: KIND_LABELS.info, value: 'info' },
          { label: KIND_LABELS.absent, value: 'absent' },
        ]}
      />
    )
  }

  const label = KIND_LABELS[value] ?? KIND_LABELS.info
  return (
    <div
      style={{
        display: 'inline-block',
        padding: '6px 14px',
        borderRadius: 6,
        background: '#1890ff',
        color: '#ffffff',
        fontWeight: 600,
        fontSize: 14,
        lineHeight: 1.4,
        boxShadow: '0 1px 4px rgba(24, 144, 255, 0.35)',
      }}
    >
      {label}
    </div>
  )
}
