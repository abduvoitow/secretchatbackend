import React, { useState } from 'react'
import axios from 'axios'

const Login = ({ onLoginSuccess }) => {
  const [meetingId, setMeetingId] = useState('')
  const [noAudio, setNoAudio] = useState(false)
  const [noVideo, setNoVideo] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!meetingId.trim()) return

    // iOS klaviatura uchrashuvini yopish (scroll xatoligini to'g'irlash)
    try {
      document.querySelectorAll('input').forEach(el => el.blur())
    } catch (_) {}

    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/api/login/', { code: meetingId })
      if (res.data.success) {
        onLoginSuccess(res.data.user)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Konferensiya ID noto\'g\'ri kiritildi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="zoom-login-wrapper">
      <div className="zoom-login-container">
        
        {/* Zoom Logo */}
        <div className="zoom-logo-area">
          <svg className="zoom-logo-svg" viewBox="0 0 160 40" width="130" height="32" xmlns="http://www.w3.org/2000/svg">
            <g fill="#2D8CFF">
              <rect x="0" y="0" width="40" height="40" rx="10" />
              <path d="M12 15a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V15z" fill="#FFF"/>
              <polygon points="25,20 31,16 31,24" fill="#FFF"/>
              <text x="50" y="29" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-weight="800" font-size="28" fill="#2D8CFF" letter-spacing="-1px">zoom</text>
            </g>
          </svg>
        </div>

        {/* Zoom Card */}
        <div className="zoom-card">
          <h1 className="zoom-title">Konferensiyaga qo'shilish</h1>
          
          <form onSubmit={handleSubmit} className="zoom-form">
            
            {/* Meeting ID Input */}
            <div className="zoom-input-group">
              <input
                type="text"
                className="zoom-input"
                placeholder="Konferensiya ID raqami"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                autoComplete="off"
                required
              />
            </div>

            {/* Error Message */}
            {error && <div className="zoom-error-box">{error}</div>}

            {/* Checkboxes */}
            <div className="zoom-checkboxes">

              <label className="zoom-checkbox-label">
                <input
                  type="checkbox"
                  checked={noAudio}
                  onChange={(e) => setNoAudio(e.target.checked)}
                />
                <span className="zoom-checkbox-text">Audioni ulamaslik</span>
              </label>

              <label className="zoom-checkbox-label">
                <input
                  type="checkbox"
                  checked={noVideo}
                  onChange={(e) => setNoVideo(e.target.checked)}
                />
                <span className="zoom-checkbox-text">Videoni o'chirish</span>
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className={`zoom-submit-btn ${meetingId.trim() ? 'active' : ''} ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? 'Ulanmoqda...' : "Qo'shilish"}
            </button>
          </form>

          {/* Terms Text */}
          <p className="zoom-terms-text">
            "Qo'shilish" tugmasini bosish orqali siz bizning <a href="#" onClick={(e) => e.preventDefault()}>Xizmat ko'rsatish shartlarimiz</a> va <a href="#" onClick={(e) => e.preventDefault()}>Maxfiylik bayonotimizga</a> rozilik bildirasiz.
          </p>
        </div>

        {/* Footer Link */}
        <div className="zoom-extra-links">
          <a href="#" className="zoom-test-link" onClick={(e) => e.preventDefault()}>Sinov konferensiyasiga qo'shilish</a>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .zoom-login-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f7f9fa;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          overflow: hidden;
          padding: 20px;
          box-sizing: border-box;
          z-index: 9999;
        }

        .zoom-login-container {
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .zoom-logo-area {
          margin-bottom: 25px;
          user-select: none;
        }

        .zoom-card {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 40px 32px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          box-sizing: border-box;
        }

        .zoom-title {
          font-size: 22px;
          font-weight: 600;
          color: #131619;
          text-align: center;
          margin: 0 0 28px 0;
          letter-spacing: -0.3px;
        }

        .zoom-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .zoom-input-group {
          width: 100%;
        }

        .zoom-input {
          width: 100%;
          background: #ffffff;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 16px;
          color: #131619;
          outline: none;
          box-sizing: border-box;
          transition: all 0.15s ease-in-out;
        }

        .zoom-input::placeholder {
          color: #7f91a4;
          font-size: 14px;
        }

        .zoom-input:focus {
          border-color: #2d8cff;
          box-shadow: 0 0 0 3px rgba(45, 140, 255, 0.15);
        }

        .zoom-error-box {
          color: #d93025;
          background-color: #feeedc;
          border: 1px solid #fad2cf;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 13px;
          text-align: left;
          line-height: 1.4;
        }

        .zoom-checkboxes {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 6px;
        }

        .zoom-checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          cursor: pointer;
          user-select: none;
        }

        .zoom-checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          margin-top: 1px;
          cursor: pointer;
          accent-color: #2d8cff;
        }

        .zoom-checkbox-text {
          font-size: 13.5px;
          color: #64748b;
          line-height: 1.3;
        }

        .zoom-submit-btn {
          width: 100%;
          background-color: #e2e8f0;
          color: #94a3b8;
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: not-allowed;
          transition: all 0.2s ease-in-out;
          margin-top: 10px;
        }

        .zoom-submit-btn.active {
          background-color: #2d8cff;
          color: #ffffff;
          cursor: pointer;
        }

        .zoom-submit-btn.active:hover {
          background-color: #0b5cff;
        }

        .zoom-submit-btn.loading {
          background-color: #2d8cff;
          color: #ffffff;
          opacity: 0.8;
          cursor: not-allowed;
        }

        .zoom-terms-text {
          font-size: 11px;
          color: #64748b;
          text-align: center;
          line-height: 1.5;
          margin: 24px 0 0 0;
        }

        .zoom-terms-text a {
          color: #2d8cff;
          text-decoration: none;
        }

        .zoom-terms-text a:hover {
          text-decoration: underline;
        }

        .zoom-extra-links {
          margin-top: 24px;
        }

        .zoom-test-link {
          font-size: 13.5px;
          color: #2d8cff;
          text-decoration: none;
          font-weight: 500;
        }

        .zoom-test-link:hover {
          text-decoration: underline;
        }

        /* Mobile adaptation */
        @media (max-width: 480px) {
          .zoom-card {
            padding: 30px 20px;
          }
        }
      `}} />
    </div>
  )
}

export default Login
