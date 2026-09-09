'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  User,
  Pause,
  Play,
  Clock,
  Check,
  CheckCheck,
  Calendar,
  Phone,
  Sparkles,
  Bot,
  UserCheck,
  AlertCircle,
  MoreVertical,
  Plus,
  RefreshCw,
  ExternalLink,
  Shield,
  CornerDownLeft,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import type { WhatsAppSession } from './whatsapp-manager';

export interface ChatContact {
  phone: string;
  name: string;
  lastMessage: string;
  lastTimestamp: string;
  fromMe: boolean;
  mediaType: string;
  aiPaused: boolean;
  aiPausedUntil: string | null;
  clientId: string | null;
}

export interface ChatMessage {
  id: string;
  phone: string;
  remote_jid?: string | null;
  sender_name?: string | null;
  from_me: boolean;
  sender_type: 'client' | 'bot_ai' | 'admin_manual' | 'system';
  content: string;
  media_type: string;
  status: string;
  created_at: string;
}

const QUICK_REPLIES = [
  'Olá, maravilhosa! ✨ Em que posso te ajudar hoje?',
  'Seu agendamento está confirmado com sucesso! Te espero no estúdio. 💕',
  'Aqui está nossa chave PIX para confirmação: 51989601662 (Studio Lara Varisa).',
  'Nosso estúdio fica em Porto Alegre - RS. Ao chegar pode tocar o interfone!',
  'Lembre-se dos cuidados: não molhar as extensões nas primeiras 24h e pentear diariamente. 💖',
];

