/**
 * Карта сведений об опасной продукции (DPA).
 * Компонент карты и зависимости:
 *   - components/card/DangerousProductCard.tsx
 *   - components/tabs/* (вкладки: Уведомление, Продукция, ТСД, Документы соответствия, Нарушения, Место обнаружения, Меры)
 *   - utils: xmlParser, xmlExporter, referenceDataApi (Dpa*), cardValidation, cardDataComparator, statusButtonConfig, legacyRegisterUrl
 *   - types/card.ts (CardData и др.)
 * API: /api/dpa/xml, /api/dpa/metadata, /api/dpa/save, /api/dpa/delete, и т.д.
 */
export { default as DangerousProductCard } from '@/components/card/DangerousProductCard'
