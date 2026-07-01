import { Button, Space, Collapse } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { MeasureDocDetailsEditStandalone } from '@/components/tabs/dpa/MeasuresTabEdit'
import { useEaueCountryOptions } from '@/hooks/shared/useEaueCountryOptions'
import { useMediaTypeOptions } from '@/hooks/shared/useMediaTypeOptions'
import type { MeasureDocDetails } from '@/types/card'
import type { DprResultDocRow } from '@/types/dprCard'
import {
  dprResultDocRowToMeasureDocDetails,
  measureDocDetailsToDprResultDocRow,
  emptyDprResultDocRow,
} from '@/utils/dprResultDocMapping'

export interface DprResultDocumentsEditProps {
  documents: DprResultDocRow[]
  onChange: (next: DprResultDocRow[]) => void
}

/**
 * Редактирование приложенных документов DPR (ccdo:DocContentDetails) — те же поля, что у
 * «Документ, регламентирующий введение (отмену) меры» в карте DPA.
 */
export function DprResultDocumentsEdit({ documents, onChange }: DprResultDocumentsEditProps) {
  const { countryOptions, loading: loadingCountries, normalizeCountryCode } = useEaueCountryOptions()
  const {
    getSelectOptions: getMediaTypeSelectOptions,
    getNameByCode: getMediaTypeNameByCode,
    getCodeByName: getMediaTypeCodeByName,
    loading: loadingMediaTypes,
  } = useMediaTypeOptions()

  const updateAt = (index: number, doc: MeasureDocDetails) => {
    const next = [...documents]
    next[index] = measureDocDetailsToDprResultDocRow(doc)
    onChange(next)
  }

  const removeAt = (index: number) => {
    onChange(documents.filter((_, i) => i !== index))
  }

  const add = () => {
    onChange([...documents, emptyDprResultDocRow()])
  }

  const collapseItems = documents.map((row, i) => ({
    key: String(i),
    label: `Документ ${i + 1}`,
    extra: (
      <Button
        type="link"
        danger
        size="small"
        icon={<DeleteOutlined />}
        onClick={(e) => {
          e.stopPropagation()
          removeAt(i)
        }}
      >
        Удалить
      </Button>
    ),
    children: (
      <MeasureDocDetailsEditStandalone
        doc={dprResultDocRowToMeasureDocDetails(row)}
        onChange={(md) => updateAt(i, md)}
        title="документ"
        defaultLanguageCode="ru"
        loadingCountries={loadingCountries}
        countryOptions={countryOptions}
        normalizeCountryCode={normalizeCountryCode}
        loadingMediaTypes={loadingMediaTypes}
        getMediaTypeSelectOptions={getMediaTypeSelectOptions}
        getMediaTypeNameByCode={getMediaTypeNameByCode}
        getMediaTypeCodeByName={getMediaTypeCodeByName}
        hideInternalRemove
      />
    ),
  }))

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {documents.length > 0 ? <Collapse items={collapseItems} /> : null}
      <Button type="dashed" icon={<PlusOutlined />} onClick={add} block>
        Добавить документ
      </Button>
    </Space>
  )
}
