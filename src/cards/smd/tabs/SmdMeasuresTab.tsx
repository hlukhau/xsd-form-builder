import MeasuresTab from '@/components/tabs/dpa/MeasuresTab'
import MeasuresTabEdit from '@/components/tabs/dpa/MeasuresTabEdit'
import type { CardData, MeasuresData, SanitaryMeasure } from '@/types/card'
import { getSmdRegulatoryMeasureDoc } from '../smdMeasureDoc'

interface SmdMeasuresTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
}

function preserveSmdRegulatoryDocOnMeasures(data: CardData, next: MeasuresData): MeasuresData {
  const regulatory = getSmdRegulatoryMeasureDoc(data)
  const rows = [...(next.measures ?? [])]
  if (rows.length === 0) {
    rows.push({ languageCode: 'ru', measureDocDetails: { ...regulatory } })
    return { measures: rows }
  }
  const first: SanitaryMeasure = { ...rows[0] }
  first.measureDocDetails = {
    ...regulatory,
    ...first.measureDocDetails,
    docId: first.measureDocDetails?.docId?.trim() || regulatory.docId,
    docCreationDate:
      first.measureDocDetails?.docCreationDate?.trim() || regulatory.docCreationDate,
    country: first.measureDocDetails?.country?.trim() || regulatory.country,
  }
  rows[0] = first
  return { measures: rows }
}

/** Мероприятия (smcdo:MeasureImplementationDetails) — как в DPA: MeasuresTab ожидает MeasuresData. */
const SmdMeasuresTab: React.FC<SmdMeasuresTabProps> = ({ data, editMode, onChange }) => {
  const measures = data.measures ?? { measures: [] }
  if (editMode && onChange) {
    return (
      <MeasuresTabEdit
        data={measures}
        onChange={(next: MeasuresData) =>
          onChange({ ...data, measures: preserveSmdRegulatoryDocOnMeasures(data, next) })
        }
      />
    )
  }
  return <MeasuresTab data={measures} />
}

export default SmdMeasuresTab
