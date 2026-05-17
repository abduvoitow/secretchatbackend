import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Send, Paperclip, Smile, MoreVertical, ArrowLeft, X, Reply, Trash2, Sun, Moon } from 'lucide-react'
import MessageItem from './MessageItem'

const EMOJIS = ['❤️', '😂', '😍', '👍', '🔥', '😊', '🙏', '😭', '🥰', '😘', '🙄', '🤔', '😎', '😜', '🤩', '🥳', '🥺', '😡', '😱', '🤫', '🥱', '😴', '🤤', '🤮', '🤑', '🤝', '🙌', '👏', '✨', '🎈', '🎉', '🎁', '🌹', '💔', '💯', '✅', '❌', '⚠️', '🔊', '🎵']

const formatLastSeen = (isoString) => {
  if (!isoString) return "yaqinda bo'lgan";
  
  // Eski HH:MM formatidagi fallbackni tekshirish
  if (/^\d{2}:\d{2}$/.test(isoString)) {
    return `bugun soat ${isoString} da bo'lgan`;
  }

  try {
    const lastSeenDate = new Date(isoString);
    
    // Noto'g'ri sanalarni ushlab qolish (NaN bo'lib ketmasligi uchun)
    if (isNaN(lastSeenDate.getTime())) {
      const timeMatch = isoString.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        return `bugun soat ${timeMatch[1]}:${timeMatch[2]} da bo'lgan`;
      }
      return "yaqinda bo'lgan";
    }

    const now = new Date();
    const diffSeconds = Math.max(0, Math.floor((now - lastSeenDate) / 1000));
    
    if (diffSeconds < 60) {
      return "yaqinda bo'lgan";
    }
    
    if (diffSeconds < 3600) {
      const diffMinutes = Math.floor(diffSeconds / 60);
      return `${diffMinutes} daqiqa oldin bo'lgan`;
    }
    
    const hours = String(lastSeenDate.getHours()).padStart(2, '0');
    const minutes = String(lastSeenDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const compareDate = new Date(lastSeenDate.getFullYear(), lastSeenDate.getMonth(), lastSeenDate.getDate());
    
    if (compareDate.getTime() === today.getTime()) {
      return `bugun soat ${timeStr} da bo'lgan`;
    } else if (compareDate.getTime() === yesterday.getTime()) {
      return `kecha soat ${timeStr} da bo'lgan`;
    } else {
      const day = String(lastSeenDate.getDate()).padStart(2, '0');
      const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
      const monthStr = months[lastSeenDate.getMonth()];
      return `${day}-${monthStr} soat ${timeStr} da bo'lgan`;
    }
  } catch (e) {
    return "yaqinda bo'lgan";
  }
};

const getUserDisplayName = (username) => {
  if (username === 'D') return 'Doniyor';
  if (username === 'K') return 'Kamola';
  return username;
};

