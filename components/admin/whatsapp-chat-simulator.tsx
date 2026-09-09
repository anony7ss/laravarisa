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
  CheckCheck,
  Calendar,
  Sparkles,
  Bot,
  UserCheck,
  AlertCircle,
  Plus,
  RefreshCw,
  ArrowLeft,
  Shield,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
  Paperclip,
  Mic,
  Volume2,
  Download,
  Eye,
  X,
  FileText,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import type { WhatsAppSession } from './whatsapp-manager';
import {
  areSamePhone,
  normalizeCanonicalPhone,
  formatPhoneForDisplay,
  cleanPhoneDigits,
} from '@/lib/phone-utils';

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
  media_url?: string | null;
  status: string;
  created_at: string;
}

function ChatAudioPlayer({ src, isMe }: { src: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    audioRef.current.playbackRate = nextSpeed;
    setSpeed(nextSpeed);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const val = Number(e.target.value);
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        borderRadius: '12px',
        background: isMe ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.05)',
        width: '100%',
        minWidth: '220px',
        maxWidth: '280px',
        boxSizing: 'border-box',
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
          }
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: 'none',
          background: isMe ? '#e289a8' : 'var(--admin-orange, #c58f59)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
        }}
        title={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '2px' }} />}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          style={{
            width: '100%',
            height: '4px',
            accentColor: isMe ? '#e289a8' : 'var(--admin-orange, #c58f59)',
            cursor: 'pointer',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--admin-muted, #8b8b83)' }}>
          <span>{formatSeconds(currentTime)}</span>
          <span>{formatSeconds(duration)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={cycleSpeed}
        style={{
          fontSize: '10px',
          fontWeight: 700,
          padding: '2px 5px',
          borderRadius: '6px',
          background: 'rgba(255, 255, 255, 0.08)',
          color: 'var(--admin-ink, #f7f7f2)',
          border: '1px solid var(--admin-line, #2a2a26)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        title="Velocidade de reprodução"
      >
        {speed}x
      </button>
    </div>
  );
}

const QUICK_REPLIES = [
  'Olá! ✨ Em que posso te ajudar hoje?',
  'Seu agendamento está confirmado com sucesso! Te espero no estúdio. 💕',
  'Chave PIX: 51989601662 (Studio Lara Varisa).',
  'Nosso estúdio fica em Porto Alegre - RS. Ao chegar pode tocar o interfone!',
  'Lembre-se dos cuidados: não molhar os cílios nas primeiras 24h. 💖',
];

export function WhatsAppChatSimulator({ session }: { session: WhatsAppSession }) {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchContact, setSearchContact] = useState('');
  const [filterAi, setFilterAi] = useState<'all' | 'active' | 'paused'>('all');

  // Controle de visualização mobile ('list' ou 'chat')
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Controle de tela cheia
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mensagens da conversa selecionada
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // Modal de pausa da IA
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pausingAi, setPausingAi] = useState(false);

  // Modal de nova conversa
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');

  // Visualizador de Imagem (Lightbox)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Envio de Mídia / Anexos (Fotos)
  const [attachmentPreview, setAttachmentPreview] = useState<{ file: File; base64: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecione um arquivo de imagem válido (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('A imagem não pode ultrapassar 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachmentPreview({ file, base64: reader.result });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Carrega lista de contatos
  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await fetch('/api/admin/whatsapp/chat');
      const data = await res.json();
      if (data.contacts && Array.isArray(data.contacts)) {
        setContacts(data.contacts);
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

  // 3. Realtime Supabase
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;

    const msgChannel = supabase
      .channel('wa_chat_live_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (!newMsg) return;

          // Se a mensagem pertence à conversa atualmente selecionada
          if (selectedPhone && areSamePhone(newMsg.phone, selectedPhone)) {
            setMessages((prev) => {
              // Já existe na lista pelo ID?
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              // Se houver mensagem temporária otimista pendente igual, substitui
              const optIndex = prev.findIndex(
                (m) =>
                  m.id.startsWith('temp-') &&
                  m.from_me === newMsg.from_me &&
                  m.content.trim() === newMsg.content.trim()
              );
              if (optIndex >= 0) {
                const copy = [...prev];
                copy[optIndex] = newMsg;
                return copy;
              }

              return [...prev, newMsg];
            });
          }

          setContacts((prev) => {
            const idx = prev.findIndex((c) => areSamePhone(c.phone, newMsg.phone));
            const canonicalPhone = normalizeCanonicalPhone(newMsg.phone) || newMsg.phone;
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                lastMessage: newMsg.content || '',
                lastTimestamp: newMsg.created_at,
                fromMe: newMsg.from_me,
              };
              return updated.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
            } else {
              const newC: ChatContact = {
                phone: canonicalPhone,
                name: newMsg.sender_name || 'Contato',
                lastMessage: newMsg.content || '',
                lastTimestamp: newMsg.created_at,
                fromMe: newMsg.from_me,
                mediaType: newMsg.media_type || 'text',
                aiPaused: false,
                aiPausedUntil: null,
                clientId: null,
              };
              return [newC, ...prev];
            }
          });
        }
      )
      .subscribe();

    const controlChannel = supabase
      .channel('wa_chat_live_controls')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_chat_control' },
        (payload) => {
          const row = payload.new as any;
          if (row && row.phone) {
            setContacts((prev) =>
              prev.map((c) => {
                if (areSamePhone(c.phone, row.phone)) {
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

  // Scroll suave para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeContact = useMemo(() => {
    if (!selectedPhone) return null;
    return contacts.find((c) => areSamePhone(c.phone, selectedPhone)) || null;
  }, [contacts, selectedPhone]);

  const effectiveContact = useMemo(() => {
    if (activeContact) return activeContact;
    if (selectedPhone) {
      return {
        phone: selectedPhone,
        name: 'Contato',
        lastMessage: '',
        lastTimestamp: new Date().toISOString(),
        fromMe: false,
        mediaType: 'text',
        aiPaused: false,
        aiPausedUntil: null,
        clientId: null,
      } as ChatContact;
    }
    return null;
  }, [activeContact, selectedPhone]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (!c) return false;
      if (filterAi === 'active' && c.aiPaused) return false;
      if (filterAi === 'paused' && !c.aiPaused) return false;

      if (searchContact.trim()) {
        const q = searchContact.toLowerCase();
        const name = (c.name || '').toLowerCase();
        const phone = (c.phone || '');
        const lastMsg = (c.lastMessage || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      }
      return true;
    });
  }, [contacts, filterAi, searchContact]);

  // Desduplicação inteligente para exibição sem mensagens repetidas
  const displayMessages = useMemo(() => {
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const list: ChatMessage[] = [];

    for (const msg of messages) {
      if (!msg || !msg.id) continue;
      if (seenIds.has(msg.id)) continue;
      seenIds.add(msg.id);

      // Desduplica se for mensagem idêntica (autor + texto) dentro de janela de 6s
      const bucket = Math.floor(new Date(msg.created_at || Date.now()).getTime() / 6000);
      const dedupeKey = `${msg.from_me ? 'me' : 'them'}_${msg.content?.trim()}_${bucket}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      list.push(msg);
    }
    return list;
  }, [messages]);

  // Enviar mensagem manual (com suporte a texto e imagem)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachmentPreview) || !selectedPhone || sending) return;

    const messageText = inputText.trim();
    const mediaBase64 = attachmentPreview?.base64 || null;
    const mediaType = attachmentPreview ? 'image' : 'text';

    setInputText('');
    setAttachmentPreview(null);
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      phone: selectedPhone,
      sender_name: 'Lara Varisa',
      from_me: true,
      sender_type: 'admin_manual',
      content: messageText || (mediaType === 'image' ? '📷 [Foto enviada]' : ''),
      media_type: mediaType,
      media_url: mediaBase64,
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
          client_name: effectiveContact?.name,
          message: messageText,
          media_type: mediaType,
          media_url: mediaBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Erro ao enviar mensagem.');
        // Remove mensagem otimista em caso de erro
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else if (data.message) {
        // Substitui a temporária pelo registro oficial retornado
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === tempId);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = data.message;
            return copy;
          }
          return prev;
        });
      }
    } catch {
      alert('Erro de conexão ao enviar mensagem.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // Pausar ou reativar IA para este contato
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
          client_name: effectiveContact?.name,
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
      setMobileView('chat');
    } else {
      const newC: ChatContact = {
        phone: fullPhone,
        name: newChatName.trim() || 'Novo Contato',
        lastMessage: 'Conversa iniciada',
        lastTimestamp: new Date().toISOString(),
        fromMe: true,
        mediaType: 'text',
        aiPaused: false,
        aiPausedUntil: null,
        clientId: null,
      };
      setContacts((prev) => [newC, ...prev]);
      setSelectedPhone(fullPhone);
      setMobileView('chat');
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
    return formatPhoneForDisplay(raw);
  }

  return (
    <div
      style={{
        display: 'flex',
        height: isFullscreen ? '100dvh' : '640px',
        maxHeight: isFullscreen ? '100dvh' : 'calc(100dvh - 200px)',
        background: 'var(--admin-card, #181815)',
        borderRadius: isFullscreen ? '0px' : '20px',
        border: isFullscreen ? 'none' : '1px solid var(--admin-line, #2a2a26)',
        overflow: 'hidden',
        color: 'var(--admin-ink, #f7f7f2)',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 99999 : undefined,
        width: isFullscreen ? '100vw' : '100%',
      }}
      className={`wa-chat-container ${isFullscreen ? 'wa-chat-fullscreen' : ''}`}
    >
      <style>{`
        .wa-chat-container.wa-chat-fullscreen {
          position: fixed !important;
          inset: 0 !important;
          z-index: 99999 !important;
          width: 100vw !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          border-radius: 0 !important;
          border: none !important;
          margin: 0 !important;
        }
        @media (max-width: 768px) {
          .wa-chat-container:not(.wa-chat-fullscreen) {
            height: calc(100dvh - 120px) !important;
            max-height: calc(100dvh - 120px) !important;
            border-radius: 14px !important;
          }
          .wa-contacts-panel {
            width: 100% !important;
            min-width: 100% !important;
            border-right: none !important;
          }
          .wa-chat-panel {
            width: 100% !important;
            min-width: 100% !important;
          }
          .wa-hide-on-mobile {
            display: none !important;
          }
          .wa-show-on-mobile {
            display: inline-flex !important;
          }
        }
      `}</style>

      {/* ============================================================ */}
      {/* COLUNA ESQUERDA: LISTA DE CONVERSAS */}
      {/* ============================================================ */}
      <div
        className={`wa-contacts-panel ${mobileView === 'chat' ? 'wa-hide-on-mobile' : ''}`}
        style={{
          width: '320px',
          minWidth: '280px',
          borderRight: '1px solid var(--admin-line, #2a2a26)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--admin-card, #181815)',
          height: '100%',
        }}
      >
        {/* Topo da lista de conversas */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--admin-line, #2a2a26)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Conversas</span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'var(--admin-soft, #242420)',
                color: 'var(--admin-muted, #8b8b83)',
              }}
            >
              {contacts.length}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                border: '1px solid var(--admin-line, #2a2a26)',
                background: isFullscreen ? 'var(--admin-orange, #c58f59)' : 'var(--admin-soft, #242420)',
                color: isFullscreen ? '#ffffff' : 'var(--admin-ink, #f7f7f2)',
                cursor: 'pointer',
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '999px',
                border: '1px solid var(--admin-line, #2a2a26)',
                background: 'var(--admin-soft, #242420)',
                color: 'var(--admin-ink, #f7f7f2)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              <span>Nova</span>
            </button>
          </div>
        </div>

        {/* Busca e Filtro */}
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--admin-soft, #242420)',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--admin-line, #2a2a26)',
            }}
          >
            <Search size={13} style={{ color: 'var(--admin-muted, #8b8b83)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '12px',
                color: 'var(--admin-ink, #f7f7f2)',
                width: '100%',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'active', label: 'IA Ativa' },
              { id: 'paused', label: 'Pausadas' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterAi(tab.id as any)}
                style={{
                  flex: 1,
                  fontSize: '11px',
                  fontWeight: filterAi === tab.id ? 600 : 500,
                  padding: '5px 0',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: filterAi === tab.id ? 'var(--admin-soft, #242420)' : 'transparent',
                  color: filterAi === tab.id ? 'var(--admin-ink, #f7f7f2)' : 'var(--admin-muted, #8b8b83)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Contatos */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px 12px 8px' }}>
          {loadingContacts ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-muted, #8b8b83)', fontSize: '12px' }}>
              <RefreshCw size={14} className="animate-spin" style={{ margin: '0 auto 6px auto' }} />
              Carregando conversas...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-muted, #8b8b83)', fontSize: '12px' }}>
              Nenhuma conversa encontrada.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filteredContacts.map((c) => {
                const isSelected = c.phone === selectedPhone;
                return (
                  <div
                    key={c.phone}
                    onClick={() => {
                      setSelectedPhone(c.phone);
                      setMobileView('chat');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                      background: isSelected ? 'var(--admin-soft, #242420)' : 'transparent',
                      borderLeft: isSelected ? '3px solid #e289a8' : '3px solid transparent',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                    }}
                  >
                    {/* Avatar minimalista */}
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: isSelected ? 'rgba(226, 137, 168, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? '#e289a8' : 'var(--admin-ink, #f7f7f2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '13px',
                        flexShrink: 0,
                      }}
                    >
                      {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                    </div>

                    {/* Dados do contato */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: isSelected ? 600 : 500,
                            color: 'var(--admin-ink, #f7f7f2)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.name}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--admin-muted, #8b8b83)', flexShrink: 0 }}>
                          {formatTime(c.lastTimestamp)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '11.5px',
                            color: 'var(--admin-muted, #8b8b83)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.fromMe && <span style={{ color: '#e289a8' }}>Você: </span>}
                          {c.lastMessage || 'Conversa iniciada'}
                        </p>

                        {c.aiPaused && (
                          <span
                            title="IA pausada para este contato"
                            style={{
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#d97706',
                              flexShrink: 0,
                              fontWeight: 600,
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
      {/* COLUNA DIREITA: CONVERSA ATIVA */}
      {/* ============================================================ */}
      <div
        className={`wa-chat-panel ${mobileView === 'list' ? 'wa-hide-on-mobile' : ''}`}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--admin-card, #181815)',
          minWidth: 0,
        }}
      >
        {effectiveContact ? (
          <>
            {/* Header da conversa */}
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--admin-line, #2a2a26)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--admin-card, #181815)',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {/* Botão voltar no mobile */}
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="wa-show-on-mobile"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--admin-ink, #f7f7f2)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ArrowLeft size={18} />
                </button>

                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(226, 137, 168, 0.15)',
                    color: '#e289a8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '13px',
                    flexShrink: 0,
                  }}
                >
                  {(effectiveContact.name || 'C').charAt(0).toUpperCase()}
                </div>

                <div style={{ minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {effectiveContact.name || 'Contato'}
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--admin-muted, #8b8b83)' }}>
                    {formatPhoneDisplay(effectiveContact.phone)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid var(--admin-line, #2a2a26)',
                    background: isFullscreen ? 'var(--admin-orange, #c58f59)' : 'var(--admin-soft, #242420)',
                    color: isFullscreen ? '#ffffff' : 'var(--admin-ink, #f7f7f2)',
                    cursor: 'pointer',
                  }}
                >
                  {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                {/* Botão de Controle de IA */}
                <button
                  type="button"
                  onClick={() => setShowPauseModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '11.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${effectiveContact.aiPaused ? 'rgba(245, 158, 11, 0.3)' : 'var(--admin-line, #2a2a26)'}`,
                    background: effectiveContact.aiPaused ? 'rgba(245, 158, 11, 0.08)' : 'var(--admin-soft, #242420)',
                    color: effectiveContact.aiPaused ? '#d97706' : 'var(--admin-ink, #f7f7f2)',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: effectiveContact.aiPaused ? '#f59e0b' : '#22c55e',
                    }}
                  />
                  <span>{effectiveContact.aiPaused ? 'IA Pausada' : 'IA Ativa'}</span>
                </button>
              </div>
            </div>

            {/* Aviso sutil se IA pausada */}
            {effectiveContact.aiPaused && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
                  padding: '6px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#d97706',
                }}
              >
                <span>Atendimento humano manual ativado para este cliente.</span>
                <button
                  type="button"
                  onClick={() => handleToggleAi(false)}
                  disabled={pausingAi}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#d97706',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '11px',
                  }}
                >
                  Reativar IA
                </button>
              </div>
            )}

            {/* Balões de Mensagem */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'var(--admin-card, #181815)',
              }}
            >
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--admin-muted, #8b8b83)', fontSize: '12px' }}>
                  <RefreshCw size={14} className="animate-spin" style={{ margin: '0 auto 6px auto' }} />
                  Carregando mensagens...
                </div>
              ) : displayMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--admin-muted, #8b8b83)', fontSize: '12px' }}>
                  Nenhuma mensagem registrada nesta conversa.
                </div>
              ) : (
                displayMessages.map((msg) => {
                  const isMe = msg.from_me;
                  const isBot = msg.sender_type === 'bot_ai';

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
                          maxWidth: '82%',
                          padding: '9px 13px',
                          borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          background: isMe
                            ? isBot
                              ? 'rgba(226, 137, 168, 0.14)'
                              : 'rgba(197, 143, 89, 0.15)'
                            : 'var(--admin-soft, #242420)',
                          border: isMe
                            ? isBot
                              ? '1px solid rgba(226, 137, 168, 0.25)'
                              : '1px solid rgba(197, 143, 89, 0.28)'
                            : '1px solid var(--admin-line, #2a2a26)',
                          color: 'var(--admin-ink, #dfdfd8)',
                          fontSize: '13px',
                          lineHeight: '1.45',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                      >
                        {isMe && (
                          <div
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 600,
                              letterSpacing: '0.4px',
                              marginBottom: '3px',
                              color: isBot ? '#e289a8' : '#c58f59',
                            }}
                          >
                            {isBot ? 'LARA IA' : 'VOCÊ (MANUAL)'}
                          </div>
                        )}

                        {(() => {
                          const isImage =
                            msg.media_type === 'image' ||
                            Boolean(msg.media_url && (msg.media_url.startsWith('data:image/') || msg.media_url.match(/\.(jpeg|jpg|png|webp|gif)/i))) ||
                            msg.content.startsWith('data:image/') ||
                            Boolean(msg.content.match(/^https?:\/\/[^\s]+?\.(jpeg|jpg|png|webp|gif)(\?.*)?$/i));

                          const imageUrl = (msg.media_url && (msg.media_url.startsWith('data:image/') || msg.media_url.startsWith('http')))
                            ? msg.media_url
                            : (msg.content.startsWith('data:image/') || msg.content.match(/^https?:\/\/[^\s]+?\.(jpeg|jpg|png|webp|gif)(\?.*)?$/i))
                            ? msg.content
                            : null;

                          const isAudio =
                            msg.media_type === 'audio' ||
                            msg.media_type === 'voice' ||
                            msg.media_type === 'ptt' ||
                            Boolean(msg.media_url && (msg.media_url.startsWith('data:audio/') || msg.media_url.match(/\.(ogg|mp3|m4a|wav|opus)/i))) ||
                            msg.content.startsWith('data:audio/') ||
                            Boolean(msg.content.match(/^https?:\/\/[^\s]+?\.(ogg|mp3|m4a|wav|opus)(\?.*)?$/i));

                          const audioUrl = (msg.media_url && (msg.media_url.startsWith('data:audio/') || msg.media_url.startsWith('http')))
                            ? msg.media_url
                            : (msg.content.startsWith('data:audio/') || msg.content.match(/^https?:\/\/[^\s]+?\.(ogg|mp3|m4a|wav|opus)(\?.*)?$/i))
                            ? msg.content
                            : null;

                          const isGenericImagePlaceholder =
                            msg.content === '📷 [Foto enviada]' ||
                            msg.content === 'Foto enviada' ||
                            msg.content === '[Foto enviada]' ||
                            msg.content.startsWith('data:image/');

                          const isGenericAudioPlaceholder =
                            msg.content === '🎤 [Áudio / Nota de voz]' ||
                            msg.content === '🎤 [Nota de voz enviada]' ||
                            msg.content === '🎤 [Áudio enviado]' ||
                            msg.content.startsWith('data:audio/');

                          if (isImage) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {imageUrl ? (
                                  <div
                                    onClick={() => setLightboxImage(imageUrl)}
                                    style={{
                                      position: 'relative',
                                      borderRadius: '10px',
                                      overflow: 'hidden',
                                      cursor: 'pointer',
                                      maxWidth: '260px',
                                      maxHeight: '260px',
                                      border: '1px solid rgba(255, 255, 255, 0.1)',
                                      background: 'rgba(0, 0, 0, 0.2)',
                                    }}
                                    title="Clique para ampliar a foto"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt="Foto WhatsApp"
                                      style={{
                                        width: '100%',
                                        height: 'auto',
                                        maxHeight: '260px',
                                        objectFit: 'cover',
                                        display: 'block',
                                      }}
                                      loading="lazy"
                                    />
                                    <div
                                      style={{
                                        position: 'absolute',
                                        bottom: '6px',
                                        right: '6px',
                                        padding: '3px 7px',
                                        borderRadius: '6px',
                                        background: 'rgba(0, 0, 0, 0.65)',
                                        color: '#ffffff',
                                        fontSize: '10.5px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        backdropFilter: 'blur(4px)',
                                      }}
                                    >
                                      <Eye size={11} /> Ampliar
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      border: '1px solid var(--admin-line, #2a2a26)',
                                      fontSize: '12px',
                                      color: 'var(--admin-ink, #dfdfd8)',
                                    }}
                                  >
                                    <ImageIcon size={16} style={{ color: isMe ? '#e289a8' : 'var(--admin-orange, #c58f59)' }} />
                                    <span>Foto enviada pelo WhatsApp</span>
                                  </div>
                                )}
                                {!isGenericImagePlaceholder && msg.content && (
                                  <div style={{ color: 'var(--admin-ink, #dfdfd8)', marginTop: '2px' }}>{msg.content}</div>
                                )}
                              </div>
                            );
                          }

                          if (isAudio) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {audioUrl ? (
                                  <ChatAudioPlayer src={audioUrl} isMe={isMe} />
                                ) : (
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '7px 12px',
                                      borderRadius: '10px',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      border: '1px solid var(--admin-line, #2a2a26)',
                                      fontSize: '12px',
                                      color: isMe ? '#e289a8' : 'var(--admin-orange, #c58f59)',
                                    }}
                                  >
                                    <Mic size={15} />
                                    <span style={{ color: 'var(--admin-ink, #dfdfd8)', fontWeight: 500 }}>Áudio / Nota de voz</span>
                                  </div>
                                )}
                                {!isGenericAudioPlaceholder && msg.content && (
                                  <div
                                    style={{
                                      padding: '6px 9px',
                                      borderRadius: '8px',
                                      background: 'rgba(255, 255, 255, 0.04)',
                                      border: '1px solid rgba(255, 255, 255, 0.07)',
                                      fontSize: '11.5px',
                                      color: 'var(--admin-ink, #dfdfd8)',
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    <span style={{ fontSize: '9.5px', fontWeight: 600, color: 'var(--admin-muted, #8b8b83)', display: 'block', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                      Transcrição IA:
                                    </span>
                                    {msg.content.replace(/^🎤\s*\[Áudio\]:\s*"?/, '').replace(/"?$/, '')}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return <div style={{ color: 'var(--admin-ink, #dfdfd8)' }}>{msg.content}</div>;
                        })()}

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '3px',
                            marginTop: '3px',
                            fontSize: '9.5px',
                            color: 'var(--admin-muted, #8b8b83)',
                          }}
                        >
                          <span>{formatTime(msg.created_at)}</span>
                          {isMe && <CheckCheck size={11} style={{ color: isBot ? '#e289a8' : '#c58f59' }} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Respostas Rápidas Minimalistas */}
            <div
              style={{
                padding: '6px 12px',
                borderTop: '1px solid var(--admin-line, #2a2a26)',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {QUICK_REPLIES.map((reply, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInputText(reply)}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--admin-line, #2a2a26)',
                    background: 'transparent',
                    color: 'var(--admin-muted, #8b8b83)',
                    fontSize: '10.5px',
                    cursor: 'pointer',
                  }}
                >
                  {reply.slice(0, 24)}...
                </button>
              ))}
            </div>

            {/* Preview de Imagem Anexada */}
            {attachmentPreview && (
              <div
                style={{
                  padding: '8px 14px',
                  borderTop: '1px solid var(--admin-line, #2a2a26)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <img
                    src={attachmentPreview.base64}
                    alt="Preview"
                    style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink, #dfdfd8)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attachmentPreview.file.name}
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--admin-muted, #8b8b83)' }}>
                      {(attachmentPreview.file.size / 1024).toFixed(0)} KB • Foto pronta para envio
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachmentPreview(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--admin-muted, #8b8b83)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                  title="Remover anexo"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Input de Envio */}
            <form
              onSubmit={handleSendMessage}
              style={{
                padding: '10px 14px',
                borderTop: '1px solid var(--admin-line, #2a2a26)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-line, #2a2a26)',
                  background: attachmentPreview ? 'rgba(226, 137, 168, 0.2)' : 'var(--admin-soft, #242420)',
                  color: attachmentPreview ? '#e289a8' : 'var(--admin-ink, #f7f7f2)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="Anexar foto da galeria"
              >
                <ImageIcon size={17} />
              </button>

              <input
                type="text"
                placeholder={attachmentPreview ? "Adicione uma legenda (opcional)..." : "Escreva uma mensagem..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-line, #2a2a26)',
                  background: 'var(--admin-soft, #242420)',
                  color: 'var(--admin-ink, #f7f7f2)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />

              <button
                type="submit"
                disabled={(!inputText.trim() && !attachmentPreview) || sending}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#e289a8',
                  color: '#fff',
                  cursor: (inputText.trim() || attachmentPreview) && !sending ? 'pointer' : 'not-allowed',
                  opacity: (inputText.trim() || attachmentPreview) && !sending ? 1 : 0.5,
                  flexShrink: 0,
                }}
              >
                {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--admin-muted, #8b8b83)', padding: '20px', textAlign: 'center' }}>
            <MessageSquare size={36} style={{ opacity: 0.25, marginBottom: '10px' }} />
            <span style={{ fontSize: '13px' }}>Selecione um contato para abrir a conversa</span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: PAUSAR IA (CLEAN & MINIMAL) */}
      {/* ============================================================ */}
      {showPauseModal && effectiveContact && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
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
              background: 'var(--admin-card, #181815)',
              borderRadius: '16px',
              border: '1px solid var(--admin-line, #2a2a26)',
              padding: '20px',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600 }}>
              Controle de Atendimento
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--admin-muted, #8b8b83)', margin: '0 0 16px 0' }}>
              {effectiveContact.name || 'Contato'} ({formatPhoneDisplay(effectiveContact.phone)})
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleToggleAi(true, 1)}
                disabled={pausingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-line, #2a2a26)',
                  background: 'var(--admin-soft, #242420)',
                  color: 'var(--admin-ink, #f7f7f2)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textAlign: 'left',
                }}
              >
                <span>Pausar IA por 1 hora</span>
                <Clock size={14} style={{ color: 'var(--admin-muted, #8b8b83)' }} />
              </button>

              <button
                type="button"
                onClick={() => handleToggleAi(true, 24)}
                disabled={pausingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-line, #2a2a26)',
                  background: 'var(--admin-soft, #242420)',
                  color: 'var(--admin-ink, #f7f7f2)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textAlign: 'left',
                }}
              >
                <span>Pausar IA por 24 horas</span>
                <Calendar size={14} style={{ color: 'var(--admin-muted, #8b8b83)' }} />
              </button>

              <button
                type="button"
                onClick={() => handleToggleAi(true, null)}
                disabled={pausingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-line, #2a2a26)',
                  background: 'var(--admin-soft, #242420)',
                  color: 'var(--admin-ink, #f7f7f2)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textAlign: 'left',
                }}
              >
                <span>Pausar Permanentemente (Manual)</span>
                <Shield size={14} style={{ color: 'var(--admin-muted, #8b8b83)' }} />
              </button>

              <button
                type="button"
                onClick={() => handleToggleAi(false)}
                disabled={pausingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  background: 'rgba(34, 197, 94, 0.08)',
                  color: '#16a34a',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'left',
                }}
              >
                <span>Reativar Atendimento da IA</span>
                <Play size={14} />
              </button>
            </div>

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowPauseModal(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--admin-muted, #8b8b83)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: NOVA CONVERSA */}
      {/* ============================================================ */}
      {showNewChatModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
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
              background: 'var(--admin-card, #181815)',
              borderRadius: '16px',
              border: '1px solid var(--admin-line, #2a2a26)',
              padding: '20px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600 }}>
              Nova Conversa
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--admin-muted, #8b8b83)', margin: '0 0 14px 0' }}>
              Digite o número do WhatsApp com DDD.
            </p>

            <form onSubmit={handleCreateNewChat} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="Nome do cliente (opcional)"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--admin-line, #2a2a26)',
                  background: 'var(--admin-soft, #242420)',
                  color: 'var(--admin-ink, #f7f7f2)',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              />

              <input
                type="tel"
                placeholder="Número: 51 98974-1970"
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                required
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--admin-line, #2a2a26)',
                  background: 'var(--admin-soft, #242420)',
                  color: 'var(--admin-ink, #f7f7f2)',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--admin-muted, #8b8b83)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#e289a8',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Iniciar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visualizador de Imagem Ampliada (Lightbox) */}
      {lightboxImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box',
          }}
          onClick={() => setLightboxImage(null)}
        >
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={lightboxImage}
              target="_blank"
              rel="noopener noreferrer"
              download="whatsapp_foto"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '12px',
                textDecoration: 'none',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
              }}
            >
              <Download size={14} /> Baixar Foto
            </a>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Fechar (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          <img
            src={lightboxImage}
            alt="Visualização da Imagem WhatsApp"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
            }}
          />
        </div>
      )}
    </div>
  );
}
