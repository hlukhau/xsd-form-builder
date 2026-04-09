import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import App from './App'
import './index.css'

const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL : '/dpa_card/'

const { defaultAlgorithm, darkAlgorithm } = theme

// Промышленная тема Ant Design
const customTheme = {
  token: {
    // Цвета
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',
    
    // Радиусы
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    
    // Отступы (компактно для iframe)
    padding: 12,
    paddingLG: 16,
    paddingSM: 8,
    paddingXS: 4,
    
    // Без заметных теней для встраивания
    boxShadow: 'none',
    boxShadowSecondary: 'none',
    
    // Шрифты
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,
    
    // Высота компонентов
    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,
  },
  components: {
    Card: {
      borderRadiusLG: 0,
      boxShadow: 'none',
      headerBg: '#1890ff',
    },
    Button: {
      borderRadius: 6,
      fontWeight: 500,
      boxShadow: 'none',
    },
    Input: {
      borderRadius: 6,
    },
    Table: {
      borderRadius: 6,
    },
    Modal: {
      borderRadius: 8,
    },
    Tabs: {
      borderRadius: 6,
    },
  },
  algorithm: defaultAlgorithm,
}

const basename = (import.meta.env?.BASE_URL || base).replace(/\/$/, '') || '/'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <ConfigProvider locale={ruRU} theme={customTheme}>
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

