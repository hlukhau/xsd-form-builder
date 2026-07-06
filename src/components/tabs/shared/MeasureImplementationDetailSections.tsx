import { useState } from 'react'
import type { ReactNode } from 'react'
import { Descriptions } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type {
  DocumentReferenceDetails,
  MeasureImplementationItem,
  SubjectDetails,
  UnifiedAuthorityDetails,
} from '@/types/card'
import {
  hasDocumentReferenceContent,
  hasSubjectDetailsContent,
  hasUnifiedAuthorityMeasureContent,
} from '@/utils/xmlExporter'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useBorderCheckpointOptions } from '@/hooks/shared/useBorderCheckpointOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/shared/useSanitaryMeasureObjKindOptions'
import { useIdentityDocKindOptions } from '@/hooks/shared/useIdentityDocKindOptions'
import { useLegalFormOptions } from '@/hooks/shared/useLegalFormOptions'
import { useIdentificationMethodOptions } from '@/hooks/shared/useIdentificationMethodOptions'
import { useCommunicationChannelOptions } from '@/hooks/shared/useCommunicationChannelOptions'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import {
  getAddressListFromSubject,
  getAddressListFromOrganization,
  formatAddressList,
  getDefaultAddressKindName,
} from '@/utils/addressFormatUtils'
import { buildContactDisplayLines } from '@/utils/contactDisplayUtils'
import RecordIndexPager from './RecordIndexPager'

const sectionBoxStyle: React.CSSProperties = {
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  marginBottom: 12,
  background: '#fafafa',
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#f0f0f0',
  fontWeight: 600,
  borderBottom: '1px solid #d9d9d9',
}

function formatDateUi(date: string | null | undefined): string {
  if (!date?.trim()) return '—'
  const dateObj = new Date(date.slice(0, 10))
  if (isNaN(dateObj.getTime())) return date
  return format(dateObj, 'dd.MM.yyyy', { locale: ru })
}

function SectionBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={sectionBoxStyle}>
      <div style={sectionHeaderStyle}>{title}</div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  )
}

