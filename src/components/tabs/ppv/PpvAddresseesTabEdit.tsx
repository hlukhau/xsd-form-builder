import { useEffect, useState, useMemo, useCallback } from 'react'
import { Table, Spin, Alert, Space, Typography, Select, Button, Modal, Tooltip, message } from 'antd'
import { FileTextOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  fetchPpvActorCountryOptions,
  fetchPpvActors,
  type PpvActorCountryOption,
  type PpvActorRow,
} from '@/utils/referenceDataApi'

export interface PpvAddresseesTabEditProps {
  /** Коды стран, которые будут дописаны в PPVACTOR при сохранении карты */
  pendingCountryCodes: string[]
  ppvid: string
  hasPersisted: boolean
  formationDate?: string | null
  guid?: string
  onChange: (codes: string[]) => void
}

function normCode(c: string): string {
  return String(c ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
}

type AddresseeEditRow = PpvActorRow & { rowKey: string; isPending?: boolean }

function mergeRows(
  server: PpvActorRow[],
  pendingCodes: string[],
  nameByCode: Map<string, string>
): AddresseeEditRow[] {
  const serverCodes = new Set(
    server.map((r) => (r.actorCountryCode ?? '').trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c))
  )
  const out: AddresseeEditRow[] = server.map((r) => ({
    ...r,
    rowKey: `s-${r.ppvActorId}`,
    isPending: false,
  }))
  for (const raw of pendingCodes) {
    const c = normCode(raw)
    if (!/^[A-Z]{2}$/.test(c) || serverCodes.has(c)) continue
    out.push({
      rowKey: `p-${c}`,
      isPending: true,
      ppvActorId: -1,
      actorCountryCode: c,
      actorCode: 'P.SS.08.ACT.005',
      ppvActorActFl: 1,
      countryName: nameByCode.get(c) ?? null,
      responseDateTime: null,
      edocId: null,
    })
  }
  return out
}

