import { Form, Input, DatePicker, Select, Button, Table } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import type { CardData, Notification, PhaCauseNotificationItem } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useIncidentAlertKindOptions } from '@/hooks/shared/useIncidentAlertKindOptions'
import { useAuthorityOptions } from '@/hooks/shared/useAuthorityOptions'
import { useDiseaseHealthProblemOptions } from '@/hooks/shared/useDiseaseHealthProblemOptions'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import { getMaxLength } from '@/constants/xsdFieldConstraints'
import { fetchRightsByGuid, getPublicHealthOutEditDepIdsFromRights } from '@/utils/referenceDataApi'
import {
  isPhaCauseNotificationRowComplete,
  isPhaCauseNotificationRowTouched,
} from '@/cards/pha/phaValidation'

/** Версия 1 — виды 1 и 2; иначе — 3, 4, 5, 6 (справочник incidentalertkind). */
const MAIN_KIND_CODES_VERSION_1 = ['1', '2']
const MAIN_KIND_CODES_OTHER = ['3', '4', '5', '6']
/** Коды вида для причинных уведомлений: 1, 2, 3, 4, 7, 8, 10, 11, 13, 14, 16, 17, 19. */
const CAUSE_KIND_CODES = ['1', '2', '3', '4', '7', '8', '10', '11', '13', '14', '16', '17', '19']

interface NotificationTabEditProps {
  data: CardData
  onChange: (data: CardData) => void
  isNewCard?: boolean
  /** Для фильтра УО по publicHealthOut.edit (DEPID из JSON) */
  guid?: string
}

function parseCardVersion(v: CardData['version']): number {
  if (v === null || v === undefined) return 1
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 1
}

