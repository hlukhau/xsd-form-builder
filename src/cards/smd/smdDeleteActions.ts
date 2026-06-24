import { Modal, message } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { deleteSmdCard } from './smdApi'
import { postMessageFromCardToParent } from '@/utils/parentPostMessage'

export function formatSmdDocDateForDeleteConfirm(docCreationDate: string | null | undefined): string {
  if (!docCreationDate?.trim()) return '—'
  const date = new Date(docCreationDate.trim().slice(0, 10))
  if (isNaN(date.getTime())) return docCreationDate.trim()
  return format(date, 'dd.MM.yyyy', { locale: ru })
}

export function buildSmdDeleteConfirmText(
  docId: string | null | undefined,
  docCreationDate: string | null | undefined
): string {
  const number = (docId ?? '').trim() || '—'
  const dateLabel = formatSmdDocDateForDeleteConfirm(docCreationDate)
  return `Карта ${number} от ${dateLabel} будет удалена безвозвратно. Продолжить?`
}

export function showSmdDeleteSuccessToast(): void {
  message.open({
    type: 'success',
    content: 'Карта успешно удалена',
    duration: 3,
    style: { marginTop: '38vh' },
  })
}

export function showSmdDeleteErrorModal(reason: string): void {
  Modal.error({
    title: 'Ошибка',
    content: `Не удалось выполнить удаление карты. Причина: ${reason}`,
    okText: 'Ок',
  })
}

export interface ConfirmDeleteSmdCardOptions {
  smdid: number | string
  docId?: string | null
  docCreationDate?: string | null
  guid?: string
  /** С формы карты — возврат на реестр «Исходящие». */
  fromCardView?: boolean
  onDeleted?: () => void
}

/**
 * Диалог подтверждения и удаление карты SMD (форма просмотра или реестр).
 */
export function confirmDeleteSmdCard(options: ConfirmDeleteSmdCardOptions): void {
  const { smdid, docId, docCreationDate, guid, fromCardView, onDeleted } = options
  Modal.confirm({
    title: 'Подтверждение удаления',
    content: buildSmdDeleteConfirmText(docId, docCreationDate),
    okText: 'Удалить',
    okButtonProps: { danger: true },
    cancelText: 'Отмена',
    onOk: async () => {
      try {
        await deleteSmdCard(smdid, guid)
        showSmdDeleteSuccessToast()
        if (fromCardView) {
          postMessageFromCardToParent(
            { code: 'exit', smdDraftDeleted: true, registryTab: 'outgoing' },
            'SMD: выход после удаления на реестр «Исходящие»'
          )
        }
        onDeleted?.()
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        showSmdDeleteErrorModal(reason)
      }
    },
  })
}