const Chat = ({ user, onLogout }) => {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [editingMessage, setEditingMessage] = useState(null)
  const [replyingMessage, setReplyingMessage] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [lastSeen, setLastSeen] = useState({})
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [tick, setTick] = useState(0)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('chat_theme') !== 'light'
  })

  const toggleTheme = () => {
    const nextTheme = !isDarkMode
    setIsDarkMode(nextTheme)
    localStorage.setItem('chat_theme', nextTheme ? 'dark' : 'light')
    setShowHeaderMenu(false)
  }
  
  const scrollRef = useRef(null)
  const socketRef = useRef(null)
  const chatRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const headerMenuRef = useRef(null)
  const emojiPickerRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const isExplicitlyHiddenRef = useRef(false)

  const markAsRead = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && document.visibilityState === 'visible') {
      socketRef.current.send(JSON.stringify({ type: 'read_receipt', sender: user }))
    }
  }



  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // iOS Safari scroll-up bugini to'g'irlash
    const resetScroll = () => {
      window.scrollTo(0, 0)
      if (document.body) document.body.scrollTop = 0
      if (document.documentElement) document.documentElement.scrollTop = 0
    }
    resetScroll()
    setTimeout(resetScroll, 100)
    setTimeout(resetScroll, 300)

    const handleClickOutside = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setShowHeaderMenu(false)
      }
      
      const emojiBtn = document.querySelector('.emoji-toggle-btn')
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target) && (!emojiBtn || !emojiBtn.contains(e.target))) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    
    // Har 10 soniyada o'tgan vaqtni qayta hisoblab ekranni yangilash (tick)
    const timer = setInterval(() => {
      setTick(t => t + 1)
    }, 10000)

    // Har 15 soniyada onlayn/oflayn holatlarini orqa fonda jimgina yangilash (Silent status sync)
    const fetchStatusSilently = async () => {
      try {
        const res = await axios.get('/api/get-new-messages/')
        setOnlineUsers(res.data.online_users || [])
        setLastSeen(res.data.last_seen || {})
      } catch (err) {
        console.error('Silent status fetch error', err)
      }
    }
    const statusTimer = setInterval(fetchStatusSilently, 15000)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      clearInterval(timer)
      clearInterval(statusTimer)
    }
  }, [])

  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'ping', username: user }))
      }
    }, 8000)
    
    return () => {
      clearInterval(pingInterval)
    }
  }, [user])

  useEffect(() => {
    const fetchInitialMessages = async () => {
      try {
        const res = await axios.get('/api/get-new-messages/')
        setMessages(res.data.messages)
        setOnlineUsers(res.data.online_users || [])
        setLastSeen(res.data.last_seen || {})
        setTimeout(() => { scrollToBottom(); markAsRead(); }, 300)
      } catch (err) {
        console.error('Initial fetch error', err)
        if (err.response && err.response.status === 401) {
          onLogout()
        }
      }
    }
    fetchInitialMessages()

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socketUrl = `${protocol}//${window.location.host}/ws/chat/`
    const sendStatusUpdate = (isOnline) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'status_change', username: user, is_online: isOnline }))
      }
    }

    const connect = () => {
      if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
        return
      }
      const socket = new WebSocket(socketUrl)
      socketRef.current = socket
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'user_join', username: user }))
        socket.send(JSON.stringify({ type: 'status_change', username: user, is_online: true }))
        if (document.visibilityState === 'visible') {
          socket.send(JSON.stringify({ type: 'read_receipt', sender: user }))
        }
      }
      socket.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.type === 'message') {
          setMessages(prev => {
            if (prev.some(m => String(m.id) === String(data.message_id))) return prev
            return [...prev, { id: data.message_id, sender: data.sender, content: data.message, timestamp: data.timestamp, is_read: data.is_read, is_edited: false, reply_to: data.reply_to, image_url: data.image_url }]
          })
          if (data.sender !== user && document.visibilityState === 'visible') {
            socket.send(JSON.stringify({ type: 'read_receipt', sender: user }))
          }
        } else if (data.type === 'typing') {
          if (data.username !== user) setIsOtherTyping(data.is_typing)
        } else if (data.type === 'message_edited') {
          setMessages(prev => prev.map(m => String(m.id) === String(data.message_id) ? { ...m, content: data.message, timestamp: data.timestamp, is_edited: true } : m))
        } else if (data.type === 'message_deleted') {
          setMessages(prev => prev.filter(m => String(m.id) !== String(data.message_id)))
        } else if (data.type === 'messages_cleared') {
          setMessages([])
        } else if (data.type === 'read_update') {
          setMessages(prev => prev.map(m => m.sender !== data.reader ? { ...m, is_read: true } : m))
        } else if (data.type === 'user_status') {
          setOnlineUsers(data.online_users)
          setLastSeen(data.last_seen || {})
        }
      }
      socket.onclose = () => {
        if (!isExplicitlyHiddenRef.current) {
          setTimeout(connect, 3000)
        }
      }
    }
    connect()

    const handleVisibilityChange = () => {
      const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (document.visibilityState === 'hidden') {
        sendStatusUpdate(false)
        if (isMobile) {
          isExplicitlyHiddenRef.current = true
          if (socketRef.current) {
            socketRef.current.close()
          }
        }
      } else if (document.visibilityState === 'visible') {
        if (isMobile && isExplicitlyHiddenRef.current) {
          isExplicitlyHiddenRef.current = false
          connect()
        } else {
          sendStatusUpdate(true)
          markAsRead()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const handleUnload = () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('unload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('unload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [user])

  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport && chatRef.current) {
        const vv = window.visualViewport
        chatRef.current.style.height = `${vv.height}px`
        window.scrollTo(0, 0)
        scrollToBottom()
      }
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange)
      window.visualViewport.addEventListener('scroll', handleViewportChange)
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange)
        window.visualViewport.removeEventListener('scroll', handleViewportChange)
      }
    }
  }, [])

  useEffect(() => scrollToBottom(), [messages])

  const scrollToBottom = () => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }

  const scrollToMessage = (msgId) => {
    const element = document.getElementById(`msg-${msgId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('highlight')
      setTimeout(() => element.classList.remove('highlight'), 2000)
    }
  }

  const sendTypingStatus = (is_typing) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'typing', username: user, is_typing }))
    }
  }

  const handleInput = (e) => {
    const text = e.currentTarget.innerText
    setInputText(text)
    sendTypingStatus(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => sendTypingStatus(false), 2000)
  }

  const handleSendMessage = () => {
    const text = inputRef.current ? inputRef.current.innerText.trim() : ''
    if (!text) return

    if (editingMessage) {
      socketRef.current.send(JSON.stringify({ type: 'edit_message', message_id: editingMessage.id, message: text }))
      setEditingMessage(null)
    } else {
      socketRef.current.send(JSON.stringify({ type: 'message', sender: user, message: text, reply_to_id: replyingMessage?.id }))
    }
    if (inputRef.current) inputRef.current.innerText = ''
    setInputText(''); setReplyingMessage(null); setShowEmojiPicker(false); sendTypingStatus(false); inputRef.current?.focus()
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await axios.post('/api/upload-image/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (res.data.success) {
        socketRef.current.send(JSON.stringify({ type: 'message', sender: user, message_id: res.data.message_id, image_url: res.data.image_url }))
      }
    } catch (err) {
      console.error('Image upload error', err)
      if (err.response && err.response.status === 401) {
        onLogout()
      }
    }
    e.target.value = ''
  }

  const handleClearChat = () => { socketRef.current.send(JSON.stringify({ type: 'clear_chat' })); setShowHeaderMenu(false) }

  const addEmoji = (emoji) => {
    if (inputRef.current) {
      inputRef.current.innerText += emoji; setInputText(inputRef.current.innerText); inputRef.current.focus()
      const range = document.createRange(); const sel = window.getSelection(); range.selectNodeContents(inputRef.current); range.collapse(false); sel.removeAllRanges(); sel.addRange(range)
    }
  }

  const otherUser = user === 'K' ? 'D' : 'K';
  const isOtherOnline = onlineUsers.includes(otherUser);
  const otherLastSeen = lastSeen[otherUser];

  return (
    <div className={`tg-chat-page ${isDarkMode ? 'dark' : 'light'}`} ref={chatRef}>
      <div className="tg-wallpaper"></div>
      <header className="tg-header">
        <div className="tg-header-content">
          <div className="tg-header-left">
            <div className="tg-back-btn" onClick={onLogout}><ArrowLeft size={24} /></div>
            <div className="tg-avatar">{otherUser[0]?.toUpperCase()}</div>
            <div className="tg-header-info">
              <h3>{getUserDisplayName(otherUser)}</h3>
              {isOtherTyping ? (
                <span className="online">yozmoqda...</span>
              ) : (
                <span className={isOtherOnline ? 'online' : 'offline'}>
                  {isOtherOnline ? 'onlayn' : formatLastSeen(otherLastSeen)}
                </span>
              )}
            </div>
          </div>
          <div className="tg-header-right" style={{ position: 'relative' }}>
            <div className="tg-icon-btn" onClick={() => setShowHeaderMenu(!showHeaderMenu)}><MoreVertical size={20} /></div>
            {showHeaderMenu && (
              <div className="tg-header-dropdown" ref={headerMenuRef}>
                <div className="tg-dropdown-item" onClick={toggleTheme}>
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                  {isDarkMode ? "Kunduzgi rejim" : "Tungi rejim"}
                </div>
                <div className="tg-dropdown-item delete" onClick={handleClearChat}>
                  <Trash2 size={18} /> Xabarlarni tozalash
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="tg-messages-container" ref={scrollRef} onScroll={() => { if (activeMenuId !== null) setActiveMenuId(null); }}>
        <div className="tg-messages-list-wrapper">
          <div className="tg-messages-list">
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} isMine={msg.sender === user}
                onEdit={() => { setEditingMessage(msg); if (inputRef.current) inputRef.current.innerText = msg.content; inputRef.current?.focus(); }}
                onDelete={() => socketRef.current.send(JSON.stringify({ type: 'delete_message', message_id: msg.id }))}
                onReply={(m) => { setReplyingMessage(m); setEditingMessage(null); inputRef.current?.focus(); }}
                onReplyClick={scrollToMessage}
                showMenu={activeMenuId === msg.id}
                onOpenMenu={() => setActiveMenuId(msg.id)}
                onCloseMenu={() => setActiveMenuId(null)}
              />
            ))}
          </div>
        </div>
      </main>

      <footer className="tg-input-area">
        {showEmojiPicker && (
          <div className="tg-emoji-picker" ref={emojiPickerRef}>
            <div className="tg-emoji-grid">
              {EMOJIS.map(emoji => (
                <div 
                  key={emoji} 
                  className="tg-emoji-item" 
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={() => addEmoji(emoji)}
                >{emoji}</div>
              ))}
            </div>
          </div>
        )}
        <div className="tg-input-content">
          <div className="tg-input-wrapper">
            {replyingMessage && (
              <div className="tg-reply-bar">
                <div className="tg-reply-icon"><Reply size={18} color="#5288c1" /></div>
                <div className="tg-reply-info">
                  <div className="tg-reply-user">{getUserDisplayName(replyingMessage.sender)}</div>
                  <div className="tg-reply-text">{replyingMessage.content}</div>
                </div>
                <div 
                  className="tg-reply-close" 
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={() => setReplyingMessage(null)}
                ><X size={18} /></div>
              </div>
            )}
            <div className="tg-input-row">
              <div 
                className="tg-icon-btn emoji-toggle-btn" 
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              ><Smile size={24} color={showEmojiPicker ? '#5288c1' : '#7f91a4'} /></div>
              <div
                ref={inputRef} className="tg-editable-input" contentEditable="true" role="textbox" aria-multiline="true" inputMode="text" placeholder="Xabar yozing..."
                onInput={handleInput}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                onFocus={() => { setTimeout(scrollToBottom, 100); markAsRead(); setShowEmojiPicker(false); }}
                onBlur={() => { setTimeout(() => { if (chatRef.current) { chatRef.current.style.height = '100dvh'; } window.scrollTo(0, 0) }, 100) }}
                spellCheck="false" autoCorrect="off" autoCapitalize="sentences"
              ></div>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />
              <div 
                className="tg-icon-btn" 
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              ><Paperclip size={24} /></div>
            </div>
          </div>
          <div 
            className={`tg-send-btn ${(inputText.trim() || (inputRef.current && inputRef.current.innerText.trim())) ? '' : 'disabled'}`} 
            onMouseDown={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
            onClick={handleSendMessage}
          ><Send size={22} color="white" /></div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .tg-chat-page {
          --bg-color: #0e1621;
          --header-bg: #17212b;
          --header-text: #ffffff;
          --header-sub: #7f91a4;
          --header-border: rgba(0,0,0,0.2);
          --input-bg: #17212b;
          --input-wrapper-bg: #17212b;
          --input-text: #ffffff;
          --input-placeholder: #7f91a4;
          --input-border: rgba(0,0,0,0.2);
          --dropdown-bg: #1c242d;
          --dropdown-item-hover: rgba(255,255,255,0.05);
          --dropdown-text: #ffffff;
          --emoji-picker-bg: #17212b;
          --emoji-item-hover: rgba(255,255,255,0.1);
          --reply-bar-bg: #17212b;
          --reply-bar-border: rgba(255,255,255,0.08);
          --reply-text-color: #7f91a4;
          --msg-bubble-theirs-bg: #182533;
          --msg-bubble-theirs-text: #ffffff;
          --msg-bubble-mine-bg: #2b5278;
          --msg-bubble-mine-text: #ffffff;
          --meta-text: rgba(255,255,255,0.5);
          --wallpaper-opacity: 0.08;
          --header-icon-color: #7f91a4;
          --send-icon-color: #ffffff;
        }

        .tg-chat-page.light {
          --bg-color: #cde0c9;
          --header-bg: #ffffff;
          --header-text: #1c242d;
          --header-sub: #707579;
          --header-border: #e2e8f0;
          --input-bg: #ffffff;
          --input-wrapper-bg: #ffffff;
          --input-text: #1c242d;
          --input-placeholder: #707579;
          --input-border: #e2e8f0;
          --dropdown-bg: #ffffff;
          --dropdown-item-hover: rgba(0,0,0,0.05);
          --dropdown-text: #1c242d;
          --emoji-picker-bg: #ffffff;
          --emoji-item-hover: rgba(0,0,0,0.05);
          --reply-bar-bg: #ffffff;
          --reply-bar-border: #e2e8f0;
          --reply-text-color: #707579;
          --msg-bubble-theirs-bg: #ffffff;
          --msg-bubble-theirs-text: #182533;
          --msg-bubble-mine-bg: #e2f7cb;
          --msg-bubble-mine-text: #182533;
          --meta-text: rgba(0,0,0,0.45);
          --wallpaper-opacity: 0.08;
          --header-icon-color: #707579;
          --send-icon-color: #ffffff;
        }

        .tg-chat-page { display: flex; flex-direction: column; background: var(--bg-color); color: var(--header-text); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; position: absolute; top: 0; left: 0; right: 0; bottom: 0; height: 100%; width: 100%; touch-action: none; transition: height 0.05s ease-out; }
        .tg-header { background: var(--header-bg); width: 100%; border-bottom: 1px solid var(--header-border); z-index: 200; flex-shrink: 0; position: relative; padding-top: env(safe-area-inset-top, 0px); }
        .tg-header-content { max-width: 800px; margin: 0 auto; padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; height: 56px; }
        .tg-header-left { display: flex; align-items: center; gap: 15px; }
        .tg-avatar { width: 40px; height: 40px; background: #5288c1; color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; }
        .tg-header-info h3 { font-size: 16px; margin: 0; font-weight: 500; color: var(--header-text); }
        .tg-header-info span { font-size: 13px; color: var(--header-sub); }
        .tg-header-info span.online { color: #40a7e3; }
        .tg-messages-container { flex: 1; overflow-y: auto; position: relative; -webkit-overflow-scrolling: touch; padding-bottom: 10px; z-index: 1; }
        .tg-wallpaper { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url('/background.svg'); background-repeat: no-repeat; background-position: center; background-size: cover; opacity: var(--wallpaper-opacity); pointer-events: none; z-index: 0; transition: filter 0.3s; }
        .tg-chat-page:not(.light) .tg-wallpaper { filter: invert(1) brightness(1.6); }
        .tg-messages-list-wrapper { max-width: 800px; margin: 0 auto; width: 100%; position: relative; z-index: 1; }
        .tg-messages-list { padding: 10px; display: flex; flex-direction: column; gap: 4px; }
        
        .tg-input-area { background: transparent; width: 100%; padding-bottom: calc(10px + env(safe-area-inset-bottom)); flex-shrink: 0; border-top: none; z-index: 200; position: relative; pointer-events: none; }
        .tg-input-area > * { pointer-events: auto; }

        .tg-header-dropdown { position: absolute; top: 100%; right: 0; background: var(--dropdown-bg); border-radius: 10px; padding: 5px 0; min-width: 180px; box-shadow: 0 4px 15px rgba(0,0,0,0.12); z-index: 1000; border: 1px solid var(--header-border); }
        .tg-dropdown-item { padding: 12px 15px; display: flex; align-items: center; gap: 12px; font-size: 14px; color: var(--dropdown-text); cursor: pointer; transition: background 0.2s; }
        .tg-dropdown-item:active { background: var(--dropdown-item-hover); }
        .tg-dropdown-item.delete { color: #ec3942; }

        .tg-emoji-picker { background: var(--emoji-picker-bg); border: 1px solid var(--reply-bar-border); border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.12); overflow-x: auto; overflow-y: hidden; padding: 10px; max-width: 780px; margin: 0 auto 8px auto; -webkit-overflow-scrolling: touch; }
        .tg-emoji-picker::-webkit-scrollbar { height: 4px; }
        .tg-emoji-picker::-webkit-scrollbar-thumb { background: rgba(120, 120, 120, 0.2); border-radius: 2px; }
        .tg-emoji-grid { display: flex; flex-direction: row; gap: 12px; width: max-content; }
        .tg-emoji-item { font-size: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 6px 12px; border-radius: 10px; transition: background 0.2s; flex-shrink: 0; }
        .tg-emoji-item:active { background: var(--emoji-item-hover); }
        
        .tg-reply-bar { display: flex; align-items: center; padding: 8px 12px; background: rgba(120, 120, 120, 0.05); border-bottom: 1px solid var(--reply-bar-border); gap: 10px; border-radius: 20px 20px 0 0; }
        .tg-reply-info { flex: 1; border-left: 2px solid #5288c1; padding-left: 10px; overflow: hidden; }
        .tg-reply-user { color: #5288c1; font-weight: 500; font-size: 14px; }
        .tg-reply-text { color: var(--reply-text-color); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tg-reply-close { color: var(--header-icon-color); cursor: pointer; }
        
        .tg-input-content { width: 100%; max-width: 800px; margin: 0 auto; padding: 6px 15px; display: flex; align-items: flex-end; gap: 8px; box-sizing: border-box; }
        
        .tg-input-wrapper { flex: 1; background: var(--input-wrapper-bg); border-radius: 22px; display: flex; flex-direction: column; align-items: stretch; padding: 2px 4px; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid var(--reply-bar-border); }
        .tg-input-row { display: flex; align-items: flex-end; width: 100%; }
 
        .tg-editable-input { flex: 1; background: none; border: none; color: var(--input-text); padding: 10px 5px; font-size: 16px; outline: none; max-height: 180px; overflow-y: auto; line-height: 1.3; min-width: 0; word-break: break-word; user-select: text; -webkit-user-select: text; }
        .tg-editable-input:empty:before { content: attr(placeholder); color: var(--input-placeholder); cursor: text; }
        .tg-icon-btn { color: var(--header-icon-color); padding: 8px; cursor: pointer; display: flex; flex-shrink: 0; }
        .tg-send-btn { width: 44px; height: 44px; background: #5288c1; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .tg-send-btn.disabled { opacity: 0.5; cursor: default; }
        @media (max-width: 800px) { .tg-header-content, .tg-messages-list-wrapper, .tg-input-content, .tg-emoji-picker, .tg-reply-bar { max-width: 100%; } }
      `}} />
    </div>
  )
}

export default Chat