const PpvAddresseesTabEdit: React.FC<PpvAddresseesTabEditProps> = ({
  pendingCountryCodes,
  ppvid,
  hasPersisted,
  formationDate,
  guid,
  onChange,
}) => {
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [loadingActors, setLoadingActors] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<PpvActorCountryOption[]>([])
  const [serverRows, setServerRows] = useState<PpvActorRow[]>([])
  const [reviewStubOpen, setReviewStubOpen] = useState(false)
  const [reviewStubEdocId, setReviewStubEdocId] = useState<string | null>(null)
  const [pickCode, setPickCode] = useState<string | undefined>(undefined)

  const docDate = useMemo(() => {
    const raw = formationDate?.trim().slice(0, 10)
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    return undefined
  }, [formationDate])

  const nameByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of options) {
      const c = o.code.trim().toUpperCase().slice(0, 2)
      if (c.length === 2) m.set(c, o.name.trim())
    }
    return m
  }, [options])

  useEffect(() => {
    let cancelled = false
    setLoadingOptions(true)
    setError(null)
    fetchPpvActorCountryOptions(docDate, guid)
      .then((list) => {
        if (!cancelled) setOptions(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setOptions([])
          setError(e instanceof Error ? e.message : 'Не удалось загрузить список стран')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false)
      })
    return () => {
      cancelled = true
    }
  }, [docDate, guid])

  useEffect(() => {
    if (!hasPersisted || !ppvid || ppvid === '-') {
      setServerRows([])
      return
    }
    let cancelled = false
    setLoadingActors(true)
    fetchPpvActors(ppvid, guid)
      .then((list) => {
        if (!cancelled) setServerRows(list)
      })
      .catch(() => {
        if (!cancelled) setServerRows([])
      })
      .finally(() => {
        if (!cancelled) setLoadingActors(false)
      })
    return () => {
      cancelled = true
    }
  }, [ppvid, guid, hasPersisted])

  const tableRows = useMemo(
    () => mergeRows(serverRows, pendingCountryCodes, nameByCode),
    [serverRows, pendingCountryCodes, nameByCode]
  )

  const selectOptions = useMemo(
    () =>
      options.map((o) => ({
        value: o.code.trim().toUpperCase().slice(0, 2),
        label: `${o.code.trim().toUpperCase().slice(0, 2)} — ${o.name.trim()}`,
      })),
    [options]
  )

  const openReviewStub = useCallback((edocId: string) => {
    setReviewStubEdocId(edocId)
    setReviewStubOpen(true)
  }, [])

  const handleAdd = useCallback(() => {
    const c = pickCode?.trim().toUpperCase()
    if (!c || !/^[A-Z]{2}$/.test(c)) {
      message.warning('Выберите страну из списка')
      return
    }
    const existingCodes = new Set(
      serverRows.map((r) => (r.actorCountryCode ?? '').trim().toUpperCase()).filter((x) => /^[A-Z]{2}$/.test(x))
    )
    const pending = pendingCountryCodes.map(normCode).filter((x) => /^[A-Z]{2}$/.test(x))
    const pendingSet = new Set(pending)
    if (existingCodes.has(c)) {
      message.warning('Такой адресат уже есть в карте')
      return
    }
    if (pendingSet.has(c)) {
      message.warning('Страна уже добавлена в список на сохранение')
      return
    }
    onChange([...pending, c])
    setPickCode(undefined)
  }, [pickCode, serverRows, pendingCountryCodes, onChange])

  const handleRemovePending = useCallback(
    (code: string) => {
      const c = normCode(code)
      onChange(pendingCountryCodes.map(normCode).filter((x) => x !== c))
    },
    [pendingCountryCodes, onChange]
  )

  const columns: ColumnsType<AddresseeEditRow> = useMemo(
    () => [
      {
        title: 'Страна',
        key: 'countryName',
        render: (_: unknown, r: AddresseeEditRow) => {
          const n = r.countryName?.trim()
          if (n) return n
          const code = (r.actorCountryCode ?? '').trim().toUpperCase()
          return code || '—'
        },
      },
      {
        title: 'Код страны',
        dataIndex: 'actorCountryCode',
        key: 'actorCountryCode',
        width: 110,
        render: (v: string | null) => (v && String(v).trim() ? String(v).trim().toUpperCase() : '—'),
      },
      {
        title: 'Дата получения ответа',
        dataIndex: 'responseDateTime',
        key: 'responseDateTime',
        render: (v: string | null) => (v && String(v).trim() ? v : ''),
      },
      {
        title: 'Ответ',
        key: 'answer',
        width: 160,
        align: 'center',
        render: (_: unknown, r: AddresseeEditRow) => {
          const id = r.edocId?.trim()
          const viewBtn =
            id != null && id !== '' ? (
              <Tooltip title="Карта сведений о результатах рассмотрения (заглушка)">
                <Button
                  type="link"
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={() => openReviewStub(id)}
                  aria-label="Просмотр ответа"
                />
              </Tooltip>
            ) : null
          const delBtn =
            r.isPending === true ? (
              <Tooltip title="Убрать из списка на сохранение">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemovePending(r.actorCountryCode ?? '')}
                  aria-label="Удалить из очереди"
                />
              </Tooltip>
            ) : null
          return (
            <Space size="small">
              {viewBtn}
              {delBtn}
            </Space>
          )
        },
      },
    ],
    [openReviewStub, handleRemovePending]
  )

  const blockOnOptions = loadingOptions && options.length === 0 && !error

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          Добавление — только выбор страны; код участника, признак актуальности и привязка к карте задаются при
          сохранении. Строки из базы можно просматривать; из очереди на сохранение можно удалить только ещё не
          записанные адресаты.
        </Typography.Text>
        {error ? <Alert type="warning" message={error} showIcon /> : null}
        <Space wrap align="start">
          <Select
            showSearch
            allowClear
            placeholder="Страна"
            style={{ minWidth: 280 }}
            options={selectOptions}
            value={pickCode}
            onChange={(v) => setPickCode(v)}
            loading={loadingOptions}
            disabled={blockOnOptions}
            optionFilterProp="label"
            filterOption={(input, opt) =>
              String(opt?.label ?? '')
                .toLowerCase()
                .includes(input.trim().toLowerCase()) ||
              String(opt?.value ?? '')
                .toLowerCase()
                .includes(input.trim().toLowerCase())
            }
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Добавить адресата
          </Button>
        </Space>
        {blockOnOptions ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : (
          <Table<AddresseeEditRow>
            rowKey={(r) => r.rowKey}
            columns={columns}
            dataSource={tableRows}
            pagination={false}
            size="small"
            bordered
            loading={hasPersisted && loadingActors && serverRows.length === 0}
            locale={{ emptyText: 'Нет адресатов. Добавьте страну или сохраните карту, чтобы загрузить данные из БД.' }}
          />
        )}
      </Space>
      <Modal
        title="Карта сведений о результатах рассмотрения"
        open={reviewStubOpen}
        onCancel={() => setReviewStubOpen(false)}
        footer={null}
        destroyOnClose
      >
        <p style={{ color: '#595959', marginBottom: 8 }}>
          Просмотр карты сведений о результате рассмотрения будет подключён позже.
        </p>
        {reviewStubEdocId ? (
          <p style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
            Идентификатор ответа (EDOCID): {reviewStubEdocId}
          </p>
        ) : null}
      </Modal>
    </div>
  )
}

export default PpvAddresseesTabEdit
