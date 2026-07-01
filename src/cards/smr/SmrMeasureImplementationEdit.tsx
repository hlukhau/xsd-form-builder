import type { CardData, MeasureImplementationItem } from '@/types/card'
import { getSmdPrimaryMeasure } from '@/cards/smd/smdSanitaryMeasureModel'
import SmdMeasureImplementationEdit from '@/cards/smd/tabs/SmdMeasureImplementationEdit'

function itemsToCardData(items: MeasureImplementationItem[]): CardData {
  return {
    country: 'BY',
    registrationNumber: '',
    version: 1,
    source: 'Исходящие сведения',
    createdAt: '',
    modifiedAt: '',
    status: '',
    electronicDocument: {
      messageCode: '',
      documentCode: '',
      documentId: '',
      documentDate: '',
      language: 'ru',
      sourceDocumentId: '',
      validityPeriod: { start: '', end: '' },
      updateDateTime: '',
    },
    notification: {
      country: 'BY',
      registrationNumber: '',
      type: '',
      formationDate: '',
      endDate: null,
      authorizedBody: { country: 'BY', identifier: '', name: '', shortName: '' },
    },
    statusHistory: [],
    accessList: [],
    measures: {
      measures: [
        {
          measureImplementationDetails: items,
        },
      ],
    },
  } as CardData
}

export interface SmrMeasureImplementationEditProps {
  items: MeasureImplementationItem[]
  onChange: (next: MeasureImplementationItem[]) => void
}

/** Редактирование мероприятий SMR через компонент SMD. */
export function SmrMeasureImplementationEdit({ items, onChange }: SmrMeasureImplementationEditProps) {
  const data = itemsToCardData(items)
  return (
    <SmdMeasureImplementationEdit
      data={data}
      onChange={(next) => {
        const impls = getSmdPrimaryMeasure(next).measureImplementationDetails ?? []
        onChange(impls)
      }}
    />
  )
}
