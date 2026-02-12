import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import App from './App'
import './index.css'

const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL : '/xsd_form_builder/'

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
    
    // Отступы
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    
    // Тени
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    boxShadowSecondary: '0 4px 12px rgba(0, 0, 0, 0.12)',
    
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
      borderRadiusLG: 8,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
      headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    Button: {
      borderRadius: 6,
      fontWeight: 500,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
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

const basename = import.meta.env.BASE_URL?.replace(/\/$/, '') || ''

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
<<<<<<< HEAD
    <BrowserRouter basename={basename}>
      <ConfigProvider locale={ruRU} theme={customTheme}>
        <App />
      </ConfigProvider>
    </BrowserRouter>
=======
    <ConfigProvider locale={ruRU} theme={customTheme}>
      <BrowserRouter basename={base.replace(/\/$/, '') || '/'}>
        <App />
      </BrowserRouter>
    </ConfigProvider>
>>>>>>> 3a8ab20 (linux)
  </React.StrictMode>,
)

