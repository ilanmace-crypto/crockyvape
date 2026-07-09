import { useEffect, useState } from 'react'
import ApiService from '../services/api'

export default function TelegramLogin({ onLogin }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        setUser(parsed)
        onLogin(parsed)
      } catch (e) {
        localStorage.removeItem('telegram_user')
      }
    }

    const tgWebApp = window.Telegram?.WebApp
    if (!savedUser && tgWebApp?.initDataUnsafe?.user && tgWebApp?.initDataUnsafe?.hash) {
      autoLoginFromTelegram(tgWebApp.initDataUnsafe).then((ok) => {
        if (!ok) {
          setLoading(false)
        }
      })
    } else {
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

  const botUsername = process.env.VITE_TELEGRAM_BOT_USERNAME || 'your_bot_username'

  return (
    <div className="telegram-login-container">
      <div id="telegram-login-widget"></div>
      <script
        async
        src={`https://telegram.org/js/telegram-widget.js?22`}
        data-telegram-login={botUsername}
        data-size="large"
        data-radius="8"
        data-request-access="write"
        data-onauth="onTelegramAuth(user)"
      ></script>
    </div>
  )
}
