import type { CardData } from '@/types/card'
import { getSmdPrimaryMeasure } from '../smdSanitaryMeasureModel'
import SmdMeasureImplementationView from './SmdMeasureImplementationView'
import SmdMeasureImplementationEdit from './SmdMeasureImplementationEdit'

interface SmdMeasuresTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
}

/** Мероприятия SMD (smcdo:MeasureImplementationDetails) — по макету SS.09, не таблица санитарных мер DPA. */
const SmdMeasuresTab: React.FC<SmdMeasuresTabProps> = ({ data, editMode, onChange }) => {
  const items = getSmdPrimaryMeasure(data).measureImplementationDetails ?? []

  if (editMode && onChange) {
    return <SmdMeasureImplementationEdit data={data} onChange={onChange} />
  }
  return <SmdMeasureImplementationView items={items} />
}

export default SmdMeasuresTab
