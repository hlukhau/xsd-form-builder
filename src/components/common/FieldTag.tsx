import type { CSSProperties, ReactNode } from 'react'

interface FieldTagProps {
  label: string
}

interface FieldTagBlockProps extends FieldTagProps {
  children: ReactNode
  style?: CSSProperties
}

export const fieldTagLabelStyle: CSSProperties = {
  display: 'inline-block',
  padding: '0 7px',
  fontSize: 10,
  lineHeight: '14px',
  fontWeight: 500,
  color: '#4b5563',
  background: '#f5f7fa',
  border: '1px solid #d9e1ec',
  borderBottom: 'none',
  borderRadius: '7px 7px 0 0',
  marginBottom: '-2px',
  marginLeft: 8,
}

export function FieldTag({ label }: FieldTagProps) {
  return (
    <div style={{ marginBottom: -2, position: 'relative', zIndex: 1 }}>
      <span style={fieldTagLabelStyle}>{label}</span>
    </div>
  )
}

export function FieldTagBlock({ label, children, style }: FieldTagBlockProps) {
  return (
    <div style={style}>
      <FieldTag label={label} />
      {children}
    </div>
  )
}
