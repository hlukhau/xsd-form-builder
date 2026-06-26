import { Button } from 'antd'

interface RecordIndexPagerProps {
  count: number
  index: number
  onChange: (index: number) => void
}

/** Навигация по нескольким записям внутри раздела детализации (как в макете SMD). */
const RecordIndexPager: React.FC<RecordIndexPagerProps> = ({ count, index, onChange }) => {
  if (count <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
      <Button type="link" size="small" disabled={index === 0} onClick={() => onChange(Math.max(0, index - 1))}>
        &lt;&lt; Предыдущая запись
      </Button>
      {Array.from({ length: count }, (_, i) => (
        <Button key={i} type={index === i ? 'primary' : 'link'} size="small" onClick={() => onChange(i)}>
          {i + 1}
        </Button>
      ))}
      <Button
        type="link"
        size="small"
        disabled={index >= count - 1}
        onClick={() => onChange(Math.min(count - 1, index + 1))}
      >
        Следующая запись &gt;&gt;
      </Button>
    </div>
  )
}

export default RecordIndexPager
