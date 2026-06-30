import { DiseaseTabEdit } from '@/components/tabs/pha'
import type { CardData } from '@/types/card'
import SmdDiseaseTabView from './SmdDiseaseTabView'

interface SmdDiseaseTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
}

/** Болезнь (smcdo:PublicHealthIncidentDetails) — SS.09. */
const SmdDiseaseTab: React.FC<SmdDiseaseTabProps> = ({ data, editMode, onChange }) => {
  if (editMode && onChange) {
    return <DiseaseTabEdit data={data} onChange={onChange} />
  }
  return <SmdDiseaseTabView data={data} />
}

export default SmdDiseaseTab
