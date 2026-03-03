import { Tooltip } from 'antd'

interface FieldHelpProps {
  /** Текстовое описание реквизита (показывается при наведении) */
  text: string
}

/**
 * Иконка «!» с тултипом: по наведению показывается описание реквизита.
 * Размещается рядом с подписью поля формы.
 */
const FieldHelp: React.FC<FieldHelpProps> = ({ text }) => (
  <Tooltip title={text} placement="topLeft">
    <span
      className="field-help-icon"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#d9d9d9',
        color: '#595959',
        cursor: 'help',
        marginLeft: 6,
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
      aria-label="Описание поля"
    >
      !
    </span>
  </Tooltip>
)

export default FieldHelp

/**
 * Формирует подпись с опциональной подсказкой для Form.Item label.
 */
export function labelWithHelp(label: string, helpText: string | undefined): React.ReactNode {
  if (!helpText) return label
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {label}
      <FieldHelp text={helpText} />
    </span>
  )
}
