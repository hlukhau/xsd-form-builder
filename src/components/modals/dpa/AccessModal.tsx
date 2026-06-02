import { useState, useEffect } from 'react'
import { Modal, List, Button, Input, Space, Popconfirm, Select, message, Spin, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { AccessItem } from '@/types/card'
import {
  fetchDpaAccess,
  fetchPpvDepPermisAccess,
  fetchRightsByGuid,
  addDpaAccess,
  addPpvDepPermisAccess,
  removeDpaAccess,
  removePpvDepPermisAccess,
  fetchDepOptions,
  checkAccessRight,
  cardApiSourceToAccessRight,
  resolveCardAccessApiSource,
  type DepOption,
} from '@/utils/referenceDataApi'
import { isPpvApp } from '@/cards/config'

/** Ручное добавление/удаление в перечне доступа: только районный и областной ЦГЭ (dep0603 — системой). */
const MANUAL_ACCESS_DEP_KINDS = ['dep0601', 'dep0602']

function normalizeDepKind(code: string | undefined): string {
  return (code ?? '').trim().toLowerCase()
}

/** Исключить из доступа вручную можно только dep0601 / dep0602. */
function isRemovableAccessDep(depKindCode: string | undefined): boolean {
  const k = normalizeDepKind(depKindCode)
  return k === 'dep0601' || k === 'dep0602'
}

/** Подпись уровня по коду вида подразделения (TB_DEPKIND.DEPKINDCODE) */
function getDepLevelLabel(depKindCode: string | undefined): string | null {
  if (!depKindCode) return null
  if (depKindCode === 'dep0601') return 'Районный'
  if (depKindCode === 'dep0602') return 'Областной'
  if (depKindCode === 'dep0603') return 'Республиканский'
  return null
}

/** Цвет тега/рамки по коду вида подразделения */
function getDepLevelColor(depKindCode: string | undefined): string {
  if (depKindCode === 'dep0601') return 'blue'
  if (depKindCode === 'dep0602') return 'green'
  if (depKindCode === 'dep0603') return 'purple'
  return 'default'
}

export interface AccessModalProps {
  visible: boolean
  data: AccessItem[]
  onClose: () => void
  onUpdate: (accessList: AccessItem[]) => void
  /** При открытии карточки по DPAID — загрузка/сохранение в БД (TB_DEP, DPADEPPERMIS) */
  dpaid?: string
  /** Карта PPV: идентификатор для PPVDEPPERMIS через `/api/ppv/access` (в запросе поле `dpaid`). */
  ppvid?: string
  /** Источник сведений карты (Входящие / Исходящие / Данные ЕЭК) — для прав и списка по умолчанию */
  source?: string
  /** Код вида источника из метаданных (1/2/3), если подпись source пустая или не распознаётся */
  datasourceKindCode?: string | null
  countryCode?: string
  /** GUID из URL — для получения department.depid из JSON прав (ЦГЭ создателя в списке по умолчанию для исходящих) */
  guid?: string
}

const AccessModal: React.FC<AccessModalProps> = ({
  visible,
  data,
  onClose,
  onUpdate,
  dpaid,
  ppvid,
  source,
  datasourceKindCode,
  guid,
}) => {
  const [accessList, setAccessList] = useState<AccessItem[]>(data)
  const [searchText, setSearchText] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [depOptions, setDepOptions] = useState<DepOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [selectedDepId, setSelectedDepId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [canManageAccess, setCanManageAccess] = useState(true)

  const trimmedPpvid = (ppvid ?? '').trim()
  const trimmedDpaid = (dpaid ?? '').trim()
  const usePpvApi = trimmedPpvid.length > 0
  const listKey = usePpvApi ? trimmedPpvid : trimmedDpaid
  const fromApi = listKey.length > 0

  useEffect(() => {
    if (!visible) return
    setAccessList(data)
    if (fromApi) {
      setLoadingList(true)
      const apiSource = resolveCardAccessApiSource(source, datasourceKindCode)
      const isOutgoing = apiSource === 'outgoing'
      const loadList = (creatorDepId?: string | number) =>
        (usePpvApi
          ? fetchPpvDepPermisAccess(listKey, source, creatorDepId, guid, datasourceKindCode)
          : fetchDpaAccess(listKey, source, creatorDepId, guid, datasourceKindCode)
        ).then((list) => setAccessList(list))
      const promise =
        isOutgoing && guid
          ? fetchRightsByGuid(guid)
              .then((rights) => rights.department?.depid)
              .then((depid) => loadList(depid != null ? depid : undefined))
              .catch(() => loadList())
          : loadList()
      promise
        .catch((e) => {
          message.error('Ошибка загрузки списка доступа: ' + (e instanceof Error ? e.message : ''))
        })
        .finally(() => setLoadingList(false))
    }
  }, [visible, listKey, usePpvApi, source, datasourceKindCode, data, fromApi, guid])

  useEffect(() => {
    if (!visible || !fromApi || !listKey) return
    if (!guid || !guid.trim()) {
      setCanManageAccess(false)
      return
    }
    const right = cardApiSourceToAccessRight(
      resolveCardAccessApiSource(source, datasourceKindCode),
      isPpvApp()
    )
    if (!right) {
      setCanManageAccess(true)
      return
    }
    checkAccessRight(guid, right).then(setCanManageAccess)
  }, [visible, fromApi, listKey, source, datasourceKindCode, guid])

  useEffect(() => {
    if (visible && fromApi) {
      setLoadingOptions(true)
      fetchDepOptions()
        .then(setDepOptions)
        .finally(() => setLoadingOptions(false))
    }
  }, [visible, fromApi])

  const filteredList = accessList.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  )

  const handleAddLocal = () => {
    if (newItemName.trim()) {
      setAccessList([
        ...accessList,
        { id: Date.now().toString(), name: newItemName.trim() },
      ])
      setNewItemName('')
    }
  }

  const handleAddFromApi = async () => {
    if (!selectedDepId || !listKey) return
    const opt = depOptions.find((o) => o.id === selectedDepId)
    if (opt && !MANUAL_ACCESS_DEP_KINDS.includes(normalizeDepKind(opt.depKindCode))) {
      message.error(
        'Добавление разрешено только для подразделений районного или областного уровня (dep0601 / dep0602). '
          + 'Республиканский уровень (РЦГЭ) подключается системой.'
      )
      return
    }
    if (accessList.some((a) => a.id === selectedDepId)) {
      message.warning('Это подразделение уже в списке')
      return
    }
    setAdding(true)
    try {
      if (usePpvApi) await addPpvDepPermisAccess(listKey, selectedDepId, guid)
      else await addDpaAccess(listKey, selectedDepId, guid)
      setAccessList([
        ...accessList,
        { id: selectedDepId, name: opt ? opt.name : selectedDepId, depKindCode: opt?.depKindCode },
      ])
      setSelectedDepId(null)
    } catch (e) {
      message.error('Ошибка добавления: ' + (e instanceof Error ? e.message : ''))
    } finally {
      setAdding(false)
    }
  }

  const handleAdd = fromApi ? handleAddFromApi : handleAddLocal

  const handleDelete = async (id: string) => {
    if (fromApi && listKey) {
      try {
        if (usePpvApi) await removePpvDepPermisAccess(listKey, id, guid)
        else await removeDpaAccess(listKey, id, guid)
        setAccessList(accessList.filter((item) => item.id !== id))
      } catch (e) {
        message.error('Ошибка удаления: ' + (e instanceof Error ? e.message : ''))
      }
      return
    } else {
      const item = accessList.find((i) => i.id === id)
      if (item && !item.name.includes('РЦГЭ') && !item.name.includes('ОЗ')) {
        setAccessList(accessList.filter((item) => item.id !== id))
      }
    }
  }

  const handleSave = () => {
    onUpdate(accessList)
    onClose()
  }

  const handleClose = () => {
    if (fromApi) onUpdate(accessList)
    onClose()
  }

  const addableDeps = fromApi
    ? depOptions.filter(
        (o) =>
          MANUAL_ACCESS_DEP_KINDS.includes(normalizeDepKind(o.depKindCode)) &&
          !accessList.some((a) => a.id === o.id)
      )
    : depOptions

  const addContent = fromApi ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, width: '100%' }}>
      <Select
        placeholder="Выберите подразделение (районный или областной ЦГЭ — dep0601 / dep0602)"
        value={selectedDepId}
        onChange={setSelectedDepId}
        options={addableDeps.map((o) => ({
          value: o.id,
          label: o.name,
          depKindCode: o.depKindCode,
        }))}
        optionRender={(option) => {
          const label = getDepLevelLabel(option.data?.depKindCode)
          const color = getDepLevelColor(option.data?.depKindCode)
          return (
            <Space size="small" wrap>
              {label && (
                <Tag color={color} style={{ margin: 0 }}>
                  {label}
                </Tag>
              )}
              <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{option.label}</span>
            </Space>
          )
        }}
        style={{ flex: '1 1 200px', minWidth: 0, maxWidth: '100%' }}
        loading={loadingOptions}
        allowClear
        disabled={!canManageAccess}
        popupClassName="access-modal-dep-select-dropdown"
      />
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        loading={adding}
        disabled={!selectedDepId || !canManageAccess}
        style={{ flexShrink: 0 }}
      >
        Добавить
      </Button>
    </div>
  ) : (
    <Space>
      <Input
        placeholder="Наименование ЦГЭ"
        value={newItemName}
        onChange={(e) => setNewItemName(e.target.value)}
        onPressEnter={handleAddLocal}
        style={{ width: 300 }}
      />
      <Button icon={<PlusOutlined />} onClick={handleAdd}>
        Добавить
      </Button>
    </Space>
  )

  return (
    <Modal
      title="Определить доступ"
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          Закрыть
        </Button>,
        !fromApi && (
          <Button key="save" type="primary" onClick={handleSave}>
            Сохранить
          </Button>
        ),
      ].filter(Boolean)}
      width={1100}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Input.Search
          placeholder="Поиск по наименованию"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        {addContent}

        <div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            Подразделения:
          </div>
          {loadingList ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin tip="Загрузка списка..." />
            </div>
          ) : (
            <List
              dataSource={filteredList}
              renderItem={(item) => {
                const showDelete =
                  fromApi && canManageAccess && isRemovableAccessDep(item.depKindCode)
                const levelLabel = getDepLevelLabel(item.depKindCode)
                const depColor = getDepLevelColor(item.depKindCode)
                const borderColor =
                  depColor === 'green'
                    ? 'var(--ant-color-success)'
                    : depColor === 'purple'
                      ? 'var(--ant-color-purple, #722ed1)'
                      : depColor === 'blue'
                        ? 'var(--ant-color-primary)'
                        : undefined
                return (
                  <List.Item
                    style={{
                      borderLeft: levelLabel ? `3px solid ${borderColor}` : undefined,
                      paddingLeft: levelLabel ? 12 : undefined,
                    }}
                    actions={
                      fromApi
                        ? [
                            showDelete && (
                              <Popconfirm
                                key="del"
                                title="Удалить из списка доступа?"
                                onConfirm={() => handleDelete(item.id)}
                              >
                                <Button type="text" danger icon={<DeleteOutlined />} size="small">
                                  Удалить
                                </Button>
                              </Popconfirm>
                            ),
                          ].filter(Boolean)
                        : [
                            <Popconfirm
                              key="del"
                              title="Удалить из списка доступа?"
                              onConfirm={() => handleDelete(item.id)}
                            >
                              <Button type="text" danger icon={<DeleteOutlined />} size="small">
                                Удалить
                              </Button>
                            </Popconfirm>,
                          ]
                    }
                  >
                    <Space size="small" align="start" wrap style={{ width: '100%', minWidth: 0 }}>
                      {levelLabel && (
                        <Tag color={getDepLevelColor(item.depKindCode)} style={{ margin: 0, flexShrink: 0 }}>
                          {levelLabel}
                        </Tag>
                      )}
                      <span
                        style={{
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {item.name}
                      </span>
                    </Space>
                  </List.Item>
                )
              }}
            />
          )}
        </div>
      </Space>
    </Modal>
  )
}

export default AccessModal
