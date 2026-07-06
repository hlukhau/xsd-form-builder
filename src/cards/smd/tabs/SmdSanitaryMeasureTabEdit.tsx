import { Collapse, DatePicker, Form, Input, Select } from 'antd'
import dayjs from 'dayjs'
import type { CardData, MeasureInitiationBasisItem } from '@/types/card'
import { MeasureDocDetailsEditStandalone } from '@/components/tabs/dpa/MeasuresTabEdit'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import { getMaxLength } from '@/constants/xsdFieldConstraints'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useEaueCountryOptions } from '@/hooks/shared/useEaueCountryOptions'
import { useMediaTypeOptions } from '@/hooks/shared/useMediaTypeOptions'
import { useSanitaryMeasureOptions } from '@/hooks/shared/useSanitaryMeasureOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/shared/useSanitaryMeasureObjKindOptions'
import { useSanitaryMeasureReasonOptions } from '@/hooks/shared/useSanitaryMeasureReasonOptions'
import { useLanguageOptions } from '@/hooks/shared/useLanguageOptions'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { Button, Table } from 'antd'
import {
  getSmdPrimaryMeasure,
  patchSmdPrimaryMeasure,
  syncSmdCardFromPrimaryMeasure,
} from '../smdSanitaryMeasureModel'
import { getSmdRegulatoryMeasureDoc } from '../smdMeasureDoc'
import SmdIncidentAlertsEdit from './SmdIncidentAlertsEdit'

interface SmdSanitaryMeasureTabEditProps {
  data: CardData
  onChange: (next: CardData) => void
  regulatoryDocReadOnly?: boolean
}

