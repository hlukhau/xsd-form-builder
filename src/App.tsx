import { useState } from 'react'
import DangerousProductCard from './components/card/DangerousProductCard'
import FileSelector from './components/FileSelector'
import type { CardData } from './types/card'

// Моковые данные для демонстрации
const mockCardData: CardData = {
  // Метаинформация
  country: 'RU',
  registrationNumber: 'RU-95746-44',
  version: 1,
  source: 'входящие',
  createdAt: '2025-10-10T10:34:00',
  modifiedAt: '2025-10-10T11:45:00',
  status: 'в обработке',
  
  // Электронный документ
  electronicDocument: {
    messageCode: 'P.SS.08.MSG.017',
    documentCode: 'R.SM.SS.08.002',
    documentId: '449733c1-3d73-4bfa-9761-3113ac47eb3a',
    documentDate: '2025-10-10T10:34:00',
    language: 'ru',
    sourceDocumentId: '5ab92646-038c-4654-9f31-dd35e59ea8bc',
    validityPeriod: {
      start: '2025-10-10T10:34:00',
      end: '2026-10-10T10:32:00',
    },
    updateDateTime: '2026-01-05T09:14:00',
  },
  
  // Уведомление
  notification: {
    country: 'RU',
    registrationNumber: 'RU-95746-44',
    type: 'обнаружение продукции, опасной для жизни, здоровья человека и среды его обитания',
    formationDate: '2025-10-09',
    endDate: null,
    authorizedBody: {
      country: 'RU',
      identifier: '',
      name: 'Федеральная служба по надзору в сфере защиты прав потребителей и благополучия человека',
      shortName: '',
    },
  },
  
  // История статусов
  statusHistory: [
    {
      status: 'новое',
      dateTime: '2025-10-10T15:04:00',
      employee: null,
    },
    {
      status: 'в обработке',
      dateTime: '2025-10-11T10:49:00',
      employee: 'А.К. Сидоров',
    },
  ],
  
  // Доступные ЦГЭ
  accessList: [
    { id: '1', name: 'РЦГЭИОЗ' },
    { id: '2', name: 'Брестский областной ЦГЭ и ОЗ' },
    { id: '3', name: 'Полоцкий зональный ЦГЭ' },
  ],
}

function App() {
  const [cardData, setCardData] = useState<CardData | null>(null)

  const handleFileLoaded = (data: CardData) => {
    console.log('App: получены данные из FileSelector:', data)
    setCardData(data)
    console.log('App: cardData установлен')
  }

  return (
    <div className="app">
      <FileSelector onFileLoaded={handleFileLoaded} />
      {cardData ? (
        <DangerousProductCard data={cardData} onUpdate={setCardData} />
      ) : (
        <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
          Выберите XML файл для загрузки
        </div>
      )}
    </div>
  )
}

export default App

