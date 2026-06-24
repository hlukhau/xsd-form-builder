import { DiseaseTab, DiseaseTabEdit } from '@/components/tabs/pha'
import type { CardData } from '@/types/card'

interface SmdDiseaseTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
}

/** Болезнь (smcdo:PublicHealthIncidentDetails). */
const SmdDiseaseTab: React.FC<SmdDiseaseTabProps> = ({ data, editMode, onChange }) => {
  if (editMode && onChange) {
    return <DiseaseTabEdit data={data} onChange={onChange} />
  }
  return <DiseaseTab data={data} />
}

export default SmdDiseaseTab
