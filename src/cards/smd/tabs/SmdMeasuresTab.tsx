import MeasuresTab from '@/components/tabs/dpa/MeasuresTab'
import MeasuresTabEdit from '@/components/tabs/dpa/MeasuresTabEdit'
import type { CardData, MeasuresData } from '@/types/card'

interface SmdMeasuresTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
}

/** Мероприятия (smcdo:MeasureImplementationDetails) — как в DPA: MeasuresTab ожидает MeasuresData. */
const SmdMeasuresTab: React.FC<SmdMeasuresTabProps> = ({ data, editMode, onChange }) => {
  const measures = data.measures ?? { measures: [] }
  if (editMode && onChange) {
    return (
      <MeasuresTabEdit
        data={measures}
        onChange={(next: MeasuresData) => onChange({ ...data, measures: next })}
      />
    )
  }
  return <MeasuresTab data={measures} />
}

export default SmdMeasuresTab
