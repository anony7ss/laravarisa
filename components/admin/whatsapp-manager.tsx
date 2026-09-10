'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Cpu,
  Bell,
  Zap,
  ExternalLink,
  MessageCircle,
  UserCheck,
  Save,
  SendHorizontal,
  Sparkles,
  Mic,
  Volume2,
  MessageSquare,
  Terminal as TerminalIcon,
  Link2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { DisparosManager, type ClientWithActivity, type OutboxItem } from './disparos-manager';
import { WhatsAppChatSimulator } from './whatsapp-chat-simulator';
import { WhatsAppTerminal } from './whatsapp-terminal';
import { WhatsAppLinkGenerator } from './whatsapp-link-generator';

export interface WhatsAppSession {
  id: string;
  status: 'connected' | 'qr_ready' | 'connecting' | 'disconnected';
  qr_code?: string | null;
  phone_connected?: string | null;
  profile_name?: string | null;
  ai_mode?: string | null;
  ai_model?: string | null;
  ai_enabled?: boolean;
  reminders_active?: boolean;
  last_heartbeat?: string | null;
  action_requested?: string | null;
  lara_phone?: string | null;
  notify_lara_on_human_transfer?: boolean;
  notify_lara_on_new_booking?: boolean;
  audio_mode?: 'direct_request' | 'mirror' | 'always' | 'disabled' | null;
  audio_voice?: string | null;
  updated_at?: string | null;
}