const SmdSanitaryMeasureTabEdit: React.FC<SmdSanitaryMeasureTabEditProps> = ({
  data,
  onChange,
  regulatoryDocReadOnly,
}) => {
  const measure = getSmdPrimaryMeasure(data)
  const regulatoryDoc = getSmdRegulatoryMeasureDoc(data)
  const { getDisplayLabel: getCountryLabel } = useCountryOptions()
  const { countryOptions, loading: loadingCountries, normalizeCountryCode } = useCountryOptions()
  const {
    countryOptions: eaueCountryOptions,
    loading: loadingEaueCountries,
    normalizeCountryCode: normalizeEaueCountryCode,
  } = useEaueCountryOptions()
  const {
    getSelectOptions: getMediaTypeSelectOptions,
    getNameByCode: getMediaTypeNameByCode,
    getCodeByName: getMediaTypeCodeByName,
    loading: loadingMediaTypes,
  } = useMediaTypeOptions()
  const { getSelectOptions: getSanitaryMeasureSelectOptions, loading: loadingSanitaryMeasures } =
    useSanitaryMeasureOptions()
  const { getSelectOptions: getObjKindSelectOptions, loading: loadingObjKinds } =
    useSanitaryMeasureObjKindOptions()
  const { getSelectOptions: getReasonSelectOptions, loading: loadingReasons } =
    useSanitaryMeasureReasonOptions()
  const { getLangCatalogSelectOptions, getLanguageName } = useLanguageOptions()

  const langCode = (measure.languageCode || 'ru').trim().toLowerCase()
  const langLabel =
    getLangCatalogSelectOptions().find((o) => o.value === langCode)?.label ??
    `${langCode} — ${getLanguageName(langCode)}`

  const objectKindCodes = (measure.measureAffectedObjectKindCode ?? '')
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)

  const patchMeasure = (patch: Parameters<typeof patchSmdPrimaryMeasure>[1]) => {
    onChange(syncSmdCardFromPrimaryMeasure(patchSmdPrimaryMeasure(data, patch)))
  }

  const handleDocChange = (doc: NonNullable<typeof measure.measureDocDetails>) => {
    patchMeasure({
      measureDocDetails: {
        ...regulatoryDoc,
        ...doc,
        country: 'BY',
      },
    })
  }

  const handleBasisChange = (
    basisIndex: number,
    field: keyof MeasureInitiationBasisItem,
    value: string
  ) => {
    const list = [...(measure.measureInitiationBasisDetails ?? [])]
    list[basisIndex] = { ...list[basisIndex], [field]: value || undefined }
    patchMeasure({ measureInitiationBasisDetails: list })
  }

  const basisList = measure.measureInitiationBasisDetails ?? []

  return (
    <div>
      <Form layout="vertical" className="field-tag-form" style={{ marginBottom: 16 }}>
        <Form.Item label={labelWithHelp('Язык', FIELD_HELP.languageCode)}>
          <Input readOnly value={langLabel} />
        </Form.Item>

        <Form.Item label={labelWithHelp('Наименование меры', FIELD_HELP.measureName)}>
          <Select
            showSearch
            placeholder="Выберите меру (код — наименование)"
            loading={loadingSanitaryMeasures}
            value={measure.measureCode || undefined}
            onChange={(value) => {
              if (value == null || value === '') {
                patchMeasure({
                  measureCode: undefined,
                  measureCodeListId: undefined,
                })
              } else {
                patchMeasure({
                  measureCode: value,
                  measureCodeListId: '1067',
                  measureName: undefined,
                })
              }
            }}
            allowClear
            options={getSanitaryMeasureSelectOptions()}
            style={{ width: '100%', marginBottom: 8 }}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          {!measure.measureCode?.trim() && (
            <Input
              placeholder="Наименование введённой временной санитарной меры (если код не выбран)"
              value={measure.measureName ?? ''}
              onChange={(e) =>
                patchMeasure({
                  measureName: e.target.value || undefined,
                  measureCode: undefined,
                  measureCodeListId: undefined,
                })
              }
              maxLength={300}
              showCount
            />
          )}
        </Form.Item>

        <Form.Item label={labelWithHelp('Начальная дата', FIELD_HELP.measureStartDate)} required>
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
            style={{ width: '100%' }}
            value={measure.startDate?.trim() ? dayjs(measure.startDate.slice(0, 10)) : null}
            onChange={(d) =>
              patchMeasure({ startDate: d ? d.format('YYYY-MM-DD') : undefined })
            }
          />
        </Form.Item>

        <Form.Item label="Конечная дата">
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
            style={{ width: '100%' }}
            value={measure.endDate?.trim() ? dayjs(measure.endDate.slice(0, 10)) : null}
            onChange={(d) => patchMeasure({ endDate: d ? d.format('YYYY-MM-DD') : undefined })}
          />
        </Form.Item>

        <Form.Item label={labelWithHelp('Обоснование', FIELD_HELP.measureJustification)}>
          <Input.TextArea
            rows={3}
            value={measure.measureJustificationText}
            onChange={(e) => patchMeasure({ measureJustificationText: e.target.value || undefined })}
            maxLength={getMaxLength('measureJustification')}
            showCount
          />
        </Form.Item>

        <Form.Item label="Описание">
          <Input.TextArea
            rows={3}
            value={measure.description}
            onChange={(e) => patchMeasure({ description: e.target.value || undefined })}
            maxLength={getMaxLength('description')}
            showCount
          />
        </Form.Item>

        <Form.Item label={labelWithHelp('Вид объекта действия меры', FIELD_HELP.measureAffectedObjectKind)}>
          <Select
            mode="multiple"
            loading={loadingObjKinds}
            placeholder="Выберите один или несколько видов"
            value={objectKindCodes}
            onChange={(codes: string[]) =>
              patchMeasure({
                measureAffectedObjectKindCode:
                  codes.length > 0 ? codes.join(';') : undefined,
              })
            }
            options={getObjKindSelectOptions()}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="Код причины (основания) введения временной меры">
          <Select
            showSearch
            allowClear
            placeholder="Выберите причину (код — наименование)"
            loading={loadingReasons}
            value={measure.measureReasonCode || undefined}
            onChange={(value) =>
              patchMeasure({ measureReasonCode: value ? String(value) : undefined })
            }
            options={getReasonSelectOptions()}
            style={{ width: '100%' }}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item label="Условие снятия меры">
          <Input.TextArea
            rows={2}
            value={measure.measureRepealConditionText}
            onChange={(e) =>
              patchMeasure({ measureRepealConditionText: e.target.value || undefined })
            }
            maxLength={4000}
            showCount
          />
        </Form.Item>
      </Form>

      <Collapse
        defaultActiveKey={['measureDoc']}
        items={[
          {
            key: 'measureDoc',
            label: labelWithHelp(
              'Документ, регламентирующий введение (отмену) меры',
              FIELD_HELP.measureDocDetails
            ),
            children: (
              <MeasureDocDetailsEditStandalone
                doc={{ ...regulatoryDoc, country: 'BY' }}
                onChange={handleDocChange}
                title="документ"
                defaultLanguageCode="ru"
                loadingCountries={loadingCountries}
                countryOptions={countryOptions}
                normalizeCountryCode={normalizeCountryCode}
                loadingMediaTypes={loadingMediaTypes}
                getMediaTypeSelectOptions={getMediaTypeSelectOptions}
                getMediaTypeNameByCode={getMediaTypeNameByCode}
                getMediaTypeCodeByName={getMediaTypeCodeByName}
                readOnlyDocIdentity={regulatoryDocReadOnly}
                countryReadOnly
                fixedCountryCode="BY"
              />
            ),
          },
          {
            key: 'initialMeasureDoc',
            label: labelWithHelp(
              'Документ, регламентирующий введение исходной меры',
              FIELD_HELP.initialMeasureDocDetails
            ),
            children: (
              <MeasureDocDetailsEditStandalone
                doc={measure.initialMeasureDocDetails}
                onChange={(doc) => patchMeasure({ initialMeasureDocDetails: doc })}
                title="исходный документ"
                defaultLanguageCode={undefined}
                loadingCountries={loadingEaueCountries}
                countryOptions={eaueCountryOptions}
                normalizeCountryCode={normalizeEaueCountryCode}
                loadingMediaTypes={loadingMediaTypes}
                getMediaTypeSelectOptions={getMediaTypeSelectOptions}
                getMediaTypeNameByCode={getMediaTypeNameByCode}
                getMediaTypeCodeByName={getMediaTypeCodeByName}
              />
            ),
          },
          {
            key: 'basis',
            label: labelWithHelp('Основание для введения меры', FIELD_HELP.measureInitiationBasis),
            children: (
              <div>
                <Table
                  dataSource={basisList}
                  size="small"
                  pagination={false}
                  rowKey={(_, i) => `basis-${i}`}
                  columns={[
                    {
                      title: 'Вид',
                      key: 'docKindName',
                      render: (_: unknown, record: MeasureInitiationBasisItem, i: number) => (
                        <Input
                          value={record.docKindName}
                          onChange={(e) => handleBasisChange(i, 'docKindName', e.target.value)}
                          maxLength={getMaxLength('measureInitiationBasisDocKind')}
                          showCount
                        />
                      ),
                    },
                    {
                      title: 'Наименование',
                      key: 'docName',
                      render: (_: unknown, record: MeasureInitiationBasisItem, i: number) => (
                        <Input
                          value={record.docName}
                          onChange={(e) => handleBasisChange(i, 'docName', e.target.value)}
                          maxLength={getMaxLength('measureInitiationBasisDocName')}
                          showCount
                        />
                      ),
                    },
                    {
                      title: 'Номер',
                      key: 'docId',
                      render: (_: unknown, record: MeasureInitiationBasisItem, i: number) => (
                        <Input
                          value={record.docId}
                          onChange={(e) => handleBasisChange(i, 'docId', e.target.value)}
                          maxLength={getMaxLength('docId')}
                          showCount
                        />
                      ),
                    },
                    {
                      title: 'Дата',
                      key: 'docCreationDate',
                      render: (_: unknown, record: MeasureInitiationBasisItem, i: number) => (
                        <DatePicker
                          format={DATE_DISPLAY_FORMAT}
                          value={record.docCreationDate ? dayjs(record.docCreationDate) : null}
                          onChange={(d) =>
                            handleBasisChange(
                              i,
                              'docCreationDate',
                              d ? d.format('YYYY-MM-DD') : ''
                            )
                          }
                          style={{ width: '100%' }}
                        />
                      ),
                    },
                    {
                      title: '',
                      key: 'actions',
                      width: 90,
                      render: (_: unknown, __: MeasureInitiationBasisItem, i: number) => (
                        <Button
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() =>
                            patchMeasure({
                              measureInitiationBasisDetails: basisList.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          Удалить
                        </Button>
                      ),
                    },
                  ]}
                />
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    patchMeasure({
                      measureInitiationBasisDetails: [...basisList, {}],
                    })
                  }
                  style={{ width: '100%', marginTop: 8 }}
                >
                  Добавить НПА-основание
                </Button>
              </div>
            ),
          },
          {
            key: 'incident',
            label: 'Уведомление о нежелательной ситуации',
            children: <SmdIncidentAlertsEdit data={data} onChange={onChange} />,
          },
        ]}
      />
    </div>
  )
}

export default SmdSanitaryMeasureTabEdit
