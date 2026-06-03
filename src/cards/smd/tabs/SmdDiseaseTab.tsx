import { DiseaseTab } from '@/components/tabs/pha'
import type { CardData } from '@/types/card'

interface SmdDiseaseTabProps {
  data: CardData
}

/** Болезнь (smcdo:PublicHealthIncidentDetails). */
const SmdDiseaseTab: React.FC<SmdDiseaseTabProps> = ({ data }) => <DiseaseTab data={data} />

export default SmdDiseaseTab