export function WhatsAppManager({
  initialSession,
  role,
  clients = [],
  initialStats = { pending: 0, sent: 0, failed: 0 },
  initialRecent = [],
}: {
  initialSession: WhatsAppSession;
  role: string;
  clients?: ClientWithActivity[];
  initialStats?: { pending: number; sent: number; failed: number };
  initialRecent?: OutboxItem[];
}) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'chat' | 'terminal' | 'connection' | 'disparos' | 'links'>(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'disparos') return 'disparos';
    if (tab === 'terminal') return 'terminal';
    if (tab === 'connection') return 'connection';
    if (tab === 'links' || tab === 'link') return 'links';
    return 'chat';
  });
  const [session, setSession] = useState<WhatsAppSession>(initialSession);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  // Controle de ativação da IA
  const [aiEnabled, setAiEnabled] = useState(initialSession.ai_enabled !== false);
  const [togglingAi, setTogglingAi] = useState(false);

  // Controle de requisições em voo e debounce de cache
  const inFlightRef = useRef(false);
  const lastFetchRef = useRef(0);

  // Configurações de notificação pessoal da Lara & Modo Profissional
  const [laraPhone, setLaraPhone] = useState(initialSession.lara_phone || '');
  const [notifyLara, setNotifyLara] = useState(initialSession.notify_lara_on_human_transfer !== false);
  const [notifyLaraBooking, setNotifyLaraBooking] = useState(initialSession.notify_lara_on_new_booking !== false);
  const [savingLaraSettings, setSavingLaraSettings] = useState(false);
  const [laraFeedback, setLaraFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Configurações de respostas em áudio (TTS)
  const [audioMode, setAudioMode] = useState<'direct_request' | 'mirror' | 'always' | 'disabled'>(
    initialSession.audio_mode || 'direct_request'
  );
  const [audioVoice, setAudioVoice] = useState<string>(
    initialSession.audio_voice || 'pt-BR-FranciscaNeural'
  );
  const [savingAudioSettings, setSavingAudioSettings] = useState(false);
  const [audioFeedback, setAudioFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sincroniza estado de Lara, IA e Áudio se vier de polling / realtime
  useEffect(() => {
    if (session.lara_phone) setLaraPhone(session.lara_phone);
    if (session.notify_lara_on_human_transfer !== undefined) {
      setNotifyLara(session.notify_lara_on_human_transfer);
    }
    if (session.notify_lara_on_new_booking !== undefined) {
      setNotifyLaraBooking(session.notify_lara_on_new_booking);
    }
    if (session.ai_enabled !== undefined) {
      setAiEnabled(session.ai_enabled);
    }
    if (session.audio_mode) {
      setAudioMode(session.audio_mode as any);
    }
    if (session.audio_voice) {
      setAudioVoice(session.audio_voice);
    }
  }, [session.lara_phone, session.notify_lara_on_human_transfer, session.notify_lara_on_new_booking, session.ai_enabled, session.audio_mode, session.audio_voice]);

  const handleSelectAudioVoice = async (newVoice: string) => {
    if (role !== 'admin') return;
    setAudioVoice(newVoice);
    setSavingAudioSettings(true);
    setAudioFeedback(null);
    try {
      const res = await fetch('/api/admin/whatsapp/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          audio_voice: newVoice,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSession((prev) => ({ ...prev, audio_voice: newVoice }));
        const nomes: Record<string, string> = {
          'pt-BR-FranciscaNeural': 'Voz Francisca selecionada (calma, natural e acolhedora)',
          'pt-BR-ThalitaMultilingualNeural': 'Voz Thalita selecionada (jovem, moderna e dinâmica)',
        };
        setAudioFeedback({ type: 'success', text: nomes[newVoice] || 'Voz atualizada com sucesso!' });
      } else {
        setAudioFeedback({ type: 'error', text: data.error || 'Erro ao alterar voz.' });
      }
    } catch {
      setAudioFeedback({ type: 'error', text: 'Erro de conexão ao alterar a voz.' });
    } finally {
      setSavingAudioSettings(false);
    }
  };

  const handleSelectAudioMode = async (newMode: 'direct_request' | 'mirror' | 'always' | 'disabled') => {
    if (role !== 'admin') return;
    setAudioMode(newMode);
    setSavingAudioSettings(true);
    setAudioFeedback(null);
    try {
      const res = await fetch('/api/admin/whatsapp/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          audio_mode: newMode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSession((prev) => ({ ...prev, audio_mode: newMode }));
        const labels: Record<string, string> = {
          direct_request: 'Modo Pedido Direto ativado! A IA responderá em áudio quando a cliente pedir.',
          mirror: 'Modo Espelho ativado! Áudio com áudio e texto com texto.',
          always: 'Modo Sempre em Áudio ativado! Todas as respostas serão notas de voz.',
          disabled: 'Modo Apenas Texto ativado. Notas de voz desativadas.',
        };
        setAudioFeedback({ type: 'success', text: labels[newMode] || 'Modo de áudio atualizado com sucesso!' });
      } else {
        setAudioFeedback({ type: 'error', text: data.error || 'Não foi possível alterar o modo de áudio.' });
      }
    } catch {
      setAudioFeedback({ type: 'error', text: 'Erro de conexão ao salvar modo de áudio.' });
    } finally {
      setSavingAudioSettings(false);
    }
  };



  const handleToggleAi = async (nextState: boolean) => {
    if (role !== 'admin') return;
    setTogglingAi(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/whatsapp/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          ai_enabled: nextState,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAiEnabled(nextState);
        setSession((prev) => ({ ...prev, ai_enabled: nextState }));
        setActionMessage({
          type: 'success',
          text: nextState
            ? 'IA do WhatsApp ATIVADA! O bot responderá clientes normalmente.'
            : 'IA do WhatsApp PAUSADA! Você pode responder clientes no celular sem a IA interferir.',
        });
      } else {
        setActionMessage({
          type: 'error',
          text: data.error || 'Não foi possível alterar o status da IA.',
        });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Erro de conexão ao alterar status da IA.' });
    } finally {
      setTogglingAi(false);
    }
  };

  const handleSaveLaraSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLaraSettings(true);
    setLaraFeedback(null);
    try {
      const res = await fetch('/api/admin/whatsapp/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_settings',
          lara_phone: laraPhone,
          notify_lara_on_human_transfer: notifyLara,
          notify_lara_on_new_booking: notifyLaraBooking,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setLaraFeedback({ type: 'success', text: 'Configuração salva! O bot notificará este WhatsApp pessoal.' });
        if (data.session) {
          setSession((prev) => ({ ...prev, ...data.session }));
        }
      } else {
        setLaraFeedback({ type: 'error', text: data.error || 'Não foi possível salvar a configuração.' });
      }
    } catch {
      setLaraFeedback({ type: 'error', text: 'Erro de comunicação ao salvar.' });
    } finally {
      setSavingLaraSettings(false);
    }
  };

  // Gera Data URL do QR code quando houver string de QR
  useEffect(() => {
    let active = true;
    if (session.status === 'qr_ready' && session.qr_code) {
      QRCode.toDataURL(session.qr_code, {
        width: 280,
        margin: 2,
        color: {
          dark: '#11110f',
          light: '#ffffff',
        },
      })
        .then((url) => {
          if (active) setQrDataUrl(url);
        })
        .catch(() => {
          if (active) setQrDataUrl(null);
        });
    } else {
      setQrDataUrl(null);
    }
    return () => {
      active = false;
    };
  }, [session.status, session.qr_code]);

  // Busca dados mais recentes via endpoint de API com debounce e controle de concorrência
  const fetchLatestSession = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 5000) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    lastFetchRef.current = now;

    try {
      const res = await fetch('/api/admin/whatsapp/action');
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setSession((prev) => ({ ...prev, ...data }));
        }
      }
    } catch {
      // Silencioso
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // Atualiza pela API protegida; nenhum segredo ou canal direto de dados
  // chega ao bundle do navegador.
  useEffect(() => {
    // Quando conectado, 30s é suficiente; aguardando QR, verifica a cada 10s.
    const pollTime = session.status === 'connected' ? 30000 : 10000;

    const interval = setInterval(() => {
      // Não consulta se a aba estiver em segundo plano / minimizada
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchLatestSession();
    }, pollTime);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchLatestSession(true);
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchLatestSession, session.status]);

  // Ação de desconectar ou atualizar QR
  async function handleAction(action: 'disconnect' | 'refresh') {
    if (role !== 'admin') return;
    setLoadingAction(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/admin/whatsapp/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao executar ação.');
      }

      setActionMessage({
        type: 'success',
        text:
          action === 'disconnect'
            ? 'Comando de desconexão enviado. Um novo QR Code será gerado para conexão.'
            : 'Solicitação de atualização enviada com sucesso.',
      });

      setShowConfirmDisconnect(false);
      setTimeout(() => fetchLatestSession(true), 1200);
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Erro ao processar solicitação.',
      });
    } finally {
      setLoadingAction(false);
    }
  }

  function formatPhone(phone?: string | null) {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    if (clean.length === 13 && clean.startsWith('55')) {
      return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    return phone;
  }

  // Verifica se o bot está emitindo heartbeat recente (menos de 45 segundos)
  const isHeartbeatAlive = Boolean(
    session.last_heartbeat &&
    Date.now() - new Date(session.last_heartbeat).getTime() < 45000
  );

  // Status efetivo considerando a comunicação real do bot
  const effectiveStatus: 'connected' | 'qr_ready' | 'connecting' | 'disconnected' =
    !isHeartbeatAlive
      ? 'disconnected'
      : session.status === 'connected' && session.phone_connected
      ? 'connected'
      : session.status === 'qr_ready' && session.qr_code
      ? 'qr_ready'
      : session.status === 'connecting'
      ? 'connecting'
      : 'disconnected';

  const statusConfig = {
    connected: {
      label: 'Conectado',
      color: '#16a34a',
      bg: 'rgba(22, 163, 74, 0.1)',
      border: 'rgba(22, 163, 74, 0.25)',
    },
    qr_ready: {
      label: 'Aguardando Leitura QR',
      color: '#ca8a04',
      bg: 'rgba(202, 138, 4, 0.1)',
      border: 'rgba(202, 138, 4, 0.25)',
    },
    connecting: {
      label: 'Conectando...',
      color: '#2563eb',
      bg: 'rgba(37, 99, 235, 0.1)',
      border: 'rgba(37, 99, 235, 0.25)',
    },
    disconnected: {
      label: 'Bot Desconectado / Offline',
      color: '#dc2626',
      bg: 'rgba(220, 38, 38, 0.1)',
      border: 'rgba(220, 38, 38, 0.25)',
    },
  }[effectiveStatus];

  return (
    <div className="wa-container">
      {/* Estilos responsivos dedicados */}
      <style>{`
        .wa-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          padding-bottom: calc(100px + env(safe-area-inset-bottom));
        .wa-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          width: 100%;
        }
        .wa-header-actions {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          flex-wrap: nowrap;
        }
        @media (max-width: 860px) {
          .wa-hero-card {
            grid-column: span 1 !important;
          }
          .wa-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .wa-header {
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
          }
          .wa-header-actions {
            display: inline-flex !important;
            align-items: center !important;
            gap: 10px !important;
            width: auto !important;
          }
        }
        @media (max-width: 640px) {
          .wa-container {
            gap: 16px !important;
            padding-bottom: calc(110px + env(safe-area-inset-bottom)) !important;
          }
          .wa-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .wa-header-actions {
            display: flex !important;
            width: 100% !important;
            justify-content: flex-start !important;
            gap: 10px !important;
          }
        }
        @media (max-width: 480px) {
          .wa-card-body {
            padding: 24px 16px !important;
            border-radius: 18px !important;
          }
          .wa-instructions {
            padding: 12px 14px !important;
            font-size: 12px !important;
          }
          .wa-qr-img {
            width: min(220px, 70vw) !important;
          }
          .wa-btn-mobile-full {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>

      {/* Título da Página com Badge de Status */}
      <div className="admin-page-title wa-header">
        <div>
          <p className="admin-kicker">AUTOMAÇÃO & ATENDIMENTO</p>
          <h1 style={{ margin: 0 }}>WhatsApp Bot</h1>
        </div>

        <div className="wa-header-actions">
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0 14px',
              height: '38px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              background: statusConfig.bg,
              border: `1px solid ${statusConfig.border}`,
              color: statusConfig.color,
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: statusConfig.color,
                flexShrink: 0,
              }}
            />
            {statusConfig.label}
          </span>

          <button
            type="button"
            onClick={() => fetchLatestSession(true)}
            disabled={loadingAction}
            className="admin-secondary"
            style={{
              height: '38px',
              minHeight: '38px',
              padding: '0 16px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxSizing: 'border-box',
              borderRadius: '999px',
              flexShrink: 0,
              margin: 0,
            }}
            title="Atualizar status"
          >
            <RefreshCw size={13} className={loadingAction ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO POR ABAS PADRONIZADA: CHAT, TERMINAL, CONEXÃO, DISPAROS, LINKS */}
      <div className="admin-nav-tabs" onWheel={handleTabsWheel} style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`admin-nav-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
        >
          <MessageSquare size={15} />
          <span>Chat ao Vivo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('terminal')}
          className={`admin-nav-tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
        >
          <TerminalIcon size={15} />
          <span>Terminal & Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('connection')}
          className={`admin-nav-tab-btn ${activeTab === 'connection' ? 'active' : ''}`}
        >
          <Smartphone size={15} />
          <span>Conexão & Voz</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('disparos')}
          className={`admin-nav-tab-btn ${activeTab === 'disparos' ? 'active' : ''}`}
        >
          <SendHorizontal size={15} />
          <span>Campanhas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('links')}
          className={`admin-nav-tab-btn ${activeTab === 'links' ? 'active' : ''}`}
        >
          <Link2 size={15} />
          <span>Gerador de Link</span>
        </button>
      </div>

      {activeTab === 'chat' && (
        <WhatsAppChatSimulator session={session} role={role} />
      )}

      {activeTab === 'terminal' && (
        <WhatsAppTerminal session={session} />
      )}

      {activeTab === 'disparos' && (
        <DisparosManager
          clients={clients}
          initialStats={initialStats}
          initialRecent={initialRecent}
          role={role}
        />
      )}

      {activeTab === 'links' && (
        <WhatsAppLinkGenerator
          defaultPhone={session.phone_connected || session.lara_phone || ''}
        />
      )}

      {activeTab === 'connection' && (
        <>
          {/* Alerta de feedback */}
          {actionMessage && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '16px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: actionMessage.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${actionMessage.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: actionMessage.type === 'success' ? '#15803d' : '#b91c1c',
              }}
            >
              {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* Grid Principal */}
          <div className="wa-grid">
        {/* PAINEL 1: STATUS & CONEXÃO (QR CODE / CONECTADO / OFFLINE) */}
        <section className="admin-panel wa-hero-card">
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#25d366', display: 'flex' }}>
                <MessageCircle size={22} />
              </span>
              <div>
                <p className="admin-kicker">CONEXÃO EM TEMPO REAL</p>
                <h2 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '18px', fontWeight: 600, margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>
                  Terminal de Conexão WhatsApp
                </h2>
              </div>
            </div>
          </div>

          {/* ESTADO 1: CONECTADO */}
          {effectiveStatus === 'connected' ? (
            <div
              className="wa-card-body"
              style={{
                background: 'rgba(34, 197, 94, 0.05)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '20px',
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#16a34a',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <CheckCircle2 size={34} />
              </div>

              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--admin-ink)', margin: '0 0 6px', fontFamily: 'var(--font-body), sans-serif' }}>
                  WhatsApp Conectado com Sucesso!
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--admin-muted)', margin: '0 0 14px', maxWidth: '460px', lineHeight: 1.5 }}>
                  O bot de atendimento está operando e pronto para receber mensagens, tirar dúvidas e enviar lembretes.
                </p>

                {session.phone_connected && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 18px',
                      borderRadius: '999px',
                      background: 'var(--admin-card)',
                      border: '1px solid var(--admin-line)',
                      fontWeight: 600,
                      fontSize: '13px',
                      color: 'var(--admin-ink)',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      wordBreak: 'break-all',
                    }}
                  >
                    <span>📱</span>
                    <span>{formatPhone(session.phone_connected)}</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '8px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                {showConfirmDisconnect ? (
                  <div
                    style={{
                      padding: '16px 20px',
                      borderRadius: '16px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      width: '100%',
                      maxWidth: '360px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <p style={{ fontSize: '12px', color: '#b91c1c', margin: 0, lineHeight: 1.4 }}>
                      Deseja desconectar o WhatsApp? Um novo QR Code será gerado para conexão.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="admin-primary"
                        style={{ background: '#dc2626', color: '#fff', minHeight: '36px', padding: '0 16px', fontSize: '12px' }}
                        onClick={() => handleAction('disconnect')}
                        disabled={loadingAction}
                      >
                        Sim, Desconectar
                      </button>
                      <button
                        type="button"
                        className="admin-secondary"
                        style={{ minHeight: '36px', padding: '0 14px', fontSize: '12px' }}
                        onClick={() => setShowConfirmDisconnect(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="admin-secondary admin-danger wa-btn-mobile-full"
                    style={{ fontSize: '13px' }}
                    onClick={() => setShowConfirmDisconnect(true)}
                  >
                    <LogOut size={14} />
                    Desconectar WhatsApp
                  </button>
                )}
              </div>
            </div>
          ) : effectiveStatus === 'qr_ready' && qrDataUrl ? (
            /* ESTADO 2: QR CODE PRONTO PARA LEITURA */
            <div
              className="wa-card-body"
              style={{
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-line)',
                borderRadius: '20px',
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '20px',
              }}
            >
              <div className="wa-qr-box">
                <img
                  src={qrDataUrl}
                  alt="QR Code WhatsApp"
                  className="wa-qr-img"
                />
              </div>

              <div style={{ maxWidth: '440px', width: '100%' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--admin-ink)', margin: '0 0 12px', fontFamily: 'var(--font-body), sans-serif' }}>
                  Escaneie o QR Code com o WhatsApp
                </h3>
                <ol className="wa-instructions">
                  <li>1. Abra o <b>WhatsApp</b> no seu smartphone</li>
                  <li>2. Toque em <b>Mais opções</b> (Android) ou <b>Configurações</b> (iPhone)</li>
                  <li>3. Selecione <b>Aparelhos conectados</b></li>
                  <li>4. Toque em <b>Conectar um aparelho</b> e aponte a câmera</li>
                </ol>
              </div>

              <button
                type="button"
                className="admin-secondary wa-btn-mobile-full"
                onClick={() => handleAction('refresh')}
                disabled={loadingAction}
                style={{ minHeight: '38px', padding: '0 18px', fontSize: '12px' }}
              >
                <RefreshCw size={13} className={loadingAction ? 'animate-spin' : ''} />
                Gerar Novo QR Code
              </button>
            </div>
          ) : effectiveStatus === 'connecting' ? (
            /* ESTADO 3: CONECTANDO */
            <div
              className="wa-card-body"
              style={{
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-line)',
                borderRadius: '20px',
                padding: '36px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(37, 99, 235, 0.1)',
                  color: '#2563eb',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <RefreshCw size={26} className="animate-spin" />
              </div>

              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--admin-ink)', margin: '0 0 6px', fontFamily: 'var(--font-body), sans-serif' }}>
                  Iniciando Conexão WhatsApp...
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--admin-muted)', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
                  O bot está estabelecendo comunicação com os servidores. O QR Code aparecerá aqui em instantes.
                </p>
              </div>

              <button
                type="button"
                className="admin-secondary wa-btn-mobile-full"
                onClick={() => fetchLatestSession(true)}
                disabled={loadingAction}
                style={{ minHeight: '36px', padding: '0 16px', fontSize: '12px' }}
              >
                <RefreshCw size={13} className={loadingAction ? 'animate-spin' : ''} />
                Atualizar Status
              </button>
            </div>
          ) : (
            /* ESTADO 4: DESCONECTADO / OFFLINE */
            <div
              className="wa-card-body"
              style={{
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-line)',
                borderRadius: '20px',
                padding: '36px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <AlertCircle size={28} />
              </div>

              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--admin-ink)', margin: '0 0 6px', fontFamily: 'var(--font-body), sans-serif' }}>
                  Bot WhatsApp Não Conectado
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--admin-muted)', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
                  O bot não está conectado no momento. No terminal do seu bot, certifique-se de que o processo está em execução para gerar o QR Code.
                </p>
              </div>

              <button
                type="button"
                className="admin-primary wa-btn-mobile-full"
                onClick={() => fetchLatestSession(true)}
                disabled={loadingAction}
                style={{ minHeight: '40px', padding: '0 20px', fontSize: '13px' }}
              >
                <RefreshCw size={14} className={loadingAction ? 'animate-spin' : ''} />
                Atualizar Status
              </button>
            </div>
          )}
        </section>

        {/* PAINEL 2: INTELIGÊNCIA & OPERAÇÕES */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--admin-orange)', display: 'flex' }}>
                <Cpu size={20} />
              </span>
              <div>
                <p className="admin-kicker">AUTOMAÇÕES DO ESTÚDIO</p>
                <h2 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '18px', fontWeight: 600, margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>
                  Painel de Atendimento
                </h2>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {/* Item 1: IA com Toggle de Ativação / Pausa */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: '16px',
                background: 'var(--admin-card)',
                border: '1px solid var(--admin-line)',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: aiEnabled ? 'rgba(34, 197, 94, 0.12)' : 'var(--admin-bg)',
                    color: aiEnabled ? '#16a34a' : 'var(--admin-muted)',
                    border: `1px solid ${aiEnabled ? 'rgba(34, 197, 94, 0.25)' : 'var(--admin-line)'}`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Cpu size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--admin-ink)' }}>
                      Atendimento Automático com IA
                    </p>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--admin-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
                    {aiEnabled
                      ? 'Respostas e agendamentos automáticos pelo WhatsApp ativos.'
                      : 'Pausado para atendimento manual no celular sem interferência da IA.'}
                  </p>
                </div>
              </div>

              {/* Status pill + Toggle Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: aiEnabled ? '#16a34a' : 'var(--admin-muted)',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: aiEnabled ? '#22c55e' : 'var(--admin-muted)',
                      boxShadow: aiEnabled ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
                    }}
                  />
                  {togglingAi ? 'Salvando...' : aiEnabled ? 'Ativa' : 'Pausada'}
                </span>

                {role === 'admin' && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aiEnabled}
                    onClick={() => handleToggleAi(!aiEnabled)}
                    disabled={togglingAi}
                    title={aiEnabled ? 'Clique para pausar o atendimento com IA' : 'Clique para ativar o atendimento com IA'}
                    style={{
                      position: 'relative',
                      width: '48px',
                      height: '26px',
                      borderRadius: '999px',
                      background: aiEnabled ? '#22c55e' : 'var(--admin-line)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                      opacity: togglingAi ? 0.6 : 1,
                    }}
                  >
                    <span
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.25)',
                        transform: aiEnabled ? 'translateX(22px)' : 'translateX(0px)',
                        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'block',
                      }}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Item: Motor de Atendimento (Modelo Real da IA) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '14px',
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-line)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px' }}>
                <Sparkles size={18} style={{ color: 'var(--admin-orange)', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--admin-ink)' }}>
                    Motor de Atendimento
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--admin-muted)', margin: 0 }}>
                    Modelo de Inteligência Artificial ativo no bot
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: '8px',
                    background: 'var(--admin-card)',
                    border: '1px solid var(--admin-line)',
                    color: 'var(--admin-ink)',
                  }}
                >
                  {session.ai_model || 'qwen3.8-flash'}
                </span>
                <span
                  className="admin-status confirmed"
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                  }}
                >
                  {session.ai_mode === 'opencode_go' ? 'OpenCode Go' : 'IA Operacional'}
                </span>
              </div>
            </div>

            {/* Item 2: Sincronização */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '14px',
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-line)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px' }}>
                <Zap size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--admin-ink)' }}>
                    Sincronização do Site
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--admin-muted)', margin: 0 }}>
                    Agendamentos web em tempo real
                  </p>
                </div>
              </div>
              <span
                className="admin-status"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  background: '#dbeafe',
                  color: '#1d4ed8',
                }}
              >
                Atualização automática
              </span>
            </div>

            {/* Item 3: Lembretes */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '14px',
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-line)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px' }}>
                <Bell size={18} style={{ color: '#ca8a04', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--admin-ink)' }}>
                    Lembretes Automáticos
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--admin-muted)', margin: 0 }}>
                    Disparos com 24h e 2h de antecedência
                  </p>
                </div>
              </div>
              <span
                className="admin-status confirmed"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                }}
              >
                24h / 2h antes
              </span>
            </div>
          </div>
        </section>

        {/* PAINEL: RESPOSTAS EM ÁUDIO (VOZ DA LARA) */}
        <section className="admin-panel wa-hero-card">
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--admin-orange)', display: 'flex' }}>
                <Mic size={20} />
              </span>
              <div>
                <p className="admin-kicker">SÍNTESE DE VOZ NEURAL (TTS)</p>
                <h2 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '18px', fontWeight: 600, margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>
                  Respostas em Áudio da Lara
                </h2>
              </div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(249, 115, 22, 0.1)',
                color: 'var(--admin-orange)',
                border: '1px solid rgba(249, 115, 22, 0.25)',
              }}
            >
              Voz: {audioVoice === 'pt-BR-ThalitaMultilingualNeural' ? 'Thalita (pt-BR)' : 'Francisca (pt-BR)'}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--admin-muted)', lineHeight: 1.6, margin: '0 0 16px' }}>
            Defina como a Lara deve responder às clientes no WhatsApp. O áudio é sintetizado em tempo real com voz neural brasileira de alta fidelidade e convertido para o formato nativo do WhatsApp (OGG Opus) para reprodução perfeita em qualquer celular.
          </p>

          {/* Seletor de Voz Neural Brasileira */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '14px',
              background: 'var(--admin-bg)',
              border: '1px solid var(--admin-line)',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Volume2 size={18} style={{ color: 'var(--admin-orange)', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--admin-ink)' }}>
                  Timbre da Voz Neural (pt-BR)
                </p>
                <p style={{ fontSize: '11px', color: 'var(--admin-muted)', margin: 0 }}>
                  Escolha o estilo de locução feminina da Lara
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleSelectAudioVoice('pt-BR-FranciscaNeural')}
                disabled={savingAudioSettings}
                className={audioVoice === 'pt-BR-FranciscaNeural' ? 'admin-primary' : 'admin-secondary'}
                style={{
                  fontSize: '12px',
                  padding: '6px 14px',
                  minHeight: '32px',
                  borderRadius: '999px',
                  fontWeight: audioVoice === 'pt-BR-FranciscaNeural' ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                Francisca (Calma & Acolhedora)
              </button>

              <button
                type="button"
                onClick={() => handleSelectAudioVoice('pt-BR-ThalitaMultilingualNeural')}
                disabled={savingAudioSettings}
                className={audioVoice === 'pt-BR-ThalitaMultilingualNeural' ? 'admin-primary' : 'admin-secondary'}
                style={{
                  fontSize: '12px',
                  padding: '6px 14px',
                  minHeight: '32px',
                  borderRadius: '999px',
                  fontWeight: audioVoice === 'pt-BR-ThalitaMultilingualNeural' ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                Thalita (Jovem & Espontânea)
              </button>
            </div>
          </div>


          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* Opção 1: Pedido Direto (Padrão) */}
            <button
              type="button"
              onClick={() => handleSelectAudioMode('direct_request')}
              disabled={savingAudioSettings}
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: audioMode === 'direct_request' ? '2px solid var(--admin-orange)' : '1px solid var(--admin-line)',
                background: audioMode === 'direct_request' ? 'rgba(249, 115, 22, 0.05)' : 'var(--admin-card)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🎙️</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-ink)' }}>
                    Pedido Direto
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: audioMode === 'direct_request' ? 'var(--admin-orange)' : 'var(--admin-bg)',
                    color: audioMode === 'direct_request' ? '#fff' : 'var(--admin-muted)',
                  }}
                >
                  Padrão
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--admin-muted)', margin: 0, lineHeight: 1.5 }}>
                Responde por texto. Se a cliente disser <i>&ldquo;manda um áudio&rdquo;</i>, <i>&ldquo;me explica por áudio&rdquo;</i> ou <i>&ldquo;prefiro áudio&rdquo;</i>, a Lara grava e envia áudio na hora.
              </p>
              {audioMode === 'direct_request' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--admin-orange)', fontWeight: 600, marginTop: '4px' }}>
                  <CheckCircle2 size={13} />
                  <span>Modo Ativo</span>
                </div>
              )}
            </button>

            {/* Opção 2: Modo Espelho */}
            <button
              type="button"
              onClick={() => handleSelectAudioMode('mirror')}
              disabled={savingAudioSettings}
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: audioMode === 'mirror' ? '2px solid var(--admin-orange)' : '1px solid var(--admin-line)',
                background: audioMode === 'mirror' ? 'rgba(249, 115, 22, 0.05)' : 'var(--admin-card)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔄</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-ink)' }}>
                    Modo Espelho
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'var(--admin-bg)',
                    color: 'var(--admin-muted)',
                  }}
                >
                  Flexível
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--admin-muted)', margin: 0, lineHeight: 1.5 }}>
                Se a cliente mandar áudio, a Lara responde com áudio. Se ela mandar texto, responde em texto (a não ser que ela peça áudio).
              </p>
              {audioMode === 'mirror' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--admin-orange)', fontWeight: 600, marginTop: '4px' }}>
                  <CheckCircle2 size={13} />
                  <span>Modo Ativo</span>
                </div>
              )}
            </button>

            {/* Opção 3: Sempre em Áudio */}
            <button
              type="button"
              onClick={() => handleSelectAudioMode('always')}
              disabled={savingAudioSettings}
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: audioMode === 'always' ? '2px solid var(--admin-orange)' : '1px solid var(--admin-line)',
                background: audioMode === 'always' ? 'rgba(249, 115, 22, 0.05)' : 'var(--admin-card)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔊</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-ink)' }}>
                    Sempre em Áudio
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'var(--admin-bg)',
                    color: 'var(--admin-muted)',
                  }}
                >
                  Voz Total
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--admin-muted)', margin: 0, lineHeight: 1.5 }}>
                Todas as mensagens da Lara serão enviadas como notas de voz gravadas, com envio complementar de links clicáveis quando necessário.
              </p>
              {audioMode === 'always' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--admin-orange)', fontWeight: 600, marginTop: '4px' }}>
                  <CheckCircle2 size={13} />
                  <span>Modo Ativo</span>
                </div>
              )}
            </button>

            {/* Opção 4: Apenas Texto */}
            <button
              type="button"
              onClick={() => handleSelectAudioMode('disabled')}
              disabled={savingAudioSettings}
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: audioMode === 'disabled' ? '2px solid var(--admin-orange)' : '1px solid var(--admin-line)',
                background: audioMode === 'disabled' ? 'rgba(249, 115, 22, 0.05)' : 'var(--admin-card)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>💬</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-ink)' }}>
                    Apenas Texto
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'var(--admin-bg)',
                    color: 'var(--admin-muted)',
                  }}
                >
                  Sem Áudio
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--admin-muted)', margin: 0, lineHeight: 1.5 }}>
                Desativa notas de voz. Todas as respostas serão enviadas exclusivamente por mensagem de texto convencional.
              </p>
              {audioMode === 'disabled' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--admin-orange)', fontWeight: 600, marginTop: '4px' }}>
                  <CheckCircle2 size={13} />
                  <span>Modo Ativo</span>
                </div>
              )}
            </button>
          </div>

          {savingAudioSettings && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--admin-muted)', marginBottom: '10px' }}>
              <RefreshCw size={13} className="animate-spin" />
              <span>Salvando configuração de áudio no bot...</span>
            </div>
          )}

          {audioFeedback && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: audioFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: audioFeedback.type === 'success' ? '#15803d' : '#b91c1c',
                border: `1px solid ${audioFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              }}
            >
              {audioFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{audioFeedback.text}</span>
            </div>
          )}
        </section>

        {/* PAINEL 3: ATALHO PARA CONFIGURAÇÕES DE MENSAGENS */}
        <section className="admin-panel">

          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--admin-orange)', display: 'flex' }}>
                <ExternalLink size={20} />
              </span>
              <div>
                <p className="admin-kicker">PERSONALIZAÇÃO</p>
                <h2 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '18px', fontWeight: 600, margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>
                  Modelos de Mensagens
                </h2>
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--admin-muted)', lineHeight: 1.5, margin: '0 0 16px' }}>
            Os textos das mensagens de confirmação e templates de lembretes automáticos podem ser customizados com tags dinâmicas como <code>{'{nome}'}</code>, <code>{'{procedimento}'}</code> e <code>{'{horario}'}</code>.
          </p>

          <a
            href="/admin/dashboard/configuracoes"
            className="admin-secondary wa-btn-mobile-full"
            style={{
              display: 'inline-flex',
              justifyContent: 'center',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 500,
              boxSizing: 'border-box',
            }}
          >
            Acessar Configurações de Mensagens
            <ExternalLink size={14} />
          </a>
        </section>

        {/* PAINEL 4: NOTIFICAÇÕES PARA A LARA (WHATSAPP PESSOAL) */}
        <section className="admin-panel wa-hero-card">
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--admin-orange)', display: 'flex' }}>
                <Smartphone size={20} />
              </span>
              <div>
                <p className="admin-kicker">ATENDIMENTO HUMANO & TRANSBORDO</p>
                <h2 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '18px', fontWeight: 600, margin: 0, textTransform: 'none', letterSpacing: 'normal' }}>
                  WhatsApp Pessoal da Lara
                </h2>
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--admin-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
            Configure o seu número de WhatsApp pessoal. Sempre que uma cliente solicitar atendimento humano, pedir para falar com você ou tiver dúvidas fora do escopo automático, o bot enviará uma notificação instantânea para o seu número com o contato e o recado da cliente.
          </p>

          <form onSubmit={handleSaveLaraSettings} style={{ display: 'grid', gap: '16px', maxWidth: '540px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)', marginBottom: '6px' }}>
                Seu Número de WhatsApp Pessoal (com DDD):
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={laraPhone}
                  onChange={(e) => setLaraPhone(e.target.value)}
                  placeholder="Ex: DDD + número ou (11) 99999-9999"
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--admin-line)',
                    background: 'var(--admin-bg)',
                    color: 'var(--admin-ink)',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--admin-muted)', margin: '4px 0 0' }}>
                Recomendado: DDD + 9 dígitos (ex: <code>51989601662</code>).
              </p>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={notifyLaraBooking}
                  onChange={(e) => setNotifyLaraBooking(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--admin-orange)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--admin-ink)', fontWeight: 500 }}>
                  Receber notificação no WhatsApp pessoal a cada <strong>novo agendamento</strong> (Site e WhatsApp)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={notifyLara}
                  onChange={(e) => setNotifyLara(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--admin-orange)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--admin-ink)', fontWeight: 500 }}>
                  Receber alerta quando pedirem para falar com atendente / Lara (transbordo humano)
                </span>
              </label>
            </div>

            {/* Destaque do Modo Profissional */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.06), rgba(249, 115, 22, 0.02))',
                border: '1px solid rgba(234, 88, 12, 0.2)',
                borderRadius: '16px',
                padding: '16px',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>✨</span>
                <strong style={{ fontSize: '13px', color: 'var(--admin-ink)' }}>Modo Profissional Ativado no WhatsApp</strong>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#15803d',
                  }}
                >
                  Assistente Ativa
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--admin-muted)', margin: 0, lineHeight: 1.5 }}>
                Ao enviar mensagens deste número para o WhatsApp do estúdio, a IA vira sua <strong>assistente operacional</strong>. Você pode conversar naturalmente para gerenciar o dia a dia:
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '8px',
                  fontSize: '11.5px',
                  color: 'var(--admin-ink)',
                }}
              >
                <div style={{ padding: '8px 10px', background: 'var(--admin-bg)', borderRadius: '8px', border: '1px solid var(--admin-line)' }}>
                  🗓️ <em>"Quem tenho hoje?"</em> ou <em>"Agenda de amanhã"</em>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--admin-bg)', borderRadius: '8px', border: '1px solid var(--admin-line)' }}>
                  ✂️ <em>"Cancela o da Juliana"</em> ou <em>"Remarca Maria p/ sexta às 15h"</em>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--admin-bg)', borderRadius: '8px', border: '1px solid var(--admin-line)' }}>
                  🔒 <em>"Bloqueia amanhã às 18h"</em> ou <em>"Intervalo de almoço"</em>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--admin-bg)', borderRadius: '8px', border: '1px solid var(--admin-line)' }}>
                  💰 <em>"Quanto vou faturar essa semana?"</em> ou <em>"Clientes inativas"</em>
                </div>
              </div>
            </div>

            {laraFeedback && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: laraFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                  color: laraFeedback.type === 'success' ? '#15803d' : '#b91c1c',
                  border: `1px solid ${laraFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                }}
              >
                {laraFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{laraFeedback.text}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                className="admin-primary wa-btn-mobile-full"
                disabled={savingLaraSettings}
                style={{ minHeight: '40px', padding: '0 22px', fontSize: '13px' }}
              >
                {savingLaraSettings ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Salvar Configurações da Lara
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )}
</div>
  );
}
