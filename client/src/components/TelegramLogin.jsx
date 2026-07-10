import { useEffect, useRef, useState } from 'react'
import ApiService from '../services/api'

export default function TelegramLogin({ onLogin }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const widgetContainerRef = useRef(null)

  useEffect(() => {
    const autoLoginFromTelegram = async (telegramData) => {
      try {
        const response = await ApiService.post('/auth/telegram', telegramData)
        if (response.success) {
          setUser(response.user)
          localStorage.setItem('telegram_user', JSON.stringify(response.user))
          localStorage.setItem('telegram_token', response.token)
          onLogin(response.user)
          return true
        }
      } catch (error) {
        console.warn('Auto Telegram auth failed:', error)
      }
      return false
    }

    // Проверяем, есть ли сохраненный пользователь
    const savedUser = localStorage.getItem('telegram_user')
    const tgWebApp = window.Telegram?.WebApp
    const initDataUnsafe = tgWebApp?.initDataUnsafe

    const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'zakazminskbot'
    console.log('TelegramLogin mount', {
      savedUser: savedUser ? true : false,
      initDataUnsafe: initDataUnsafe ?? null,
      botUsername,
    })

    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        setUser(parsed)
        onLogin(parsed)
      } catch (e) {
        localStorage.removeItem('telegram_user')
      }
    }

    if (!savedUser && initDataUnsafe?.user && initDataUnsafe?.hash) {
      console.log('Telegram initDataUnsafe detected, attempting auto-login', initDataUnsafe)
      autoLoginFromTelegram(initDataUnsafe).then((ok) => {
        if (!ok) {
          setLoading(false)
        }
      })
    } else {
      if (!savedUser && tgWebApp) {
        console.warn('Telegram WebApp detected, but initDataUnsafe is missing or incomplete', initDataUnsafe)
      }
      if (!savedUser && !tgWebApp) {
        console.warn('Telegram WebApp not detected; user cannot be auto-logged in without WebApp context')
      }
      setLoading(false)
    }

    // Обработка callback от Telegram Widget
    window.onTelegramAuth = async (telegramUser) => {
      try {
        const response = await ApiService.post('/auth/telegram', telegramUser)
        
        if (response.success) {
          setUser(response.user)
          localStorage.setItem('telegram_user', JSON.stringify(response.user))
          localStorage.setItem('telegram_token', response.token)
          onLogin(response.user)
        } else {
          alert('Ошибка авторизации: ' + (response.error || 'Неизвестная ошибка'))
        }
      } catch (error) {
        console.error('Telegram auth error:', error)
        alert('Ошибка авторизации')
      }
    }

    return () => {
      window.onTelegramAuth = null
    }
  }, [onLogin])

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('telegram_user')
    localStorage.removeItem('telegram_token')
    onLogin(null)
  }

  if (loading) {
    return null
  }

  if (user) {
    return (
      <div className="telegram-user-info">
        <span className="telegram-user-name">
          {user.telegram_first_name} {user.telegram_last_name}
          {user.telegram_username && ` (@${user.telegram_username})`}
        </span>
        <button className="telegram-logout-btn" onClick={handleLogout}>
          Выйти
        </button>
      </div>
    )
  }

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'zakazminskbot'

  useEffect(() => {
    if (!widgetContainerRef.current) return

    const existingScript = document.getElementById('telegram-login-widget-script')
    if (existingScript) {
      existingScript.remove()
    }

    const script = document.createElement('script')
    script.id = 'telegram-login-widget-script'
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')

    widgetContainerRef.current.appendChild(script)

    return () => {
      if (widgetContainerRef.current) {
        widgetContainerRef.current.innerHTML = ''
      }
    }
  }, [botUsername])

  return (
    <div className="telegram-login-container">
      <div className="telegram-login-notice">
        <div style={{ marginBottom: '8px', fontWeight: 600 }}>Войдите через Telegram</div>
        <div style={{ fontSize: '13px', color: '#666' }}>
          Чтобы сайт узнал вас и сохранил ваш Telegram-аккаунт, нажмите кнопку ниже.
        </div>
      </div>
      <div ref={widgetContainerRef} id="telegram-login-widget"></div>
    </div>
  )
}
