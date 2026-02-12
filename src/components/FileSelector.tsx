import { useState, useEffect } from 'react'
import { Select, Button, Space, message, Upload } from 'antd'
import { FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import { loadXMLFile, parseXMLToCardData, validateAndEnrichCardData, getTextContent } from '@/utils/xmlParser'
import type { CardData } from '@/types/card'

interface FileSelectorProps {
  onFileLoaded: (data: CardData, xmlText?: string) => void
}

// Список доступных XML файлов из папки public/xml
// Используем import.meta.env.BASE_URL для получения base path из конфигурации Vite
const BASE_URL = import.meta.env.BASE_URL || '/';
const XML_FILES = [
  {
    name: 'EEC_R_SM_SS_08_DangerousProductAlert_v1.0.0.xml',
    path: `${BASE_URL}xml/EEC_R_SM_SS_08_DangerousProductAlert_v1.0.0.xml`,
  },
  {
    name: 'EEC_R_SM_SS_08_DangerousProductAlert_Ex1.xml',
    path: `${BASE_URL}xml/EEC_R_SM_SS_08_DangerousProductAlert_Ex1.xml`,
  },
]

const FileSelector: React.FC<FileSelectorProps> = ({ onFileLoaded }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [availableFiles] = useState(XML_FILES)

  // Попытка загрузить список файлов из папки (если есть API)
  useEffect(() => {
    // Здесь можно добавить загрузку списка файлов с сервера
    // fetch('/api/xml-files').then(...)
  }, [])

  const handleLoadFile = async () => {
    if (!selectedFile) {
      message.warning('Выберите файл для загрузки')
      return
    }

    setLoading(true)
    try {
      const file = availableFiles.find((f) => f.name === selectedFile)
      if (!file) {
        throw new Error('Файл не найден')
      }

      console.log('Загружаем файл:', file.path)
      const xmlText = await loadXMLFile(file.path)
      console.log('Файл загружен, размер:', xmlText.length, 'символов')
      
      // Сохраняем исходный XML в localStorage для последующего сравнения
      localStorage.setItem('originalXML', xmlText)
      
      const cardData = parseXMLToCardData(xmlText)
      console.log('Данные успешно распарсены')
      
      // Извлекаем код вида уведомления из XML для валидации
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
      // Ищем DangerousProductAlertDetails по той же логике, что и в парсере
      let alertDetails: Element | null = null
      const allElements = xmlDoc.getElementsByTagName('*')
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i]
        const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        if (localName === 'dangerousproductalertdetails') {
          alertDetails = el
          break
        }
      }
      const incidentKindCode = getTextContent(alertDetails, 'IncidentKindCode') || ''
      
      // Валидация и обогащение данных справочниками
      const validationResult = await validateAndEnrichCardData(cardData, incidentKindCode || undefined)
      
      // Показываем предупреждения, если есть
      if (validationResult.validationWarnings.length > 0) {
        validationResult.validationWarnings.forEach(warning => {
          message.warning(warning)
        })
      }
      
      // Показываем ошибки, если есть
      if (validationResult.validationErrors.length > 0) {
        validationResult.validationErrors.forEach(error => {
          message.error(error)
        })
      }
      
      console.log('Валидация завершена, передаем в компонент')
      onFileLoaded(validationResult.cardData, xmlText)
      message.success('Файл успешно загружен и проверен')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
      message.error(`Ошибка загрузки файла: ${errorMessage}`)
      console.error('Ошибка загрузки XML:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    setLoading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const xmlText = e.target?.result as string
          console.log('Загружен XML файл, размер:', xmlText.length, 'символов')
          
          // Сохраняем исходный XML в localStorage для последующего сравнения
          localStorage.setItem('originalXML', xmlText)
          
          const cardData = parseXMLToCardData(xmlText)
          console.log('Данные успешно распарсены')
          
          // Извлекаем код вида уведомления из XML для валидации
          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
          // Ищем DangerousProductAlertDetails по той же логике, что и в парсере
          let alertDetails: Element | null = null
          const allElements = xmlDoc.getElementsByTagName('*')
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i]
            const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase()
            if (localName === 'dangerousproductalertdetails') {
              alertDetails = el
              break
            }
          }
          const incidentKindCode = getTextContent(alertDetails, 'IncidentKindCode') || ''
          
          // Валидация и обогащение данных справочниками
          const validationResult = await validateAndEnrichCardData(cardData, incidentKindCode || undefined)
          
          // Показываем предупреждения, если есть
          if (validationResult.validationWarnings.length > 0) {
            validationResult.validationWarnings.forEach(warning => {
              message.warning(warning)
            })
          }
          
          // Показываем ошибки, если есть
          if (validationResult.validationErrors.length > 0) {
            validationResult.validationErrors.forEach(error => {
              message.error(error)
            })
          }
          
          console.log('Валидация завершена, передаем в компонент')
          onFileLoaded(validationResult.cardData, xmlText)
          message.success('Файл успешно загружен и проверен')
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
          message.error(`Ошибка парсинга XML: ${errorMessage}`)
          console.error('Ошибка парсинга XML:', error)
        } finally {
          setLoading(false)
        }
      }
      reader.onerror = () => {
        message.error('Ошибка чтения файла')
        setLoading(false)
      }
      reader.readAsText(file, 'UTF-8')
    } catch (error) {
      message.error(`Ошибка загрузки файла: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
      setLoading(false)
    }
    return false // Предотвращаем автоматическую загрузку
  }

      return (
        <div className="file-selector-container fade-in">
          <Space wrap size="middle" style={{ width: '100%' }}>
            <FileTextOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
            <Select
              placeholder="Выберите XML файл из папки xml"
              style={{ width: 400, minWidth: 300 }}
              value={selectedFile}
              onChange={setSelectedFile}
              options={availableFiles.map((file) => ({
                label: file.name,
                value: file.name,
              }))}
              size="large"
            />
            <Button
              type="primary"
              onClick={handleLoadFile}
              loading={loading}
              disabled={!selectedFile}
              size="large"
            >
              Загрузить для тестирования
            </Button>
            <span style={{ color: '#8c8c8c', fontWeight: 500 }}>или</span>
            <Upload
              accept=".xml"
              beforeUpload={handleFileUpload}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />} loading={loading} size="large">
                Загрузить файл
              </Button>
            </Upload>
          </Space>
        </div>
      )
}

export default FileSelector

