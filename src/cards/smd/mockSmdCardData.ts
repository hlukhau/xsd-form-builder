import type { CardData } from '@/types/card'

/** Демо-данные тела карты SMD до подключения парсера XML SS.09. */
export function createMockSmdCardData(partial?: Partial<CardData>): CardData {
  const base: CardData = {
    country: 'BY',
    registrationNumber: 'BY-DOC-001',
    version: 1,
    source: 'Исходящие сведения',
    datasourceKindCode: '2',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    status: 'Новое',
    electronicDocument: {
      messageCode: 'P.SS.09.MSG.001',
      documentCode: 'R.SM.SS.09.001',
      documentId: '',
      documentDate: '',
      language: 'ru',
      sourceDocumentId: '',
      validityPeriod: { start: '', end: '' },
      updateDateTime: '',
    },
    notification: {
      country: 'BY',
      registrationNumber: 'BY-DOC-001',
      type: 'Сведения о введении временной санитарной меры',
      formationDate: '2025-01-15',
      endDate: null,
      authorizedBody: {
        country: 'BY',
        identifier: '',
        name: 'Республиканский центр гигиены',
        shortName: 'РЦГЭ',
      },
    },
    statusHistory: [],
    accessList: [],
    measures: {
      measures: [
        { measureCode: '01', measureName: 'Запрет ввоза' },
      ],
    },
    phaDisease: {
      diseaseName: '—',
      firstCaseDate: '',
      lastCaseDate: '',
      crossborderSpreadRiskIndicator: null,
      pathogens: [],
    },
    smdProductBatches: [
      {
        key: 'batch-1',
        summaryLabel: 'Продукция 1',
        product: {
          typeCode: '',
          typeName: 'Пищевая продукция',
          productDetails: { productName: 'Пример наименования продукции' },
          manufacturer: { country: 'BY', businessEntityName: 'Пример изготовителя' },
        },
        tsd: { batches: [] },
      },
    ],
  }
  return { ...base, ...partial }
}
