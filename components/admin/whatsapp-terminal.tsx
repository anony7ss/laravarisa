'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  Pause,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Cpu,
  Radio,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/client';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carrega logs iniciais
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/whatsapp/logs');
      const data = await res.json();
      if (data.logs) {
        // Inverte para ter a ordem cronológica no terminal (antigo -> novo)
        setLogs([...data.logs].reverse());
      }
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Escuta novos logs em tempo real via Supabase Realtime
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel('whatsapp_terminal_live_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_logs',
        },
        (payload) => {
          const newLog = payload.new as WhatsAppLogItem;
          if (newLog) {
            setLogs((prev) => [...prev.slice(-250), newLog]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll para a linha mais recente
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Limpar logs
  const handleClearLogs = async () => {
    if (!confirm('Deseja limpar o histórico do console?')) return;
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

  // Copiar logs para o clipboard
  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${formatTime(l.created_at)}] [${l.level.toUpperCase()}] [${l.tag}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtragem dos logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filtro de nível/categoria
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

      // Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTag = log.tag?.toLowerCase().includes(q);
        const matchesMsg = log.message?.toLowerCase().includes(q);
        const matchesLvl = log.level?.toLowerCase().includes(q);
        return matchesTag || matchesMsg || matchesLvl;
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
  const aiModeText = session.ai_enabled === false
    ? 'Pausada pelo Admin'
    : (isConnected ? `Conectada (${aiModel})` : 'Aguardando WhatsApp');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Banner de Status do Terminal (Idêntico ao banner executável do Bot) */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(26, 17, 23, 0.95) 0%, rgba(15, 12, 17, 0.98) 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(226, 137, 168, 0.25)',
          padding: '22px 26px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          color: '#f8fafc',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '240px',
            height: '240px',
            background: 'radial-gradient(circle, rgba(226, 137, 168, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Top Header do Terminal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(226, 137, 168, 0.2)',
            paddingBottom: '14px',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isConnected ? '#22c55e' : '#eab308',
                boxShadow: isConnected ? '0 0 12px #22c55e' : '0 0 12px #eab308',
              }}
            />
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '15px',
                letterSpacing: '1px',
                color: '#f5c6d6',
                textTransform: 'uppercase',
              }}
            >
              LARA LASH & SOBRANCELHAS | WhatsApp Bot VIP
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontFamily: 'monospace',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              <Radio size={12} className="animate-pulse" />
              REALTIME LIVE STREAM
            </span>
          </div>
        </div>

        {/* Linhas de status estilo console */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={15} style={{ color: '#94a3b8' }} />
            <span style={{ color: '#94a3b8' }}>Local:</span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>Porto Alegre - RS</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: isConnected ? '#4ade80' : '#eab308', fontWeight: 700 }}>
              {isConnected ? '[OK]' : '[..]'}
            </span>
            <span style={{ color: '#94a3b8' }}>WhatsApp:</span>
            <span style={{ color: isConnected ? '#4ade80' : '#fde047', fontWeight: 600 }}>
              {isConnected ? `Conectado (${session.phone_connected || 'Studio'})` : 'Desconectado'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>[OK]</span>
            <span style={{ color: '#94a3b8' }}>Supabase:</span>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>Conectado (Realtime)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>[OK]</span>
            <span style={{ color: '#94a3b8' }}>Lembretes:</span>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>Ativo (24h e 2h antes)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}>
            <Cpu size={15} style={{ color: '#38bdf8' }} />
            <span style={{ color: '#94a3b8' }}>Motor IA:</span>
            <span style={{ color: session.ai_enabled === false ? '#f87171' : '#38bdf8', fontWeight: 600 }}>
              {aiModeText}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Ferramentas e Filtros do Console */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--admin-card)',
          padding: '12px 18px',
          borderRadius: '16px',
          border: '1px solid var(--admin-line)',
        }}
      >
        {/* Filtros em abas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'chat', label: 'Conversas (>> / <<)' },
            { id: 'booking', label: 'Agendamentos (+)' },
            { id: 'action', label: 'Ações IA ([>])' },
            { id: 'reminder', label: 'Lembretes (*)' },
            { id: 'error', label: 'Erros & Avisos' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterLevel(tab.id)}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: filterLevel === tab.id ? 'var(--admin-primary)' : 'rgba(0,0,0,0.05)',
                color: filterLevel === tab.id ? '#ffffff' : 'var(--admin-muted)',
                fontWeight: filterLevel === tab.id ? 600 : 500,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Busca e Ações */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--admin-subtle)',
              padding: '6px 12px',
              borderRadius: '10px',
              border: '1px solid var(--admin-line)',
            }}
          >
            <Search size={14} style={{ color: 'var(--admin-muted)' }} />
            <input
              type="text"
              placeholder="Filtrar logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '12px',
                color: 'var(--admin-text)',
                width: '130px',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Pausar auto-scroll' : 'Ativar auto-scroll'}
            style={{
              padding: '7px 10px',
              borderRadius: '10px',
              border: '1px solid var(--admin-line)',
              background: autoScroll ? 'rgba(34, 197, 94, 0.1)' : 'var(--admin-subtle)',
              color: autoScroll ? '#16a34a' : 'var(--admin-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
            }}
          >
            {autoScroll ? <Pause size={14} /> : <Play size={14} />}
            <span>Scroll</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLogs}
            title="Copiar logs visíveis"
            style={{
              padding: '7px 10px',
              borderRadius: '10px',
              border: '1px solid var(--admin-line)',
              background: 'var(--admin-subtle)',
              color: copied ? '#16a34a' : 'var(--admin-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearLogs}
            disabled={clearing}
            title="Limpar histórico"
            style={{
              padding: '7px 10px',
              borderRadius: '10px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#dc2626',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
            }}
          >
            <Trash2 size={14} />
            <span>Limpar</span>
          </button>
        </div>
      </div>

      {/* 3. Janela do Terminal Escura e Fluida */}
      <div
        ref={scrollRef}
        style={{
          background: '#0a090b',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.25)',
          padding: '20px 24px',
          height: '520px',
          overflowY: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '13px',
          lineHeight: '1.7',
          color: '#e2e8f0',
        }}
      >
        {loading && logs.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
            <RefreshCw size={14} className="animate-spin" />
            <span>Carregando console em tempo real...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ color: '#64748b', fontStyle: 'italic', padding: '20px 0' }}>
            Nenhum evento registrado com os filtros selecionados. Aguardando novas mensagens do WhatsApp...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredLogs.map((log) => {
              const time = formatTime(log.created_at);

              // Cores e símbolos idênticos ao terminal do Windows
              let levelColor = '#94a3b8';
              let badgeSymbol = '';
              let textColor = '#e2e8f0';

              if (log.level === 'success') {
                levelColor = '#4ade80';
                badgeSymbol = '[OK]';
              } else if (log.level === 'incoming') {
                levelColor = '#38bdf8';
                badgeSymbol = '>>';
                textColor = '#bae6fd';
              } else if (log.level === 'outgoing') {
                levelColor = '#f472b6';
                badgeSymbol = '<<';
                textColor = '#fbcfe8';
              } else if (log.level === 'booking') {
                levelColor = '#4ade80';
                badgeSymbol = '[+]';
                textColor = '#86efac';
              } else if (log.level === 'reminder') {
                levelColor = '#facc15';
                badgeSymbol = '[*]';
                textColor = '#fef08a';
              } else if (log.level === 'action') {
                levelColor = log.message.toLowerCase().includes('cancel') ? '#f87171' : '#c084fc';
                badgeSymbol = '[>]';
                textColor = log.message.toLowerCase().includes('cancel') ? '#fca5a5' : '#e9d5ff';
              } else if (log.level === 'warn') {
                levelColor = '#facc15';
                badgeSymbol = '[!]';
                textColor = '#fde047';
              } else if (log.level === 'error') {
                levelColor = '#ef4444';
                badgeSymbol = '[X]';
                textColor = '#fca5a5';
              }

              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '10px',
                    wordBreak: 'break-word',
                    padding: '2px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                  }}
                >
                  <span style={{ color: '#64748b', fontSize: '12px', userSelect: 'none', minWidth: '65px' }}>
                    [{time}]
                  </span>

                  <span style={{ color: levelColor, fontWeight: 700, minWidth: '24px' }}>
                    {badgeSymbol}
                  </span>

                  <span style={{ color: levelColor, fontWeight: 600 }}>
                    [{log.tag}]
                  </span>

                  <span style={{ color: textColor }}>
                    {log.level === 'incoming' || log.level === 'outgoing' ? `"${log.message}"` : log.message}
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
