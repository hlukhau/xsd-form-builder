import { useState, useEffect } from 'react'
import { Select, Button, Space, message, Upload } from 'antd'
import { FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import { loadXMLFile, parseXMLToCardData } from '@/utils/xmlParser'
import type { CardData } from '@/types/card'

interface FileSelectorProps {
  onFileLoaded: (data: CardData, xmlText?: string) => void
}

// Список доступных XML файлов из папки public/xml
const XML_FILES = [
  {
    name: 'EEC_R_SM_SS_08_DangerousProductAlert_v1.0.0.xml',
    path: '/xml/EEC_R_SM_SS_08_DangerousProductAlert_v1.0.0.xml',
  },
  {
    name: 'EEC_R_SM_SS_08_DangerousProductAlert_Ex1.xml',
    path: '/xml/EEC_R_SM_SS_08_DangerousProductAlert_Ex1.xml',
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
      console.log('Данные успешно распарсены, передаем в компонент')
      onFileLoaded(cardData, xmlText)
      message.success('Файл успешно загружен')
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
      reader.onload = (e) => {
        try {
          const xmlText = e.target?.result as string
          console.log('Загружен XML файл, размер:', xmlText.length, 'символов')
          
          // Сохраняем исходный XML в localStorage для последующего сравнения
          localStorage.setItem('originalXML', xmlText)
          
          const cardData = parseXMLToCardData(xmlText)
          console.log('Данные успешно распарсены, передаем в компонент')
          onFileLoaded(cardData, xmlText)
          message.success('Файл успешно загружен')
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
    <div style={{ padding: '16px', background: '#f5f5f5', marginBottom: '16px' }}>
      <Space wrap>
        <FileTextOutlined />
        <Select
          placeholder="Выберите XML файл из папки xml"
          style={{ width: 400 }}
          value={selectedFile}
          onChange={setSelectedFile}
          options={availableFiles.map((file) => ({
            label: file.name,
            value: file.name,
          }))}
        />
        <Button
          type="primary"
          onClick={handleLoadFile}
          loading={loading}
          disabled={!selectedFile}
        >
          Загрузить из папки
        </Button>
        <span style={{ color: '#999' }}>или</span>
        <Upload
          accept=".xml"
          beforeUpload={handleFileUpload}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />} loading={loading}>
            Загрузить файл
          </Button>
        </Upload>
      </Space>
    </div>
  )
}

export default FileSelector

