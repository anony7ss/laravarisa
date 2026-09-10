'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Trash2,
  Search,
  RefreshCw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { WhatsAppSession } from './whatsapp-manager';

export interface WhatsAppLogItem {
  id: string;
  level: string;
  tag: string;
  message: string;
  details?: any;
  created_at: string;
}

export function WhatsAppTerminal({ session }: { session: WhatsAppSession }) {
  const [logs, setLogs] = useState<WhatsAppLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carrega logs (com opção silenciosa para polling contínuo)
  const fetchLogs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/admin/whatsapp/logs');
      const data = await res.json();
      if (data.logs) {
        const fetched = [...data.logs].reverse();
        setLogs((prev) => {
          if (prev.length === 0) return fetched;
          const existingIds = new Set(prev.map((l) => l.id));
          const newItems = fetched.filter((l) => !existingIds.has(l.id));
          if (newItems.length === 0) return prev;
          return [...prev, ...newItems].slice(-300);
        });
      }
    } catch {
      // Silencioso
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(false);

    // Polling frequente mantém o terminal atualizado sem acesso direto ao banco.
    const pollTimer = setInterval(() => {
      fetchLogs(true);
    }, 3500);

    return () => clearInterval(pollTimer);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Limpar logs
  const handleClearLogs = async () => {
    if (!confirm('Deseja limpar os registros do console?')) return;
    setClearing(true);
    try {
      await fetch('/api/admin/whatsapp/logs', { method: 'DELETE' });
      setLogs([]);
    } catch {
      // Silencioso
    } finally {
      setClearing(false);
    }
  };

  // Copiar logs
  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${formatTime(l.created_at)}] [${l.tag}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtragem
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterLevel === 'chat') {
        if (log.level !== 'incoming' && log.level !== 'outgoing') return false;
      } else if (filterLevel === 'booking') {
        if (log.level !== 'booking') return false;
      } else if (filterLevel === 'action') {
        if (log.level !== 'action') return false;
      } else if (filterLevel === 'reminder') {
        if (log.level !== 'reminder') return false;
      } else if (filterLevel === 'error') {
        if (log.level !== 'error' && log.level !== 'warn') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.tag?.toLowerCase().includes(q) ||
          log.message?.toLowerCase().includes(q) ||
          log.level?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [logs, filterLevel, searchQuery]);

  function formatTime(isoStr?: string) {
    if (!isoStr) return '--:--:--';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '--:--:--';
    }
  }

  const isConnected = session.status === 'connected';
  const aiModel = session.ai_model || 'qwen3.8-flash';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 99999 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100dvh' : 'auto',
        background: isFullscreen ? '#0c0c0e' : 'transparent',
        padding: isFullscreen ? '16px' : 0,
        boxSizing: 'border-box',
        overflowY: isFullscreen ? 'hidden' : 'visible',
      }}
      className={`wa-terminal-container ${isFullscreen ? 'wa-terminal-fullscreen' : ''}`}
    >
      <style>{`
        .wa-terminal-container.wa-terminal-fullscreen {
          position: fixed !important;
          inset: 0 !important;
          z-index: 99999 !important;
          width: 100vw !important;
          height: 100dvh !important;
          background: #0c0c0e !important;
          padding: 16px !important;
          box-sizing: border-box !important;
        }
        .wa-terminal-container.wa-terminal-fullscreen .wa-terminal-window {
          flex: 1 !important;
          height: calc(100dvh - 190px) !important;
          max-height: calc(100dvh - 190px) !important;
        }
        @media (max-width: 768px) {
          .wa-terminal-window:not(.wa-terminal-fullscreen *) {
            height: calc(100dvh - 260px) !important;
            min-height: 380px !important;
            font-size: 11.5px !important;
            padding: 12px 14px !important;
          }
          .wa-terminal-log-row {
            flex-wrap: wrap !important;
            gap: 4px 8px !important;
            padding: 4px 0 !important;
          }
        }
      `}</style>

      {/* 1. Header de Status Clean e Elegante */}
      <div
        style={{
          background: 'var(--admin-card, #181815)',
          borderRadius: '16px',
          border: '1px solid var(--admin-line, #2a2a26)',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '14px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--admin-line, #2a2a26)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isConnected ? '#22c55e' : '#f59e0b',
              }}
            />
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--admin-ink, #f7f7f2)' }}>
              Studio Lara Varisa · WhatsApp Bot
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 9px',
                borderRadius: '999px',
                background: 'var(--admin-soft, #242420)',
                color: 'var(--admin-muted, #8b8b83)',
              }}
            >
              Tempo Real Ativo
            </span>
          </div>
        </div>

        {/* Indicadores em formato de pills minimalistas */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '12px',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--admin-soft, #242420)',
              color: 'var(--admin-ink, #f7f7f2)',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--admin-muted, #8b8b83)' }}>WhatsApp:</span>
            <span style={{ fontWeight: 500, color: isConnected ? '#16a34a' : '#d97706' }}>
              {isConnected ? (session.phone_connected ? `+${session.phone_connected}` : 'Conectado') : 'Desconectado'}
            </span>
          </div>

          <div
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--admin-soft, #242420)',
              color: 'var(--admin-ink, #f7f7f2)',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--admin-muted, #8b8b83)' }}>Motor IA:</span>
            <span style={{ fontWeight: 500 }}>
              {session.ai_enabled === false ? 'Pausada' : aiModel}
            </span>
          </div>

          <div
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--admin-soft, #242420)',
              color: 'var(--admin-ink, #f7f7f2)',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--admin-muted, #8b8b83)' }}>Lembretes:</span>
            <span style={{ fontWeight: 500 }}>Ativos (24h e 2h)</span>
          </div>

          <div
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--admin-soft, #242420)',
              color: 'var(--admin-ink, #f7f7f2)',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--admin-muted, #8b8b83)' }}>Local:</span>
            <span style={{ fontWeight: 500 }}>Porto Alegre - RS</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros e Busca */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          background: 'var(--admin-card, #181815)',
          padding: '10px 16px',
          borderRadius: '14px',
          border: '1px solid var(--admin-line, #2a2a26)',
        }}
      >
        {/* Abas simples */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'chat', label: 'Conversas' },
            { id: 'booking', label: 'Agendamentos' },
            { id: 'action', label: 'Ações IA' },
            { id: 'reminder', label: 'Lembretes' },
            { id: 'error', label: 'Avisos' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterLevel(tab.id)}
              style={{
                fontSize: '11.5px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: filterLevel === tab.id ? 'var(--admin-soft, #242420)' : 'transparent',
                color: filterLevel === tab.id ? 'var(--admin-ink, #f7f7f2)' : 'var(--admin-muted, #8b8b83)',
                fontWeight: filterLevel === tab.id ? 600 : 500,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ferramentas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--admin-soft, #242420)',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--admin-line, #2a2a26)',
            }}
          >
            <Search size={13} style={{ color: 'var(--admin-muted, #8b8b83)' }} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '11.5px',
                color: 'var(--admin-ink, #f7f7f2)',
                width: '100px',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--admin-line, #2a2a26)',
              background: autoScroll ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
              color: autoScroll ? '#16a34a' : 'var(--admin-muted, #8b8b83)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
            }}
          >
            {autoScroll ? <Pause size={12} /> : <Play size={12} />}
            <span>Scroll</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLogs}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--admin-line, #2a2a26)',
              background: 'transparent',
              color: copied ? '#16a34a' : 'var(--admin-muted, #8b8b83)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearLogs}
            disabled={clearing}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--admin-line, #2a2a26)',
              background: 'transparent',
              color: 'var(--admin-muted, #8b8b83)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
            }}
          >
            <Trash2 size={12} />
            <span>Limpar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Sair da tela cheia' : 'Abrir terminal em tela cheia'}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--admin-line, #2a2a26)',
              background: isFullscreen ? 'var(--admin-orange, #c58f59)' : 'transparent',
              color: isFullscreen ? '#ffffff' : 'var(--admin-ink, #f7f7f2)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
            }}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span>{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
          </button>
        </div>
      </div>

      {/* 3. Janela de Logs Clean e Legível */}
      <div
        ref={scrollRef}
        className="wa-terminal-window"
        style={{
          background: '#0e0e10',
          borderRadius: '16px',
          border: '1px solid var(--admin-line, #2a2a26)',
          padding: '16px 20px',
          height: '480px',
          overflowY: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          fontSize: '12.5px',
          lineHeight: '1.65',
          color: '#e2e8f0',
        }}
      >
        {loading && logs.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
            <RefreshCw size={13} className="animate-spin" />
            <span>Carregando console...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ color: '#64748b', fontStyle: 'italic', padding: '16px 0' }}>
            Nenhum registro encontrado. Aguardando atividade do WhatsApp...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredLogs.map((log) => {
              const time = formatTime(log.created_at);

              // Cores sutis e minimalistas (sem arco-íris agressivo)
              let tagColor = '#94a3b8';
              let msgColor = '#cbd5e1';

              if (log.level === 'incoming') {
                tagColor = '#7dd3fc';
                msgColor = '#f8fafc';
              } else if (log.level === 'outgoing') {
                tagColor = '#f472b6';
                msgColor = '#fce7f3';
              } else if (log.level === 'booking') {
                tagColor = '#34d399';
                msgColor = '#a7f3d0';
              } else if (log.level === 'action') {
                tagColor = '#c084fc';
                msgColor = '#e9d5ff';
              } else if (log.level === 'reminder') {
                tagColor = '#fbbf24';
                msgColor = '#fef3c7';
              } else if (log.level === 'warn' || log.level === 'error') {
                tagColor = '#f87171';
                msgColor = '#fca5a5';
              }

              return (
                <div
                  key={log.id}
                  className="wa-terminal-log-row"
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    wordBreak: 'break-word',
                    padding: '2px 0',
                  }}
                >
                  <span style={{ color: '#475569', fontSize: '11px', userSelect: 'none', minWidth: '60px' }}>
                    {time}
                  </span>

                  <span style={{ color: tagColor, fontWeight: 600, minWidth: '80px' }}>
                    [{log.tag}]
                  </span>

                  <span style={{ color: msgColor }}>
                    {log.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
