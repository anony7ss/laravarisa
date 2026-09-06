'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hasConsent = localStorage.getItem('cookie-consent');
    if (!hasConsent) {
      // Delay showing the banner slightly for better UX
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  const accept = () => {
    localStorage.setItem('cookie-consent', 'true');
    setShow(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: 'calc(100% - 48px)',
        maxWidth: '400px',
        zIndex: 50,
        background: '#fff',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0,0,0,0.05)',
        border: '1px solid rgba(0,0,0,0.05)',
        animation: 'fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111' }}>Privacidade e Cookies</h3>
        <button 
          onClick={accept}
          style={{ background: 'transparent', border: 0, color: '#888', cursor: 'pointer', padding: '4px', margin: '-4px' }}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>
      <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
        Utilizamos cookies para oferecer a melhor experiência. Ao continuar navegando, você concorda com o uso de cookies.
      </p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button 
          onClick={accept}
          style={{
            background: '#c73800',
            color: '#fff',
            border: 0,
            borderRadius: '99px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            flex: 1
          }}
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}
