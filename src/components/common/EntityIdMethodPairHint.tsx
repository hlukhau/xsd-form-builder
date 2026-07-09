import type { EntityIdMethodSource } from '@/utils/businessEntityIdentificationValidation'
import { getEntityIdMethodPairInlineHint } from '@/utils/businessEntityIdentificationValidation'

interface EntityIdMethodPairHintProps {
  source: EntityIdMethodSource | undefined | null
  style?: React.CSSProperties
}

/** Сообщение о паре «идентификатор субъекта ↔ метод идентификации» под полями формы. */
export function EntityIdMethodPairHint({ source, style }: EntityIdMethodPairHintProps) {
  const hint = getEntityIdMethodPairInlineHint(source)
  if (!hint.hasError) return null
  return (
    <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2, marginBottom: 8, ...style }}>
      {hint.message}
    </div>
  )
}
