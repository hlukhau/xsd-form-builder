/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string
  /** Базовый URL карты «результат рассмотрения» для ссылки из PPV (например /review_result_card или полный https://…). К пути добавляются /{edocId}/{guid}. */
  readonly VITE_REVIEW_RESULT_CARD_BASE?: string
  readonly VITE_SMA_CARD_BASE?: string
  readonly VITE_SMAR_CARD_BASE?: string
  readonly VITE_SMR_CARD_BASE?: string
}