const NotificationTabEdit: React.FC<NotificationTabEditProps> = ({
  data,
  onChange,
  isNewCard = false,
  guid,
}) => {
  const isBlank = (v: string | null | undefined) => v == null || String(v).trim() === ''
  const [form] = Form.useForm()
  const n = data.notification
  const { getDisplayLabel: getCountryDisplayLabel, getSelectOptions: getCountrySelectOptions } = useCountryOptions()
  const { getSelectOptions: getIncidentAlertKindSelectOptions } = useIncidentAlertKindOptions()
  const { options: diseaseOptions } = useDiseaseHealthProblemOptions()
  const authorizedBodyCountryCode = (n.authorizedBody?.country ?? '').trim() || undefined

  const [phaEditDepIds, setPhaEditDepIds] = useState<string[] | null>(null)
  const rightsLoading = !!guid?.trim() && phaEditDepIds === null

  useEffect(() => {
    if (!guid?.trim()) {
      setPhaEditDepIds(null)
      return
    }
    let cancelled = false
    fetchRightsByGuid(guid.trim())
      .then((r) => {
        if (!cancelled) setPhaEditDepIds(getPublicHealthOutEditDepIdsFromRights(r))
      })
      .catch(() => {
        if (!cancelled) setPhaEditDepIds([])
      })
    return () => {
      cancelled = true
    }
  }, [guid])

  const filterAuthoritiesByEdit = !!guid?.trim() && phaEditDepIds !== null
  const { options: authorityOptions, loading: authorityLoading, getSelectOptions: getAuthoritySelectOptions, getAuthorityByUid } =
    useAuthorityOptions(
      authorizedBodyCountryCode,
      filterAuthoritiesByEdit,
      filterAuthoritiesByEdit ? phaEditDepIds ?? undefined : undefined
    )

  const [selectedAuthorityUid, setSelectedAuthorityUid] = useState<string | undefined>(undefined)

  const version = parseCardVersion(data.version)
  const isVersion1 = version === 1
  const diseaseName = (data.phaDisease?.diseaseName ?? '').trim()
  const infectFlFromDictionary =
    diseaseName.length > 0
      ? (diseaseOptions.find((o) => (o.name ?? '').trim() === diseaseName || (o.code ?? '').trim() === diseaseName)?.infectFl ?? null)
      : null
  const effectiveInfectFl =
    data.phaFirstDiseaseInfectiousFlag != null ? data.phaFirstDiseaseInfectiousFlag : (infectFlFromDictionary === 0 || infectFlFromDictionary === 1 ? infectFlFromDictionary : null)
  const mainKindCodes = isVersion1
    ? MAIN_KIND_CODES_VERSION_1
    : effectiveInfectFl === 0
      ? ['4', '6']
      : effectiveInfectFl === 1
        ? ['3', '5']
        : MAIN_KIND_CODES_OTHER
  const mainKindOptions = getIncidentAlertKindSelectOptions().filter((o) => mainKindCodes.includes(String(o.value)))
    .sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0))
  const causeKindOptions = getIncidentAlertKindSelectOptions()
    .filter((o) => CAUSE_KIND_CODES.includes(String(o.value)))
    .sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0))

  const handleNotificationChange = (partial: Partial<Notification>) => {
    onChange({
      ...data,
      notification: { ...data.notification, ...partial },
    })
  }

  useEffect(() => {
    form.setFieldsValue({
      country: n.country,
      registrationNumber: n.registrationNumber,
      type: n.type,
      formationDate: n.formationDate?.trim().slice(0, 10) ? dayjs(n.formationDate.slice(0, 10)) : undefined,
      endDate: n.endDate ? dayjs(n.endDate) : undefined,
    })
  }, [n, form])

  useEffect(() => {
    if (!isNewCard) return
    if ((n.country ?? '').trim() !== 'BY') {
      handleNotificationChange({ country: 'BY' })
    }
  }, [isNewCard, n.country])

  useEffect(() => {
    if (!isNewCard) return
    if (n.formationDate?.trim()) return
    handleNotificationChange({ formationDate: dayjs().format('YYYY-MM-DD') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewCard])

  /** Подобрать УО в списке по наименованию (идентификатор в данных не храним). */
  useEffect(() => {
    const name = (n.authorizedBody?.name ?? '').trim()
    if (!name) {
      setSelectedAuthorityUid(undefined)
      return
    }
    const byName = authorityOptions.find((o) => (o.name ?? '').trim() === name)
    if (byName) {
      setSelectedAuthorityUid(byName.uid)
      return
    }
    const legacyId = (n.authorizedBody?.identifier ?? '').trim()
    if (legacyId) {
      const byUid = authorityOptions.find((o) => (o.uid ?? '').trim() === legacyId)
      if (byUid) setSelectedAuthorityUid(byUid.uid)
    }
  }, [n.authorizedBody?.name, n.authorizedBody?.identifier, authorityOptions])

  const handleAuthoritySelect = (uid: string | null) => {
    if (!uid) {
      setSelectedAuthorityUid(undefined)
      handleNotificationChange({
        authorizedBody: {
          country: n.authorizedBody?.country ?? '',
          identifier: '',
          name: '',
          shortName: '',
        },
      })
      return
    }
    const authority = getAuthorityByUid(uid)
    if (authority) {
      setSelectedAuthorityUid(uid)
      handleNotificationChange({
        authorizedBody: {
          country: authority.countryCode ?? n.authorizedBody?.country ?? '',
          identifier: authority.uid,
          name: authority.name,
          shortName: authority.briefName ?? '',
        },
      })
    }
  }

  /**
   * Версия 1: при смене «Вид» меняется набор болезней (инфекц./неинфекц.).
   * Очищаем наименование болезни, если оно не входит в список для нового вида; синхронизируем признак для проверок v2+.
   */
  const handleFormValuesChange = (changed: Record<string, unknown>, all: Record<string, unknown>) => {
    const nextCountry = (all.country as string) ?? n.country
    const nextReg = (all.registrationNumber as string) ?? n.registrationNumber
    const nextType = (all.type as string) ?? n.type
    const nextFormation = all.formationDate
      ? dayjs(all.formationDate as dayjs.Dayjs).format('YYYY-MM-DD')
      : n.formationDate
    /** Очистка DatePicker передаёт endDate: null — без проверки по `changed` значение не сбрасывалось. */
    const endDateExplicitlyChanged = Object.prototype.hasOwnProperty.call(changed, 'endDate')
    const nextEnd = endDateExplicitlyChanged
      ? all.endDate
        ? dayjs(all.endDate as dayjs.Dayjs).format('YYYY-MM-DD')
        : null
      : n.endDate

    if (isVersion1 && changed && 'type' in changed) {
      const kind = String(nextType ?? '').trim()
      const diseaseName = (data.phaDisease?.diseaseName ?? '').trim()
      const allowedForKind = diseaseOptions.filter((o) => {
        if (kind === '1') return o.infectFl === 1
        if (kind === '2') return o.infectFl === 0
        return true
      })
      const diseaseAllowed =
        !diseaseName ||
        allowedForKind.some(
          (o) => (o.name ?? '').trim() === diseaseName || (o.code ?? '').trim() === diseaseName
        )
      const nextPhaDisease = diseaseAllowed
        ? data.phaDisease
        : { ...data.phaDisease, diseaseName: '' as string | undefined }
      let nextInfectFlag: 0 | 1 | undefined = data.phaFirstDiseaseInfectiousFlag
      if (kind === '1') nextInfectFlag = 1
      else if (kind === '2') nextInfectFlag = 0
      onChange({
        ...data,
        notification: {
          ...data.notification,
          country: nextCountry,
          registrationNumber: nextReg,
          type: nextType,
          formationDate: nextFormation,
          endDate: nextEnd,
        },
        phaDisease: nextPhaDisease,
        phaFirstDiseaseInfectiousFlag: nextInfectFlag,
      })
      return
    }

    handleNotificationChange({
      country: nextCountry,
      registrationNumber: nextReg,
      type: nextType,
      formationDate: nextFormation,
      endDate: nextEnd,
    })
  }

  const causeList = data.phaCauseNotifications ?? []
  const getCauseMissing = (row: PhaCauseNotificationItem): string[] => {
    const out: string[] = []
    if (isBlank(row.country)) out.push('country')
    if (isBlank(row.registrationNumber)) out.push('registrationNumber')
    if (isBlank(row.type)) out.push('type')
    if (isBlank(row.formationDate)) out.push('formationDate')
    return out
  }
  const isCauseTouched = (row: PhaCauseNotificationItem) =>
    !isBlank(row.country) || !isBlank(row.registrationNumber) || !isBlank(row.type) || !isBlank(row.formationDate)
  const getCauseFieldError = (
    row: PhaCauseNotificationItem,
    key: 'country' | 'registrationNumber' | 'type' | 'formationDate'
  ): string | undefined => {
    const missing = getCauseMissing(row)
    if (!isCauseTouched(row)) return undefined
    return missing.includes(key) ? 'Обязательное поле (XSD)' : undefined
  }
  const addCause = () => {
    onChange({
      ...data,
      phaCauseNotifications: [...causeList, { country: 'BY', registrationNumber: '', type: '', formationDate: '' }],
    })
  }
  const removeCause = (index: number) => {
    onChange({
      ...data,
      phaCauseNotifications: causeList.filter((_, i) => i !== index),
    })
  }
  const updateCause = (index: number, field: keyof PhaCauseNotificationItem, value: string) => {
    const next = [...causeList]
    next[index] = { ...next[index], [field]: value }
    onChange({ ...data, phaCauseNotifications: next })
  }

  const selectLoading = authorityLoading || rightsLoading

  return (
    <Form form={form} layout="vertical" className="field-tag-form" onValuesChange={handleFormValuesChange}>
      <Form.Item
        label="Страна"
        name="country"
        required
        validateStatus={isBlank(n.country) ? 'error' : undefined}
        help={isBlank(n.country) ? 'Обязательное поле (XSD)' : undefined}
      >
        <Select
          showSearch
          placeholder="Выберите страну"
          options={getCountrySelectOptions()}
          disabled
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      </Form.Item>
      <Form.Item
        label="Регистрационный номер"
        name="registrationNumber"
        required
        validateStatus={isBlank(n.registrationNumber) ? 'error' : undefined}
        help={isBlank(n.registrationNumber) ? 'Обязательное поле (XSD)' : undefined}
      >
        <Input
          placeholder="Регистрационный номер"
          readOnly={!!n.registrationNumber}
          maxLength={getMaxLength('phaIncidentId')}
          showCount={!n.registrationNumber}
          title="csdo:Id40Type (smsdo:IncidentId), не более 40 символов"
        />
      </Form.Item>
      <Form.Item
        label="Вид"
        name="type"
        required
        validateStatus={isBlank(n.type) ? 'error' : undefined}
        help={isBlank(n.type) ? 'Обязательное поле (XSD)' : undefined}
      >
        <Select
          showSearch
          placeholder="Выберите вид уведомления"
          options={mainKindOptions}
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      </Form.Item>
      <Form.Item
        label="Дата формирования"
        name="formationDate"
        required
        validateStatus={isBlank(n.formationDate) ? 'error' : undefined}
        help={isBlank(n.formationDate) ? 'Обязательное поле (XSD)' : undefined}
      >
        <DatePicker format={DATE_DISPLAY_FORMAT} style={{ width: '100%' }} disabled />
      </Form.Item>
      <Form.Item label="Дата закрытия" name="endDate">
        <DatePicker format={DATE_DISPLAY_FORMAT} style={{ width: '100%' }} allowClear />
      </Form.Item>

      <div style={{ marginTop: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 4 }}>
        <h4 style={{ marginTop: 0 }}>Уполномоченный орган</h4>
        <Form.Item
          label="Страна"
          required
          validateStatus={isBlank(authorizedBodyCountryCode) ? 'error' : undefined}
          help={isBlank(authorizedBodyCountryCode) ? 'Обязательное поле (XSD)' : undefined}
        >
          <Input
            readOnly
            status={isBlank(authorizedBodyCountryCode) ? 'error' : undefined}
            value={authorizedBodyCountryCode ? getCountryDisplayLabel(authorizedBodyCountryCode) : '-'}
          />
        </Form.Item>
        <Form.Item label="Уполномоченный орган">
          <Select
            showSearch
            placeholder="Выберите УО"
            value={selectedAuthorityUid}
            onChange={handleAuthoritySelect}
            allowClear
            loading={selectLoading}
            disabled={selectLoading}
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            options={getAuthoritySelectOptions()}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          label="Наименование"
          required
          validateStatus={isBlank(n.authorizedBody?.name) ? 'error' : undefined}
          help={isBlank(n.authorizedBody?.name) ? 'Обязательное поле (XSD)' : undefined}
        >
          <Input readOnly status={isBlank(n.authorizedBody?.name) ? 'error' : undefined} value={n.authorizedBody?.name ?? '-'} />
        </Form.Item>
        <Form.Item label="Краткое наименование">
          <Input readOnly value={n.authorizedBody?.shortName ?? '-'} />
        </Form.Item>
      </div>

      <div style={{ marginTop: 24 }}>
        <h4 style={{ marginTop: 0 }}>Информация по уведомлениям, являющимся причиной</h4>
        <Button type="dashed" icon={<PlusOutlined />} onClick={addCause} style={{ marginBottom: 8 }}>
          Добавить
        </Button>
        {causeList.length > 0 && (
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={causeList}
            pagination={false}
            tableLayout="fixed"
            scroll={{ x: 880 }}
            onRow={(record) => {
              const touched = isPhaCauseNotificationRowTouched(record) || isCauseTouched(record)
              const complete = isPhaCauseNotificationRowComplete(record) && getCauseMissing(record).length === 0
              return {
                style: touched && !complete ? { backgroundColor: '#fff7e6' } : undefined,
              }
            }}
            columns={[
              {
                title: 'Страна',
                dataIndex: 'country',
                key: 'country',
                width: 200,
                render: (val: string, row, index) => {
                  const err = getCauseFieldError(row, 'country')
                  return (
                    <div>
                      <Select
                        size="small"
                        status={err ? 'error' : undefined}
                        value={val || undefined}
                        onChange={(v) => updateCause(index, 'country', v ?? '')}
                        options={getCountrySelectOptions()}
                        style={{ width: '100%' }}
                        showSearch
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                      />
                      {err ? <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>{err}</div> : null}
                    </div>
                  )
                },
              },
              {
                title: 'Рег. номер',
                dataIndex: 'registrationNumber',
                key: 'registrationNumber',
                width: 120,
                render: (val: string, row, index) => {
                  const err = getCauseFieldError(row, 'registrationNumber')
                  return (
                    <div>
                      <Input
                        size="small"
                        status={err ? 'error' : undefined}
                        value={val}
                        onChange={(e) => updateCause(index, 'registrationNumber', e.target.value)}
                        style={{ width: '100%' }}
                        maxLength={getMaxLength('phaIncidentId')}
                        showCount
                        title="csdo:Id40Type (smsdo:IncidentId), не более 40 символов"
                      />
                      {err ? <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>{err}</div> : null}
                    </div>
                  )
                },
              },
              {
                title: 'Вид',
                dataIndex: 'type',
                key: 'type',
                width: 380,
                render: (val: string, row, index) => {
                  const err = getCauseFieldError(row, 'type')
                  return (
                    <div>
                      <Select
                        size="small"
                        status={err ? 'error' : undefined}
                        value={val || undefined}
                        onChange={(v) => updateCause(index, 'type', v ?? '')}
                        options={causeKindOptions}
                        style={{ width: '100%' }}
                        showSearch
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                      />
                      {err ? <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>{err}</div> : null}
                    </div>
                  )
                },
              },
              {
                title: 'Дата формирования',
                dataIndex: 'formationDate',
                key: 'formationDate',
                width: 130,
                render: (val: string, row, index) => {
                  const err = getCauseFieldError(row, 'formationDate')
                  return (
                    <div>
                      <Input
                        size="small"
                        status={err ? 'error' : undefined}
                        type="date"
                        value={val?.slice(0, 10) ?? ''}
                        onChange={(e) => updateCause(index, 'formationDate', e.target.value)}
                        style={{ width: '100%' }}
                      />
                      {err ? <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>{err}</div> : null}
                    </div>
                  )
                },
              },
              {
                title: '',
                key: 'action',
                width: 56,
                render: (_, __, index) => (
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeCause(index)} />
                ),
              },
            ]}
          />
        )}
      </div>
    </Form>
  )
}

export default NotificationTabEdit
