import { Typography } from 'antd'
import type { ReactNode } from 'react'
import type { ValidationResult } from '@/utils/cardValidation'

const { Text } = Typography

export function dprValidationReportContent(vr: ValidationResult): ReactNode {
  return (
    <div>
      {vr.sections.map((sec) => (
        <div key={sec.sectionName} style={{ marginBottom: 12 }}>
          <Text strong>{sec.sectionName}</Text>
          <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 20 }}>
            {sec.remarks.map((r, i) => (
              <li key={`${sec.sectionName}-${i}`}>
                <Text>{r}</Text>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