export function WhatsAppChatSimulator({ session }: { session: WhatsAppSession }) {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchContact, setSearchContact] = useState('');
  const [filterAi, setFilterAi] = useState<'all' | 'active' | 'paused'>('all');

  // Mensagens da conversa selecionada
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // Controle de Pausa da IA para o contato atual
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pausingAi, setPausingAi] = useState(false);

  // Nova conversa modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Carrega lista de contatos
  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await fetch('/api/admin/whatsapp/chat');
      const data = await res.json();
      if (data.contacts) {
        setContacts(data.contacts);
        // Seleciona automaticamente o primeiro contato se nenhum estiver selecionado
        if (!selectedPhone && data.contacts.length > 0) {
          setSelectedPhone(data.contacts[0].phone);
        }
      }
    } catch {
      // Silencioso
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  // 2. Carrega mensagens da conversa selecionada
  const loadConversation = async (phone: string) => {
    try {
      setLoadingMessages(true);
      const res = await fetch(`/api/admin/whatsapp/chat?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch {
      // Silencioso
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (selectedPhone) {
      loadConversation(selectedPhone);
    }
  }, [selectedPhone]);

  // 3. Escuta novas mensagens em tempo real via Supabase Realtime
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;

    // Mensagens em tempo real
    const msgChannel = supabase
      .channel('whatsapp_chat_simulator_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg) {
            // Se for da conversa atualmente aberta, adiciona
            if (selectedPhone && newMsg.phone === selectedPhone) {
              setMessages((prev) => [...prev, newMsg]);
            }

            // Atualiza resumo do contato na lista lateral
            setContacts((prev) => {
              const existingIdx = prev.findIndex((c) => c.phone === newMsg.phone);
              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  lastMessage: newMsg.content,
                  lastTimestamp: newMsg.created_at,
                  fromMe: newMsg.from_me,
                };
                return updated.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
              } else {
                // Novo contato
                const newContact: ChatContact = {
                  phone: newMsg.phone,
                  name: newMsg.sender_name || 'Contato',
                  lastMessage: newMsg.content,
                  lastTimestamp: newMsg.created_at,
                  fromMe: newMsg.from_me,
                  mediaType: newMsg.media_type,
                  aiPaused: false,
                  aiPausedUntil: null,
                  clientId: null,
                };
                return [newContact, ...prev];
              }
            });
          }
        }
      )
      .subscribe();

    // Controle de IA por contato em tempo real
    const controlChannel = supabase
      .channel('whatsapp_chat_simulator_controls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_chat_control',
        },
        (payload) => {
          const row = payload.new as any;
          if (row && row.phone) {
            setContacts((prev) =>
              prev.map((c) => {
                if (c.phone === row.phone) {
                  const isPaused = Boolean(
                    row.ai_paused &&
                    (!row.ai_paused_until || new Date(row.ai_paused_until).getTime() > Date.now())
                  );
                  return {
                    ...c,
                    aiPaused: isPaused,
                    aiPausedUntil: row.ai_paused_until || null,
                  };
                }
                return c;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(controlChannel);
    };
  }, [selectedPhone]);

  // Scroll suave ao receber nova mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Contato selecionado ativo
  const activeContact = useMemo(() => {
    return contacts.find((c) => c.phone === selectedPhone) || null;
  }, [contacts, selectedPhone]);

  // Contatos filtrados por busca e status de IA
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (filterAi === 'active' && c.aiPaused) return false;
      if (filterAi === 'paused' && !c.aiPaused) return false;

      if (searchContact.trim()) {
        const q = searchContact.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone.includes(q);
        const matchesMsg = c.lastMessage.toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesMsg;
      }
      return true;
    });
  }, [contacts, filterAi, searchContact]);

  // Enviar mensagem manual pelo chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedPhone || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    // Adiciona otimisticamente
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      phone: selectedPhone,
      sender_name: 'Lara Varisa',
      from_me: true,
      sender_type: 'admin_manual',
      content: messageText,
      media_type: 'text',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/admin/whatsapp/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          phone: selectedPhone,
          client_name: activeContact?.name,
          message: messageText,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Erro ao enviar mensagem.');
      }
    } catch {
      alert('Erro de conexão ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  // Alterar status de IA do contato (pausar temporariamente, permanente ou reativar)
  const handleToggleAi = async (paused: boolean, hours: number | null = null) => {
    if (!selectedPhone || pausingAi) return;
    setPausingAi(true);

    try {
      const res = await fetch('/api/admin/whatsapp/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_ai',
          phone: selectedPhone,
          client_name: activeContact?.name,
          ai_paused: paused,
          pause_duration_hours: hours,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setContacts((prev) =>
          prev.map((c) => {
            if (c.phone === selectedPhone) {
              return {
                ...c,
                aiPaused: paused,
                aiPausedUntil: data.control?.ai_paused_until || null,
              };
            }
            return c;
          })
        );
        setShowPauseModal(false);
      } else {
        alert(data.error || 'Erro ao atualizar status da IA.');
      }
    } catch {
      alert('Erro de conexão ao alterar status da IA.');
    } finally {
      setPausingAi(false);
    }
  };

  // Criar nova conversa
  const handleCreateNewChat = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newChatPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      alert('Por favor digite um número de WhatsApp com DDD válido.');
      return;
    }
    const fullPhone = clean.length === 10 || clean.length === 11 ? `55${clean}` : clean;

    const existing = contacts.find((c) => c.phone === fullPhone);
    if (existing) {
      setSelectedPhone(fullPhone);
    } else {
      const newC: ChatContact = {
        phone: fullPhone,
        name: newChatName.trim() || 'Novo Contato',
        lastMessage: 'Conversa iniciada pelo administrador',
        lastTimestamp: new Date().toISOString(),
        fromMe: true,
        mediaType: 'text',
        aiPaused: false,
        aiPausedUntil: null,
        clientId: null,
      };
      setContacts((prev) => [newC, ...prev]);
      setSelectedPhone(fullPhone);
    }

    setNewChatPhone('');
    setNewChatName('');
    setShowNewChatModal(false);
  };

  function formatTime(isoStr?: string) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function formatPhoneDisplay(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      const ddd = digits.slice(2, 4);
      const rest = digits.slice(4);
      if (rest.length === 9) {
        return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      }
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    return raw;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        height: '660px',
        background: 'var(--admin-card)',
        borderRadius: '24px',
        border: '1px solid var(--admin-line)',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.06)',
      }}
      className="whatsapp-simulator-container"
    >
      {/* ============================================================ */}
      {/* COLUNA ESQUERDA: LISTA DE CONVERSAS */}
      {/* ============================================================ */}
      <div
        style={{
          borderRight: '1px solid var(--admin-line)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--admin-subtle)',
        }}
      >
        {/* Topo da lista */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid var(--admin-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} style={{ color: 'var(--admin-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Conversas</h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'var(--admin-line)',
                color: 'var(--admin-muted)',
              }}
            >
              {contacts.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowNewChatModal(true)}
            title="Iniciar nova conversa"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: '999px',
              border: 'none',
              background: 'var(--admin-primary)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={13} />
            <span>Novo</span>
          </button>
        </div>

        {/* Busca e Filtros de IA */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--admin-card)',
              padding: '8px 12px',
              borderRadius: '12px',
              border: '1px solid var(--admin-line)',
            }}
          >
            <Search size={14} style={{ color: 'var(--admin-muted)' }} />
            <input
              type="text"
              placeholder="Buscar cliente ou número..."
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '12px',
                color: 'var(--admin-text)',
                width: '100%',
              }}
            />
          </div>

          {/* Abas de filtro: Todas / IA Ativa / IA Pausada */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--admin-line)', padding: '2px', borderRadius: '10px' }}>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'active', label: '🟢 IA Ativa' },
              { id: 'paused', label: '⏸️ Pausadas' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterAi(tab.id as any)}
                style={{
                  flex: 1,
                  fontSize: '11px',
                  fontWeight: filterAi === tab.id ? 600 : 500,
                  padding: '5px 2px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: filterAi === tab.id ? 'var(--admin-card)' : 'transparent',
                  color: filterAi === tab.id ? 'var(--admin-text)' : 'var(--admin-muted)',
                  boxShadow: filterAi === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista rolável de contatos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px 8px' }}>
          {loadingContacts ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-muted)', fontSize: '12px' }}>
              <RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
              Carregando conversas...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-muted)', fontSize: '12px' }}>
              Nenhum chat encontrado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredContacts.map((c) => {
                const isSelected = c.phone === selectedPhone;
                return (
                  <div
                    key={c.phone}
                    onClick={() => setSelectedPhone(c.phone)}
                    style={{
                      padding: '12px',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: isSelected ? 'rgba(226, 137, 168, 0.12)' : 'transparent',
                      border: isSelected ? '1px solid rgba(226, 137, 168, 0.3)' : '1px solid transparent',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    {/* Avatar com status de IA */}
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: isSelected ? 'var(--admin-primary)' : 'rgba(226, 137, 168, 0.2)',
                          color: isSelected ? '#fff' : 'var(--admin-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '14px',
                        }}
                      >
                        {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                      </div>

                      {/* Dot de status da IA */}
                      <span
                        title={c.aiPaused ? 'IA pausada para este contato' : 'IA respondendo automaticamente'}
                        style={{
                          position: 'absolute',
                          bottom: '-1px',
                          right: '-1px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: c.aiPaused ? '#f59e0b' : '#22c55e',
                          border: '2px solid var(--admin-card)',
                        }}
                      />
                    </div>

                    {/* Detalhes do contato */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--admin-text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.name}
                        </h4>
                        <span style={{ fontSize: '10px', color: 'var(--admin-muted)', flexShrink: 0 }}>
                          {formatTime(c.lastTimestamp)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '12px',
                            color: 'var(--admin-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '170px',
                          }}
                        >
                          {c.fromMe && <span style={{ color: 'var(--admin-primary)', fontWeight: 600 }}>Você: </span>}
                          {c.lastMessage || 'Conversa iniciada'}
                        </p>

                        {c.aiPaused && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '2px 5px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#b45309',
                              flexShrink: 0,
                            }}
                          >
                            HUMANO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* COLUNA DIREITA: JANELA DO CHAT (WHATSAPP WEB SIMULATOR) */}
      {/* ============================================================ */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--admin-card)' }}>
        {activeContact ? (
          <>
            {/* Header da conversa ativa */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--admin-line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--admin-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--admin-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '15px',
                  }}
                >
                  {activeContact.name.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--admin-text)' }}>
                      {activeContact.name}
                    </h3>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--admin-muted)' }}>
                    {formatPhoneDisplay(activeContact.phone)}
                  </span>
                </div>
              </div>

              {/* Botão de Controle da IA para este chat específico */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowPauseModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: activeContact.aiPaused ? 'rgba(245, 158, 11, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                    border: `1px solid ${activeContact.aiPaused ? 'rgba(245, 158, 11, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                    color: activeContact.aiPaused ? '#b45309' : '#15803d',
                  }}
                >
                  {activeContact.aiPaused ? (
                    <>
                      <Pause size={14} />
                      <span>IA Pausada ({activeContact.aiPausedUntil ? `Até ${formatTime(activeContact.aiPausedUntil)}` : 'Permanente'})</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>IA Ativa no Chat</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Banner de aviso se a IA estiver pausada */}
            {activeContact.aiPaused && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
                  padding: '8px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#b45309',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>
                    <strong>Atendimento manual ativado:</strong> A IA não responderá mensagens deste cliente automaticamente.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleAi(false)}
                  disabled={pausingAi}
                  style={{
                    background: '#f59e0b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {pausingAi ? 'Reativando...' : 'Reativar IA Agora'}
                </button>
              </div>
            )}

            {/* Container das Mensagens estilo WhatsApp */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundImage: 'radial-gradient(var(--admin-line) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-muted)', fontSize: '13px' }}>
                  <RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--admin-muted)' }}>
                  <MessageSquare size={32} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Nenhuma mensagem nesta conversa ainda.</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
                    Envie uma mensagem abaixo para iniciar o contato diretamente no WhatsApp do cliente.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.from_me;
                  const isBotAi = msg.sender_type === 'bot_ai';
                  const isManual = msg.sender_type === 'admin_manual';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '100%',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '78%',
                          padding: '10px 14px',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: isMe
                            ? 'linear-gradient(135deg, #e289a8 0%, #d46e91 100%)'
                            : 'var(--admin-subtle)',
                          color: isMe ? '#ffffff' : 'var(--admin-text)',
                          border: isMe ? 'none' : '1px solid var(--admin-line)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          fontSize: '13.5px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {/* Tag de identificação de quem enviou */}
                        {isMe && (
                          <div
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              letterSpacing: '0.5px',
                              marginBottom: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: 'rgba(255, 255, 255, 0.85)',
                            }}
                          >
                            {isBotAi ? (
                              <>
                                <Sparkles size={11} />
                                <span>LARA IA</span>
                              </>
                            ) : (
                              <>
                                <UserCheck size={11} />
                                <span>LARA (MANUAL)</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Conteúdo da mensagem */}
                        <div>{msg.content}</div>

                        {/* Hora e checks */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px',
                            marginTop: '4px',
                            fontSize: '10px',
                            color: isMe ? 'rgba(255, 255, 255, 0.8)' : 'var(--admin-muted)',
                          }}
                        >
                          <span>{formatTime(msg.created_at)}</span>
                          {isMe && <CheckCheck size={13} style={{ color: '#fff' }} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Barra de Respostas Rápidas */}
            <div
              style={{
                padding: '8px 16px',
                background: 'var(--admin-subtle)',
                borderTop: '1px solid var(--admin-line)',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--admin-muted)', fontWeight: 600, alignSelf: 'center', flexShrink: 0 }}>
                Rápidas:
              </span>
              {QUICK_REPLIES.map((reply, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInputText(reply)}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: '1px solid var(--admin-line)',
                    background: 'var(--admin-card)',
                    color: 'var(--admin-text)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {reply.slice(0, 28)}...
                </button>
              ))}
            </div>

            {/* Input para envio de mensagem */}
            <form
              onSubmit={handleSendMessage}
              style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--admin-line)',
                background: 'var(--admin-card)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <input
                type="text"
                placeholder={`Mensagem para ${activeContact.name}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '16px',
                  border: '1px solid var(--admin-line)',
                  background: 'var(--admin-subtle)',
                  color: 'var(--admin-text)',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              />

              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 20px',
                  borderRadius: '16px',
                  border: 'none',
                  background: 'var(--admin-primary)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: inputText.trim() && !sending ? 'pointer' : 'not-allowed',
                  opacity: inputText.trim() && !sending ? 1 : 0.6,
                }}
              >
                {sending ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Enviar</span>
                    <Send size={15} />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--admin-muted)' }}>
            <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: '14px' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Selecione uma conversa ao lado</h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', opacity: 0.8 }}>
              Você poderá visualizar todo o histórico, pausar a IA e responder manualmente.
            </p>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: PAUSAR OU REATIVAR IA PARA ESTE CHAT */}
      {/* ============================================================ */}
      {showPauseModal && activeContact && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setShowPauseModal(false)}
        >
          <div
            style={{
              background: 'var(--admin-card)',
              borderRadius: '24px',
              border: '1px solid var(--admin-line)',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'rgba(226, 137, 168, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--admin-primary)',
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Controle de IA no Chat</h3>
                <span style={{ fontSize: '12px', color: 'var(--admin-muted)' }}>{activeContact.name}</span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--admin-text)', lineHeight: '1.5', marginBottom: '20px' }}>
              Escolha se a Lara IA deve responder mensagens automaticamente deste cliente ou se você prefere assumir o atendimento humano.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Opção 1: Pausar por 1 hora */}
              <button
                type="button"
                onClick={() => handleToggleAi(true, 1)}
                disabled={pausingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  border: '1px solid var(--admin-line)',
                  background: 'var(--admin-subtle)',
                  color: 'var(--admin-text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '13px' }}>⏸️ Pausar IA por 1 hora</strong>
                  <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>Ideal para concluir uma dúvida rápida</span>
                </div>
                <Clock size={16} style={{ color: 'var(--admin-muted)' }} />
              </button>

              {/* Opção 2: Pausar por 24 horas */}
              <button
                type="button"
                onClick={() => handleToggleAi(true, 24)}
                disabled={pausingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  border: '1px solid var(--admin-line)',
                  background: 'var(--admin-subtle)',
                  color: 'var(--admin-text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '13px' }}>⏸️ Pausar IA por 24 horas</strong>
                  <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>Atendimento manual durante todo o dia de hoje</span>
                </div>
                <Calendar size={16} style={{ color: 'var(--admin-muted)' }} />
              </button>

              {/* Opção 3: Pausar Permanentemente */}
              <button
                type="button"
                onClick={() => handleToggleAi(true, null)}
                disabled={pausingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  color: '#b91c1c',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '13px' }}>🚫 Pausar Permanentemente</strong>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>A IA nunca responderá este cliente a menos que reativada</span>
                </div>
                <Shield size={16} />
              </button>

              {/* Opção 4: Reativar IA */}
              <button
                type="button"
                onClick={() => handleToggleAi(false)}
                disabled={pausingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#15803d',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '13px' }}>🟢 Reativar IA Agora</strong>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Voltar a responder automaticamente com IA</span>
                </div>
                <Play size={16} />
              </button>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowPauseModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-line)',
                  background: 'transparent',
                  color: 'var(--admin-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: INICIAR NOVA CONVERSA */}
      {/* ============================================================ */}
      {showNewChatModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setShowNewChatModal(false)}
        >
          <div
            style={{
              background: 'var(--admin-card)',
              borderRadius: '24px',
              border: '1px solid var(--admin-line)',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700 }}>Nova Conversa no WhatsApp</h3>
            <p style={{ fontSize: '12px', color: 'var(--admin-muted)', marginBottom: '18px' }}>
              Digite o número do cliente com DDD para abrir uma conversa direta no painel.
            </p>

            <form onSubmit={handleCreateNewChat} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Nome do Cliente (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Gabriela Silva"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--admin-line)',
                    background: 'var(--admin-subtle)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Telefone / WhatsApp (com DDD)
                </label>
                <input
                  type="tel"
                  placeholder="Ex: 51 98974-1970"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--admin-line)',
                    background: 'var(--admin-subtle)',
                    color: 'var(--admin-text)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--admin-line)',
                    background: 'transparent',
                    color: 'var(--admin-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'var(--admin-primary)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Abrir Conversa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
