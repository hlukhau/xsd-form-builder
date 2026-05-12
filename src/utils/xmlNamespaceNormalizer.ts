export const DPA_CANONICAL_XML_NAMESPACES: Record<string, string> = {
  ccdo: 'urn:EEC:M:ComplexDataObjects:v0.4.12',
  csdo: 'urn:EEC:M:SimpleDataObjects:v0.4.12',
  bdt: 'urn:EEC:M:BaseDataTypes:v0.4.12',
  smcdo: 'urn:EEC:M:SM:ComplexDataObjects:v0.3.9',
  smsdo: 'urn:EEC:M:SM:SimpleDataObjects:v0.3.9',
  doc: 'urn:EEC:R:SM:SS:08:DangerousProductAlert:v1.0.0',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
}

/** Карта DPR (ответ на уведомление): корень DangerousProductAlertResponseDetails */
export const DPR_CANONICAL_XML_NAMESPACES: Record<string, string> = {
  ccdo: 'urn:EEC:M:ComplexDataObjects:v0.4.12',
  csdo: 'urn:EEC:M:SimpleDataObjects:v0.4.12',
  bdt: 'urn:EEC:M:BaseDataTypes:v0.4.12',
  smcdo: 'urn:EEC:M:SM:ComplexDataObjects:v0.3.9',
  smsdo: 'urn:EEC:M:SM:SimpleDataObjects:v0.3.9',
  doc: 'urn:EEC:R:SM:SS:08:DangerousProductAlertResponse:v1.0.0',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
}

export const PHA_CANONICAL_XML_NAMESPACES: Record<string, string> = {
  ccdo: 'urn:EEC:M:ComplexDataObjects:v0.4.12',
  csdo: 'urn:EEC:M:SimpleDataObjects:v0.4.12',
  bdt: 'urn:EEC:M:BaseDataTypes:v0.4.12',
  smcdo: 'urn:EEC:M:SM:ComplexDataObjects:v0.3.9',
  smsdo: 'urn:EEC:M:SM:SimpleDataObjects:v0.3.9',
  doc: 'urn:EEC:R:SM:SS:08:PublicHealthAlert:v1.0.0',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Нормализует namespace-префиксы XML по URI к каноническим для парсера.
 */
export function normalizeXmlNamespaces(xmlText: string, canonicalNamespaces: Record<string, string>): string {
  let normalized = xmlText

  for (const [targetPrefix, uri] of Object.entries(canonicalNamespaces)) {
    const declRegex = new RegExp(`xmlns:([\\w.-]+)=("|')${escapeRegExp(uri)}\\2`, 'g')
    const matches = Array.from(normalized.matchAll(declRegex))
    if (!matches.length) continue

    const hasTargetDeclaration = new RegExp(`xmlns:${escapeRegExp(targetPrefix)}=("|')${escapeRegExp(uri)}\\1`).test(normalized)

    for (const match of matches) {
      const sourcePrefix = match[1]
      if (!sourcePrefix || sourcePrefix === targetPrefix) continue

      normalized = normalized.replace(
        new RegExp(`<(\\/?)${escapeRegExp(sourcePrefix)}:`, 'g'),
        `<$1${targetPrefix}:`
      )
      normalized = normalized.replace(
        new RegExp(`\\s${escapeRegExp(sourcePrefix)}:([\\w.-]+)=`, 'g'),
        ` ${targetPrefix}:$1=`
      )

      const exactDeclRegex = new RegExp(`\\sxmlns:${escapeRegExp(sourcePrefix)}=("|')${escapeRegExp(uri)}\\1`, 'g')
      if (hasTargetDeclaration) {
        normalized = normalized.replace(exactDeclRegex, '')
      } else {
        normalized = normalized.replace(exactDeclRegex, ` xmlns:${targetPrefix}="${uri}"`)
      }
    }
  }

  return normalized
}
