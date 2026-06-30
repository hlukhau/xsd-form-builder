import SmdDiseaseTabEdit from './SmdDiseaseTabEdit'
import SmdDiseaseTabView from './SmdDiseaseTabView'

interface SmdDiseaseTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
}

/** Болезнь (smcdo:PublicHealthIncidentDetails) — SS.09. */
const SmdDiseaseTab: React.FC<SmdDiseaseTabProps> = ({ data, editMode, onChange }) => {
  if (editMode && onChange) {
    return <SmdDiseaseTabEdit data={data} onChange={onChange} />
  }
  return <SmdDiseaseTabView data={data} />
}

export default SmdDiseaseTab
