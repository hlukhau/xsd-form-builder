import { Button, Space, Collapse } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { MeasureDocDetailsEditStandalone } from '@/components/tabs/dpa/MeasuresTabEdit'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useMediaTypeOptions } from '@/hooks/shared/useMediaTypeOptions'
import type { MeasureDocDetails } from '@/types/card'
import type { SmrResultDocRow } from '@/types/smrCard'
import {
  smrResultDocRowToMeasureDocDetails,
  measureDocDetailsToSmrResultDocRow,
  emptySmrResultDocRow,
} from '@/utils/smrResultDocMapping'

export interface SmrResultDocumentsEditProps {
  documents: SmrResultDocRow[]
  onChange: (next: SmrResultDocRow[]) => void
}

/** Редактирование приложенных документов SMR (ccdo:DocContentDetails). */
export function SmrResultDocumentsEdit({ documents, onChange }: SmrResultDocumentsEditProps) {
  const { countryOptions, loading: loadingCountries, normalizeCountryCode } = useCountryOptions()
  const {
    getSelectOptions: getMediaTypeSelectOptions,
    getNameByCode: getMediaTypeNameByCode,
    getCodeByName: getMediaTypeCodeByName,
    loading: loadingMediaTypes,
  } = useMediaTypeOptions()

  const updateAt = (index: number, doc: MeasureDocDetails) => {
    const next = [...documents]
    next[index] = measureDocDetailsToSmrResultDocRow(doc)
    onChange(next)
  }

  const removeAt = (index: number) => {
    onChange(documents.filter((_, i) => i !== index))
  }

  const add = () => {
    onChange([...documents, emptySmrResultDocRow()])
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
        doc={smrResultDocRowToMeasureDocDetails(row)}
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
