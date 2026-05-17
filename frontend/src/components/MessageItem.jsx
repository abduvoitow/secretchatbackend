import React, { useState, useEffect, useRef } from 'react'
import { Check, CheckCheck, Reply, Pencil, Trash2, Copy, X } from 'lucide-react'

const getUserDisplayName = (username) => {
  if (username === 'D') return 'Doniyor';
  if (username === 'K') return 'Kamola';
  return username;
};

const MessageItem = ({ message, isMine, onEdit, onDelete, onReply, onReplyClick, showMenu, onOpenMenu, onCloseMenu }) => {
  const [showAbove, setShowAbove] = useState(false)
  const menuRef = useRef(null)
  const bubbleRef = useRef(null)
  const longPressTimer = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onCloseMenu()
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu, onCloseMenu])

  const handleOpenMenu = (e) => {
    if (e) e.preventDefault();
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      // If there is less than 160px of space below the bubble, render above it
      setShowAbove(spaceBelow < 160);
    }
    onOpenMenu();
  }

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      handleOpenMenu();
      if (navigator.vibrate) navigator.vibrate(50)
    }, 500)
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  return (
    <div 
      id={`msg-${message.id}`}
      className={`tg-message-row ${isMine ? 'mine' : 'theirs'}`}
      onContextMenu={handleOpenMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div ref={bubbleRef} className={`tg-message-bubble ${isMine ? 'mine' : 'theirs'} ${message.image_url ? 'has-image' : ''}`}>
        
        {message.reply_to && (
          <div 
            className="tg-reply-preview-bubble"
            onClick={() => onReplyClick(message.reply_to.id)}
          >
            <div className="tg-reply-sender">{getUserDisplayName(message.reply_to.sender)}</div>
            <div className="tg-reply-content">{message.reply_to.content}</div>
          </div>
        )}

        {/* Rasm ko'rsatish */}
        {message.image_url && (
          <div className="tg-message-image-container">
            <img src={message.image_url} alt="Uploaded content" className="tg-message-image" />
          </div>
        )}

        <div className="tg-message-content">
          {message.content !== '[Rasm]' && message.content}
          <div className="tg-message-meta">
            {message.is_edited && <span className="tg-edited">tahrirlangan</span>}
            <span className="tg-time">{message.timestamp}</span>
            {isMine && (
              <span className="tg-status">
                {message.is_read ? <CheckCheck size={14} /> : <Check size={14} />}
              </span>
            )}
          </div>
        </div>

        {showMenu && (
          <div className={`tg-context-menu ${showAbove ? 'above' : 'below'}`} ref={menuRef}>
            <div 
              className="tg-menu-item" 
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              onClick={() => { onReply(message); onCloseMenu(); }}
            >
              <Reply size={18} /> Javob berish
            </div>

            {isMine && (
              <>
                {!message.image_url && (
                  <div 
                    className="tg-menu-item" 
                    onMouseDown={(e) => e.preventDefault()}
                    onTouchStart={(e) => e.preventDefault()}
                    onClick={() => { onEdit(message); onCloseMenu(); }}
                  >
                    <Pencil size={18} /> Tahrirlash
                  </div>
                )}
                <div 
                  className="tg-menu-item delete" 
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={() => { onDelete(message.id); onCloseMenu(); }}
                >
                  <Trash2 size={18} /> O'chirish
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .tg-message-row { display: flex; width: 100%; margin-bottom: 4px; position: relative; transition: background 0.3s; padding: 2px 0; }
        .tg-message-row.mine { justify-content: flex-end; }
        .tg-message-row.theirs { justify-content: flex-start; }
        .tg-message-row.highlight { background: rgba(82, 136, 193, 0.2); }

        .tg-message-bubble { 
          max-width: 85%; 
          padding: 6px 10px; 
          border-radius: 12px; 
          position: relative; 
          font-size: 15.5px; 
          line-height: 1.4;
          box-shadow: 0 1px 1px rgba(0,0,0,0.2);
          display: inline-block;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        }
        .tg-message-bubble.has-image { padding: 4px; }
        .tg-message-bubble.mine { background: var(--msg-bubble-mine-bg); color: var(--msg-bubble-mine-text); border-bottom-right-radius: 4px; }
        .tg-message-bubble.theirs { background: var(--msg-bubble-theirs-bg); color: var(--msg-bubble-theirs-text); border-bottom-left-radius: 4px; }

        .tg-message-image-container { margin-bottom: 4px; border-radius: 8px; overflow: hidden; max-width: 100%; }
        .tg-message-image { display: block; max-width: 100%; max-height: 300px; object-fit: cover; }

        .tg-reply-preview-bubble {
          background: rgba(120, 120, 120, 0.1);
          border-left: 3px solid #5288c1;
          padding: 4px 8px;
          margin-bottom: 4px;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
        }
        .tg-reply-sender { color: #5288c1; font-weight: 500; margin-bottom: 2px; }
        .tg-reply-content { color: var(--reply-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .tg-message-content { 
          display: block;
          word-break: break-word; 
          min-width: 60px;
          position: relative;
        }
        
        .tg-message-meta { 
          float: right;
          margin-top: 8px;
          margin-left: 8px;
          display: flex; 
          align-items: center; 
          gap: 3px; 
          font-size: 11px; 
          color: var(--meta-text);
          line-height: 1;
          position: relative;
          bottom: -2px;
          user-select: none;
        }
        .tg-edited {
          font-size: 9px;
          opacity: 0.65;
          font-style: italic;
          margin-right: 1px;
          user-select: none;
        }

        .tg-context-menu { position: absolute; background: var(--dropdown-bg); border-radius: 10px; padding: 5px 0; min-width: 160px; box-shadow: 0 4px 15px rgba(0,0,0,0.12); z-index: 1000; border: 1px solid var(--header-border); }
        .tg-context-menu.below { top: 100%; margin-top: 4px; }
        .tg-context-menu.above { bottom: 100%; margin-bottom: 4px; }
        .mine .tg-context-menu { right: 0; }
        .theirs .tg-context-menu { left: 0; }
        .tg-menu-item { padding: 10px 15px; display: flex; align-items: center; gap: 12px; font-size: 14px; color: var(--dropdown-text); cursor: pointer; }
        .tg-menu-item.delete { color: #ec3942; }
      `}} />
    </div>
  )
}

export default MessageItem