const AuthoritySection: React.FC<{ authorities: UnifiedAuthorityDetails[] }> = ({ authorities }) => {
  const [index, setIndex] = useState(0)
  const { getDisplayLabel } = useCountryOptions()
  const list = authorities.length > 0 ? authorities : [{}]
  const a = list[Math.min(index, list.length - 1)] ?? {}

  return (
    <SectionBox title="Уполномоченный орган">
      <RecordIndexPager count={authorities.length} index={index} onChange={setIndex} />
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Страна">{getDisplayLabel(a.country) || '—'}</Descriptions.Item>
        <Descriptions.Item label="Идентификатор">{a.authorityId?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Наименование">{a.authorityName?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Краткое наименование">{a.authorityBriefName?.trim() || '—'}</Descriptions.Item>
      </Descriptions>
    </SectionBox>
  )
}

const SubjectSection: React.FC<{ subjects: SubjectDetails[] }> = ({ subjects }) => {
  const [index, setIndex] = useState(0)
  const list = subjects.length > 0 ? subjects : [{}]
  const subject = list[Math.min(index, list.length - 1)] ?? {}

  return (
    <SectionBox title="Субъект-исполнитель">
      <RecordIndexPager count={subjects.length} index={index} onChange={setIndex} />
      <SubjectDetailsView subject={subject} />
    </SectionBox>
  )
}

const SubjectDetailsView: React.FC<{ subject: SubjectDetails }> = ({ subject }) => {
  const { getNameByCode: getIdentityDocKindNameByCode } = useIdentityDocKindOptions()
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const { getNameByCode: getCommunicationChannelNameByCode } = useCommunicationChannelOptions()

  const be = subject.businessEntity
  const country = subject.country ?? be?.country
  const { getNameByCode: getLegalFormNameByCode } = useLegalFormOptions(country)
  const { getDisplayLabel: getIdentificationMethodLabel } = useIdentificationMethodOptions(country)
  const subjectName = subject.subjectName ?? be?.businessEntityName
  const briefName = be?.businessEntityBriefName
  const isOpfFromLegalFormRef = !!(be?.businessEntityTypeCode && be?.businessEntityTypeCodeListId === '2049')
  const orgForm =
    isOpfFromLegalFormRef && be?.businessEntityTypeCode
      ? getLegalFormNameByCode(be.businessEntityTypeCode)
        ? `${be.businessEntityTypeCode} — ${getLegalFormNameByCode(be.businessEntityTypeCode)}`
        : be.businessEntityTypeCode
      : be?.businessEntityTypeName
  const addressList = be?.addresses?.length
    ? getAddressListFromOrganization(be)
    : getAddressListFromSubject(subject)
  const addressLines = formatAddressList(addressList, getDefaultAddressKindName, getCountryDisplayLabel)
  const contacts = subject.contacts ?? be?.contacts ?? []
  const contactDisplayLines = buildContactDisplayLines(contacts, getCommunicationChannelNameByCode)

  return (
    <Descriptions column={1} bordered size="small">
      <Descriptions.Item label="Страна">{getCountryDisplayLabel(country) || '—'}</Descriptions.Item>
      <Descriptions.Item label="Наименование субъекта">{subjectName?.trim() || '—'}</Descriptions.Item>
      <Descriptions.Item label="Краткое наименование">{briefName?.trim() || '—'}</Descriptions.Item>
      <Descriptions.Item label="Организационно-правовая форма">{orgForm?.trim() || '—'}</Descriptions.Item>
      <Descriptions.Item label="Идентификатор субъекта">{be?.businessEntityId?.trim() || '—'}</Descriptions.Item>
      <Descriptions.Item label="Метод идентификации">
        {identificationMethodLabel(subject, getIdentificationMethodLabel)}
      </Descriptions.Item>
      <Descriptions.Item label="Таможенный номер">{be?.customsNumber?.trim() || '—'}</Descriptions.Item>
      <Descriptions.Item label="Идентификатор налогоплательщика">{be?.taxpayerId?.trim() || '—'}</Descriptions.Item>
      {subject.identityDoc && (
        <>
          <Descriptions.Item label="Удостоверение личности. Страна">
            {getCountryDisplayLabel(subject.identityDoc.country) || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Вид документа">
            {identityDocKindLabel(subject.identityDoc, getIdentityDocKindNameByCode)}
          </Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Серия">
            {subject.identityDoc.docSeriesId?.trim() || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Номер">
            {subject.identityDoc.docId?.trim() || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Дата">
            {formatDateUi(subject.identityDoc.docCreationDate)}
          </Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Срок действия">
            {formatDateUi(subject.identityDoc.docValidityDate)}
          </Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Уполномоченный орган. Идентификатор">
            {subject.identityDoc.authorityId?.trim() || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Удостоверение личности. Уполномоченный орган. Наименование">
            {subject.identityDoc.authorityName?.trim() || '—'}
          </Descriptions.Item>
        </>
      )}
      <Descriptions.Item label="Адреса">
        {addressLines.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {addressLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        ) : (
          '—'
        )}
      </Descriptions.Item>
      <Descriptions.Item label="Контактные реквизиты">
        {contactDisplayLines.length > 0 ? (
          <div>
            {contactDisplayLines.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        ) : (
          '—'
        )}
      </Descriptions.Item>
    </Descriptions>
  )
}

function identificationMethodLabel(
  subject: SubjectDetails,
  getIdentificationMethodLabel: (code: string) => string
): string {
  const method = subject.businessEntity?.identificationMethod
  if (!method?.trim()) return '—'
  return getIdentificationMethodLabel(method) || method
}

function identityDocKindLabel(
  doc: NonNullable<SubjectDetails['identityDoc']>,
  getIdentityDocKindNameByCode: (code: string | undefined) => string | null
): string {
  if (doc.docKindCode && doc.docKindCodeListId === '2053') {
    const name = getIdentityDocKindNameByCode(doc.docKindCode)
    return name ?? doc.docKindName ?? '—'
  }
  return doc.docKindName?.trim() || '—'
}

const DocumentSection: React.FC<{ doc?: DocumentReferenceDetails }> = ({ doc }) => {
  const { getDisplayLabel: getShipDocKindLabel } = useShipDocKindOptions()
  const kind =
    doc?.docKindCode?.trim() && doc.docKindCodeListId === '2009'
      ? getShipDocKindLabel(doc.docKindCode) || doc.docKindCode
      : '—'

  return (
    <SectionBox title="Документ, устанавливающий мероприятие">
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Вид">{kind}</Descriptions.Item>
        <Descriptions.Item label="Наименование">{doc?.docName?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Номер">{doc?.docId?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Дата документа">{formatDateUi(doc?.docCreationDate)}</Descriptions.Item>
        <Descriptions.Item label="Срок действия. Начало">{formatDateUi(doc?.docStartDate)}</Descriptions.Item>
      </Descriptions>
    </SectionBox>
  )
}

const PlaceSection: React.FC<{ place?: MeasureImplementationItem['placeDetails'] }> = ({ place }) => {
  const { getNameByCode: getCheckpointNameByCode } = useBorderCheckpointOptions()
  const code = place?.borderCheckpointCode?.trim()
  const codeLabel = code
    ? `${code} — ${getCheckpointNameByCode(code) ?? '—'}`
    : '—'

  return (
    <SectionBox title="Место проведения мероприятия">
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Регион">{place?.regionName?.trim() || '—'}</Descriptions.Item>
        <Descriptions.Item label="Код пункта пропуска">{codeLabel}</Descriptions.Item>
        <Descriptions.Item label="Наименование пункта пропуска">
          {place?.borderCheckpointName?.trim() || '—'}
        </Descriptions.Item>
      </Descriptions>
    </SectionBox>
  )
}

function hasPlaceContent(place?: MeasureImplementationItem['placeDetails']): boolean {
  if (!place) return false
  return !!(
    place.regionName?.trim() ||
    place.borderCheckpointCode?.trim() ||
    place.borderCheckpointName?.trim()
  )
}

export function hasMeasureImplementationSubsections(item: MeasureImplementationItem): boolean {
  const authorities = (item.authorities?.length ? item.authorities : item.authority ? [item.authority] : [])
    .filter(hasUnifiedAuthorityMeasureContent)
  const subjects = (item.subjectDetailsList?.length
    ? item.subjectDetailsList
    : item.subjectDetails
      ? [item.subjectDetails]
      : []
  ).filter(hasSubjectDetailsContent)
  return (
    authorities.length > 0 ||
    subjects.length > 0 ||
    hasDocumentReferenceContent(item.documentDetails) ||
    hasPlaceContent(item.placeDetails)
  )
}

/** Четыре раздела детализации мероприятия (макет SMD SS.09). */
const MeasureImplementationDetailSections: React.FC<{ item: MeasureImplementationItem }> = ({ item }) => {
  const authorities = (item.authorities?.length ? item.authorities : item.authority ? [item.authority] : [])
    .filter(hasUnifiedAuthorityMeasureContent)
  const subjects = (item.subjectDetailsList?.length
    ? item.subjectDetailsList
    : item.subjectDetails
      ? [item.subjectDetails]
      : []
  ).filter(hasSubjectDetailsContent)

  const showAuthority = authorities.length > 0
  const showSubject = subjects.length > 0
  const showDocument = hasDocumentReferenceContent(item.documentDetails)
  const showPlace = hasPlaceContent(item.placeDetails)

  if (!showAuthority && !showSubject && !showDocument && !showPlace) {
    return null
  }

  return (
    <div style={{ marginTop: 16 }}>
      {showAuthority ? <AuthoritySection authorities={authorities} /> : null}
      {showSubject ? <SubjectSection subjects={subjects} /> : null}
      {showDocument ? <DocumentSection doc={item.documentDetails} /> : null}
      {showPlace ? <PlaceSection place={item.placeDetails} /> : null}
    </div>
  )
}

export function formatMeasureAffectedObjectKind(
  raw: string | null | undefined,
  getNameByCode: (code: string | undefined) => string | null
): string {
  const text = (raw ?? '').trim()
  if (!text) return '—'
  return text
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((code) => {
      const name = getNameByCode(code)
      return name ? `${code} — ${name}` : code
    })
    .join('; ')
}

export default MeasureImplementationDetailSections
