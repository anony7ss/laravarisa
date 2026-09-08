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
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { DisparosManager, type ClientWithActivity, type OutboxItem } from './disparos-manager';

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
  const [activeTab, setActiveTab] = useState<'connection' | 'disparos'>(() => {
    return searchParams?.get('tab') === 'disparos' ? 'disparos' : 'connection';
  });
  const [session, setSession] = useState<WhatsAppSession>(initialSession);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  // Controle de ativação da IA
  const [aiEnabled, setAiEnabled] = useState(initialSession.ai_enabled !== false);
  const [togglingAi, setTogglingAi] = useState(false);

  // Controle de requisições em voo e debounce de cache
  const inFlightRef = useRef(false);
  const lastFetchRef = useRef(0);

  // Configurações de notificação pessoal da Lara
  const [laraPhone, setLaraPhone] = useState(initialSession.lara_phone || '5551989601662');
  const [notifyLara, setNotifyLara] = useState(initialSession.notify_lara_on_human_transfer !== false);
  const [savingLaraSettings, setSavingLaraSettings] = useState(false);
  const [laraFeedback, setLaraFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sincroniza estado de Lara e IA se vier de polling / realtime
  useEffect(() => {
    if (session.lara_phone) setLaraPhone(session.lara_phone);
    if (session.notify_lara_on_human_transfer !== undefined) {
      setNotifyLara(session.notify_lara_on_human_transfer);
    }
    if (session.ai_enabled !== undefined) {
      setAiEnabled(session.ai_enabled);
    }
  }, [session.lara_phone, session.notify_lara_on_human_transfer, session.ai_enabled]);

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

  // Escuta atualizações em tempo real via Supabase Realtime + Polling inteligente
  useEffect(() => {
    const supabase = createBrowserSupabase();
    let channel: any = null;

    if (supabase) {
      channel = supabase
        .channel('realtime_whatsapp_session')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'whatsapp_bot_session',
            filter: 'id=eq.default',
          },
          (payload: { new?: any }) => {
            if (payload.new) {
              setSession((prev) => ({ ...prev, ...(payload.new as WhatsAppSession) }));
            }
          }
        )
        .subscribe();
    }

    // Com Supabase Realtime ativo, quando conectado um polling de 30s é mais que suficiente como backup.
    // Quando desconectado ou aguardando QR, verifica a cada 10s.
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
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
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
        }
        .wa-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          width: 100%;
        }
        .wa-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .wa-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
          width: 100%;
        }
        .wa-hero-card {
          grid-column: span 2;
        }
        .wa-qr-box {
          background: #ffffff;
          padding: 14px;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          border: 2px solid var(--admin-line);
          display: flex;
          justify-content: center;
          align-items: center;
          max-width: 100%;
          box-sizing: border-box;
        }
        .wa-qr-img {
          width: min(260px, 75vw);
          height: auto;
          aspect-ratio: 1 / 1;
          display: block;
        }
        .wa-instructions {
          text-align: left;
          font-size: 13px;
          color: var(--admin-muted);
          background: var(--admin-card);
          border: 1px solid var(--admin-line);
          border-radius: 16px;
          padding: 16px 20px;
          margin: 0;
          line-height: 1.7;
          width: 100%;
          max-width: 440px;
          box-sizing: border-box;
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
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .wa-header-actions {
            justify-content: space-between !important;
            width: 100% !important;
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
          <p className="admin-kicker">AUTOMAÇÃO & ATENDIMENTO VIP</p>
          <h1 style={{ margin: 0 }}>WhatsApp Bot</h1>
        </div>

        <div className="wa-header-actions">
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              background: statusConfig.bg,
              border: `1px solid ${statusConfig.border}`,
              color: statusConfig.color,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: statusConfig.color,
              }}
            />
            {statusConfig.label}
          </span>

          <button
            type="button"
            onClick={() => fetchLatestSession(true)}
            disabled={loadingAction}
            className="admin-secondary"
            style={{ minHeight: '36px', padding: '0 14px', fontSize: '12px' }}
            title="Atualizar status"
          >
            <RefreshCw size={13} className={loadingAction ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO POR ABAS: CONEXÃO vs DISPAROS */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          borderBottom: '1px solid var(--admin-line)',
          scrollbarWidth: 'none',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('connection')}
          className={activeTab === 'connection' ? 'admin-primary' : 'admin-secondary'}
          style={{
            borderRadius: '999px',
            fontSize: '13px',
            padding: '8px 18px',
            minHeight: '38px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: activeTab === 'connection' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          <Smartphone size={16} />
          <span>Conexão & Atendimento</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('disparos')}
          className={activeTab === 'disparos' ? 'admin-primary' : 'admin-secondary'}
          style={{
            borderRadius: '999px',
            fontSize: '13px',
            padding: '8px 18px',
            minHeight: '38px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: activeTab === 'disparos' ? 600 : 500,
            cursor: 'pointer',
          }}
        >
          <SendHorizontal size={16} />
          <span>Disparos & Campanhas VIP</span>
        </button>
      </div>

      {activeTab === 'disparos' ? (
        <DisparosManager
          clients={clients}
          initialStats={initialStats}
          initialRecent={initialRecent}
          role={role}
        />
      ) : (
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
                    Agendamentos web em tempo real (Supabase)
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
                Realtime Ativo
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
                  placeholder="Ex: 51989601662 ou (51) 98960-1662"
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

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={notifyLara}
                onChange={(e) => setNotifyLara(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--admin-orange)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--admin-ink)', fontWeight: 500 }}>
                Receber alerta no WhatsApp pessoal quando pedirem para falar com atendente / Lara
              </span>
            </label>

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
                    Salvar WhatsApp da Lara
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
