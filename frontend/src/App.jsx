import React, { useState, useEffect } from 'react'
import Login from './components/Login'
import Chat from './components/Chat'
import './App.css'

function App() {
  // Sahifa yuklanganda localStorage'dan foydalanuvchini olish
  const [user, setUser] = useState(() => {
    return localStorage.getItem('chat_user') || null
  })

  const handleLoginSuccess = (username) => {
    setUser(username)
    localStorage.setItem('chat_user', username) // Xotiraga saqlash
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('chat_user') // Xotiradan o'chirish
  }

  return (
    <div className="app-container">
      {user ? (
        <Chat user={user} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  )
}

export default App
