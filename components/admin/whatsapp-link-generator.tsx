'use client';

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Link2,
  Copy,
  Check,
  Download,
  ExternalLink,
  Trash2,
  Plus,
  QrCode as QrCodeIcon,
  Sparkles,
  Shuffle,
  BarChart3,
  RotateCcw,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

export interface ShortLinkItem {
  id: string;
  slug: string;
  title: string;
  target_url: string;
  phone?: string | null;
  message?: string | null;
  clicks_count: number;
  last_clicked_at?: string | null;
  is_active: boolean;
  created_at: string;
}

const COUNTRY_CODES = [
  { code: '55', name: 'Brasil (+55)' },
  { code: '1', name: 'Estados Unidos (+1)' },
  { code: '351', name: 'Portugal (+351)' },
  { code: '34', name: 'Espanha (+34)' },
  { code: '44', name: 'Reino Unido (+44)' },
  { code: '54', name: 'Argentina (+54)' },
  { code: '598', name: 'Uruguai (+598)' },
];

const PRESET_MESSAGES = [
  {
    label: 'Agendamento Geral',
    slug: 'agendar',
    title: 'Agendamento Geral WhatsApp',
    text: 'Olá, Lara! Gostaria de consultar os horários disponíveis para atendimento.',
  },
  {
    label: 'Promoção 1ª Visita (R$ 80)',
    slug: 'promo80',
    title: 'Promoção 1ª Visita (R$ 80)',
    text: 'Olá, Lara! Quero aproveitar a oferta especial de 1ª visita por R$ 80 para fazer minha extensão de cílios.',
  },
  {
    label: 'Dúvidas sobre Cílios',
    slug: 'duvidas',
    title: 'Dúvidas sobre Procedimentos',
    text: 'Olá, Lara! Gostaria de tirar algumas dúvidas sobre os procedimentos e cuidados.',
  },
  {
    label: 'Bio do Instagram',
    slug: 'bio',
    title: 'Link Oficial Bio Instagram',
    text: 'Olá, Lara! Vim pelo Instagram e quero agendar meu procedimento de cílios.',
  },
  {
    label: 'Ficha de Anamnese',
    slug: 'anamnese',
    title: 'Confirmação Ficha de Anamnese',
    text: 'Olá, Lara! Já preenchi minha ficha de anamnese no site e quero confirmar meu horário.',
  },
];

const QR_COLORS = [
  { label: 'Preto Clássico', dark: '#11110f', light: '#ffffff' },
  { label: 'Verde WhatsApp', dark: '#15803d', light: '#ffffff' },
  { label: 'Dourado / Âmbar', dark: '#995c00', light: '#ffffff' },
];

function formatPhoneDigits(val: string): string {
  return val.replace(/\D/g, '');
}

function sanitizeSlug(val: string): string {
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

function generateRandomSlug(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let res = 'w';
  for (let i = 0; i < 4; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export function WhatsAppLinkGenerator({
  defaultPhone = '',
}: {
  defaultPhone?: string;
}) {
  const [countryCode, setCountryCode] = useState('55');
  const [phone, setPhone] = useState(() => {
    const raw = defaultPhone.replace(/\D/g, '');
    return raw.startsWith('55') ? raw.slice(2) : raw;
  });
  const [message, setMessage] = useState(
    'Olá, Lara! Quero aproveitar a oferta especial de 1ª visita por R$ 80 para fazer minha extensão de cílios.'
  );

  // Shortlink states
  const [linkTitle, setLinkTitle] = useState('Promoção 1ª Visita (R$ 80)');
  const [slug, setSlug] = useState('promo80');
  const [siteOrigin, setSiteOrigin] = useState('https://laravarisa.com.br');

  // Customização de QR Code
  const [qrTargetMode, setQrTargetMode] = useState<'shortlink' | 'direct'>('shortlink');
  const [selectedColor, setSelectedColor] = useState(QR_COLORS[0]);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Estados de feedback
  const [copiedType, setCopiedType] = useState<'short' | 'direct' | string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Lista de shortlinks carregados pelo servidor
  const [shortLinks, setShortLinks] = useState<ShortLinkItem[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);

  // Detectar origem atual no cliente
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      setSiteOrigin(window.location.origin);
    }
  }, []);

  // Buscar links do banco de dados
  const loadShortLinks = useCallback(async () => {
    setIsLoadingLinks(true);
    try {
      const res = await fetch('/api/admin/short-links', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setShortLinks(data);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar shortlinks:', err);
    } finally {
      setIsLoadingLinks(false);
    }
  }, []);

  useEffect(() => {
    loadShortLinks();
  }, [loadShortLinks]);

  // Número completo normalizado
  const fullPhone = `${countryCode}${formatPhoneDigits(phone)}`;

  // Link Oficial direto wa.me
  const directWaUrl =
    fullPhone.length >= 8
      ? `https://wa.me/${fullPhone}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ''}`
      : '';

  // Shortlink final da marca
  const cleanSlug = sanitizeSlug(slug);
  const shortlinkUrl = cleanSlug ? `${siteOrigin}/w/${cleanSlug}` : '';

  // URL ativa para o QR Code
  const activeQrTargetUrl = qrTargetMode === 'shortlink' && shortlinkUrl ? shortlinkUrl : directWaUrl;

  // Gerar QR Code
  useEffect(() => {
    let active = true;
    const generateQr = async () => {
      if (!activeQrTargetUrl) return;
      try {
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, activeQrTargetUrl, {
          width: 512,
          margin: 2,
          color: {
            dark: selectedColor.dark,
            light: selectedColor.light,
          },
          errorCorrectionLevel: includeLogo ? 'H' : 'M',
        });

        if (includeLogo) {
          const ctx = qrCanvas.getContext('2d');
          if (ctx) {
            const logoImg = new Image();
            logoImg.crossOrigin = 'anonymous';
            logoImg.src = '/logo-emblem.png';
            await new Promise((resolve) => {
              logoImg.onload = resolve;
              logoImg.onerror = resolve;
            });

            if (logoImg.complete && logoImg.naturalWidth > 0) {
              const size = qrCanvas.width * 0.22;
              const x = (qrCanvas.width - size) / 2;
              const y = (qrCanvas.height - size) / 2;

              ctx.save();
              ctx.beginPath();
              ctx.arc(qrCanvas.width / 2, qrCanvas.height / 2, size / 1.7, 0, 2 * Math.PI);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.lineWidth = 4;
              ctx.strokeStyle = '#e2e2df';
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(qrCanvas.width / 2, qrCanvas.height / 2, size / 2, 0, 2 * Math.PI);
              ctx.closePath();
              ctx.clip();
              ctx.drawImage(logoImg, x, y, size, size);
              ctx.restore();
            }
          }
        }

        if (active) {
          setQrDataUrl(qrCanvas.toDataURL('image/png'));
        }
      } catch (err) {
        console.error('Erro ao gerar QR Code:', err);
      }
    };

    generateQr();
    return () => {
      active = false;
    };
  }, [activeQrTargetUrl, selectedColor, includeLogo]);

  const copyToClipboard = async (text: string, identifier: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      triggerHaptic('success');
      setCopiedType(identifier);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {}
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    triggerHaptic('medium');
    const a = document.createElement('a');
    a.href = qrDataUrl;
    const nameSuffix = cleanSlug ? `-${cleanSlug}` : '';
    a.download = `qrcode-whatsapp-lara-varisa${nameSuffix}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Salvar / Criar Shortlink no Banco de Dados
  const handleSaveShortLink = async () => {
    if (!directWaUrl) {
      setSaveStatus({ type: 'error', message: 'Preencha o telefone para criar o link.' });
      return;
    }
    if (!cleanSlug) {
      setSaveStatus({ type: 'error', message: 'Defina um slug válido (ex: promo, agendar).' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const payload = {
        title: linkTitle.trim() || `Shortlink /w/${cleanSlug}`,
        slug: cleanSlug,
        target_url: directWaUrl,
        phone: fullPhone,
        message: message.trim(),
        is_active: true,
      };

      const res = await fetch('/api/admin/short-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao salvar shortlink.');
      }

      triggerHaptic('success');
      setSaveStatus({ type: 'success', message: `Shortlink "/w/${cleanSlug}" criado e ativo!` });
      await loadShortLinks();
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: unknown) {
      triggerHaptic('medium');
      const msg = err instanceof Error ? err.message : 'Erro ao criar shortlink';
      setSaveStatus({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // Excluir Shortlink
  const handleDeleteShortLink = async (id: string, itemSlug: string) => {
    if (!confirm(`Deseja realmente remover o shortlink "/w/${itemSlug}"?`)) return;
    triggerHaptic('medium');
    try {
      const res = await fetch(`/api/admin/short-links/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setShortLinks((prev) => prev.filter((item) => item.id !== id));
      } else {
        const d = await res.json();
        alert(d.error || 'Erro ao excluir.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Carregar dados de um preset
  const applyPreset = (preset: (typeof PRESET_MESSAGES)[0]) => {
    triggerHaptic('light');
    setMessage(preset.text);
    setSlug(preset.slug);
    setLinkTitle(preset.title);
  };

  // Estatísticas agregadas
  const totalClicks = shortLinks.reduce((acc, item) => acc + (item.clicks_count || 0), 0);

  return (
    <div className="wa-link-gen-container">
      <style>{`
        .wa-link-gen-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-width: 0;
        }
        .wa-link-gen-grid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 960px) {
          .wa-link-gen-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* GRADE PRINCIPAL: CRIADOR DE SHORTLINKS & WHATSAPP + QR CODE */}
      <div className="wa-link-gen-grid">
        {/* CARD 1: FORMULÁRIO DO SHORTLINK & WHATSAPP */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#25d366', display: 'flex' }}>
                <Link2 size={20} />
              </span>
              <div>
                <p className="admin-kicker">SHORTLINKS & WHATSAPP</p>
                <h2
                  style={{
                    fontFamily: 'var(--font-body), sans-serif',
                    fontSize: '17px',
                    fontWeight: 600,
                    margin: 0,
                    textTransform: 'none',
                    letterSpacing: 'normal',
                  }}
                >
                  Criar Shortlink e Link WhatsApp
                </h2>
              </div>
            </div>

            {/* Badge de Métricas Rápidas */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'var(--admin-soft)',
                border: '1px solid var(--admin-line)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--admin-ink)',
              }}
            >
              <BarChart3 size={13} style={{ color: '#25d366' }} />
              <span>{totalClicks} cliques rastreados</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 1. SELEÇÃO DE MODELOS RÁPIDOS */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Sparkles size={13} style={{ color: '#cca352' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)' }}>
                  Modelos Prontos de Mensagem & Atalho:
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PRESET_MESSAGES.map((preset) => {
                  const isSelected = slug === preset.slug;
                  return (
                    <button
                      key={preset.slug}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={isSelected ? 'admin-primary' : 'admin-secondary'}
                      style={{
                        height: '32px',
                        minHeight: '32px',
                        padding: '0 12px',
                        fontSize: '12px',
                        borderRadius: '999px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. SLUG PERSONALIZADO DO SHORTLINK */}
            <div
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--admin-soft)',
                border: '1px solid var(--admin-line)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)' }}>
                  Shortlink Personalizado da Marca
                </label>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSlug(generateRandomSlug());
                  }}
                  className="admin-secondary"
                  style={{
                    height: '26px',
                    minHeight: '26px',
                    padding: '0 8px',
                    fontSize: '11px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Gerar código curto aleatório"
                >
                  <Shuffle size={11} />
                  <span>Gerar Aleatório</span>
                </button>
              </div>

              {/* Input com prefixo de domínio */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-line)',
                  background: 'var(--admin-input-bg)',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    background: 'var(--admin-soft)',
                    borderRight: '1px solid var(--admin-line)',
                    fontSize: '12px',
                    color: 'var(--admin-muted)',
                    fontFamily: 'monospace',
                    userSelect: 'none',
                  }}
                >
                  {siteOrigin.replace(/^https?:\/\//, '')}/w/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                  placeholder="promo80"
                  style={{
                    flex: 1,
                    height: '40px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--admin-ink)',
                    padding: '0 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>
                Exemplo de uso: na Bio do Instagram, Stories, anúncios ou panfletos impressos.
              </span>
            </div>

            {/* 3. NÚMERO DO WHATSAPP */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', marginBottom: '6px' }}>
                  País
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid var(--admin-line)',
                    background: 'var(--admin-input-bg)',
                    color: 'var(--admin-ink)',
                    padding: '0 10px',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', marginBottom: '6px' }}>
                  Número com DDD
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneDigits(e.target.value))}
                  placeholder="DDD + número"
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid var(--admin-line)',
                    background: 'var(--admin-input-bg)',
                    color: 'var(--admin-ink)',
                    padding: '0 14px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* 4. MENSAGEM */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)' }}>
                  Mensagem que a Cliente Enviará
                </label>
                <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>
                  {message.length} caracteres
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Escreva a mensagem pré-configurada..."
                style={{
                  width: '100%',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-line)',
                  background: 'var(--admin-input-bg)',
                  color: 'var(--admin-ink)',
                  padding: '10px 14px',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: 1.4,
                }}
              />
            </div>

            {/* 5. IDENTIFICAÇÃO DO LINK */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', marginBottom: '6px' }}>
                Nome / Identificação da Campanha
              </label>
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Ex: Bio Instagram, Anúncio Promo R$ 80, Flyer Recepção"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-line)',
                  background: 'var(--admin-input-bg)',
                  color: 'var(--admin-ink)',
                  padding: '0 14px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 6. LINKS GERADOS (SHORTLINK + LINK DIRETO) */}
            <div
              style={{
                padding: '16px',
                borderRadius: '14px',
                background: 'var(--admin-soft)',
                border: '1px solid var(--admin-line)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* LINHA 1: SHORTLINK EXCLUSIVO */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--admin-ink)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={12} style={{ color: '#25d366' }} />
                    Shortlink da Marca (Rastreia Cliques)
                  </span>
                  <span style={{ fontSize: '11px', color: '#25d366', fontWeight: 600 }}>
                    Redirecionamento Instantâneo
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    readOnly
                    value={shortlinkUrl || 'Defina um atalho acima'}
                    style={{
                      flex: '1 1 240px',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--admin-line)',
                      background: 'var(--admin-input-bg)',
                      color: 'var(--admin-ink)',
                      padding: '0 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => copyToClipboard(shortlinkUrl, 'short')}
                    disabled={!shortlinkUrl}
                    className="admin-primary"
                    style={{ height: '38px', minHeight: '38px', padding: '0 16px', fontSize: '12px' }}
                  >
                    {copiedType === 'short' ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedType === 'short' ? 'Copiado!' : 'Copiar Shortlink'}</span>
                  </button>

                  {shortlinkUrl && (
                    <a
                      href={shortlinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-secondary"
                      style={{
                        height: '38px',
                        minHeight: '38px',
                        padding: '0 12px',
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      title="Testar Shortlink"
                    >
                      <ExternalLink size={14} />
                      <span>Testar</span>
                    </a>
                  )}
                </div>
              </div>

              {/* LINHA 2: LINK DIRETO WA.ME */}
              <div style={{ borderTop: '1px solid var(--admin-line)', paddingTop: '12px' }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--admin-muted)', marginBottom: '6px' }}>
                  Link Direto Oficial (wa.me)
                </span>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    readOnly
                    value={directWaUrl || 'Preencha o número para gerar o link'}
                    style={{
                      flex: '1 1 240px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid var(--admin-line)',
                      background: 'var(--admin-input-bg)',
                      color: 'var(--admin-muted)',
                      padding: '0 12px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => copyToClipboard(directWaUrl, 'direct')}
                    disabled={!directWaUrl}
                    className="admin-secondary"
                    style={{ height: '34px', minHeight: '34px', padding: '0 12px', fontSize: '11px' }}
                  >
                    {copiedType === 'direct' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedType === 'direct' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BOTÃO DE SALVAR NO BANCO */}
            <div>
              <button
                type="button"
                onClick={handleSaveShortLink}
                disabled={isSaving || !cleanSlug || !directWaUrl}
                className="admin-primary"
                style={{ width: '100%', height: '42px', minHeight: '42px', fontSize: '13px', justifyContent: 'center' }}
              >
                {isSaving ? (
                  <>
                    <RotateCcw size={15} className="animate-spin" />
                    <span>Salvando Shortlink...</span>
                  </>
                ) : (
                  <>
                    <Plus size={15} />
                    <span>Criar e Ativar Shortlink (/w/{cleanSlug || '...'})</span>
                  </>
                )}
              </button>

              {saveStatus && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    background: saveStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: saveStatus.type === 'success' ? '#15803d' : '#b91c1c',
                    border: `1px solid ${saveStatus.type === 'success' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {saveStatus.type === 'success' ? <Check size={14} /> : null}
                  <span>{saveStatus.message}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CARD 2: PREVIEW DO QR CODE */}
        <section
          className="admin-panel"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
        >
          <div className="admin-panel-head" style={{ width: '100%', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#25d366', display: 'flex' }}>
                <QrCodeIcon size={20} />
              </span>
              <div style={{ textAlign: 'left' }}>
                <p className="admin-kicker">QR CODE PROFISSIONAL</p>
                <h2
                  style={{
                    fontFamily: 'var(--font-body), sans-serif',
                    fontSize: '17px',
                    fontWeight: 600,
                    margin: 0,
                    textTransform: 'none',
                    letterSpacing: 'normal',
                  }}
                >
                  QR Code da Campanha
                </h2>
              </div>
            </div>
          </div>

          {/* Seleção do Destino do QR Code */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              padding: '4px',
              borderRadius: '10px',
              background: 'var(--admin-soft)',
              border: '1px solid var(--admin-line)',
              marginBottom: '14px',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setQrTargetMode('shortlink')}
              style={{
                flex: 1,
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                background: qrTargetMode === 'shortlink' ? 'var(--admin-card)' : 'transparent',
                color: 'var(--admin-ink)',
                fontSize: '11px',
                fontWeight: qrTargetMode === 'shortlink' ? 600 : 400,
                boxShadow: qrTargetMode === 'shortlink' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              Shortlink (Rastreado)
            </button>
            <button
              type="button"
              onClick={() => setQrTargetMode('direct')}
              style={{
                flex: 1,
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                background: qrTargetMode === 'direct' ? 'var(--admin-card)' : 'transparent',
                color: 'var(--admin-ink)',
                fontSize: '11px',
                fontWeight: qrTargetMode === 'direct' ? 600 : 400,
                boxShadow: qrTargetMode === 'direct' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              Link Direto (wa.me)
            </button>
          </div>

          {/* Canvas do QR Code */}
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              background: '#ffffff',
              border: '1px solid var(--admin-line)',
              display: 'inline-block',
              boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
              marginBottom: '16px',
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code WhatsApp"
                width={200}
                height={200}
                style={{ display: 'block', width: '200px', height: '200px' }}
              />
            ) : (
              <div
                style={{
                  width: '200px',
                  height: '200px',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#888',
                  fontSize: '12px',
                }}
              >
                Gerando QR Code...
              </div>
            )}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Seletor de Cores */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {QR_COLORS.map((color) => (
                <button
                  key={color.label}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    borderRadius: '999px',
                    border: `1px solid ${selectedColor.label === color.label ? 'var(--admin-ink)' : 'var(--admin-line)'}`,
                    background: selectedColor.label === color.label ? 'var(--admin-soft)' : 'transparent',
                    color: 'var(--admin-ink)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color.dark }} />
                  <span>{color.label}</span>
                </button>
              ))}
            </div>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--admin-ink)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={(e) => setIncludeLogo(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Incluir emblema Lara Varisa no centro</span>
            </label>

            <button
              type="button"
              onClick={handleDownloadQr}
              disabled={!qrDataUrl}
              className="admin-secondary"
              style={{ width: '100%', height: '38px', minHeight: '38px', fontSize: '12px', marginTop: '4px' }}
            >
              <Download size={14} />
              <span>Baixar Imagem do QR Code (PNG)</span>
            </button>
          </div>
        </section>
      </div>

      {/* CARD 3: CATÁLOGO DE SHORTLINKS SALVOS NO BANCO DE DADOS */}
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">CATÁLOGO DE SHORTLINKS & CAMPANHAS</p>
            <h2
              style={{
                fontFamily: 'var(--font-body), sans-serif',
                fontSize: '17px',
                fontWeight: 600,
                margin: 0,
                textTransform: 'none',
                letterSpacing: 'normal',
              }}
            >
              Shortlinks Criados do Estúdio ({shortLinks.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={() => loadShortLinks()}
            className="admin-secondary"
            style={{ height: '32px', minHeight: '32px', padding: '0 12px', fontSize: '11px' }}
            title="Atualizar métricas de cliques"
          >
            <RotateCcw size={12} className={isLoadingLinks ? 'animate-spin' : ''} />
            <span>Atualizar Métricas</span>
          </button>
        </div>

        {shortLinks.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--admin-muted)', fontSize: '13px' }}>
            {isLoadingLinks
              ? 'Carregando shortlinks...'
              : 'Nenhum shortlink cadastrado ainda. Use o gerador acima para criar links como "/w/promo80" ou "/w/bio" para suas campanhas.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--admin-line)',
                    textAlign: 'left',
                    color: 'var(--admin-muted)',
                    fontSize: '11px',
                  }}
                >
                  <th style={{ padding: '10px 14px' }}>CAMPANHA & SHORTLINK</th>
                  <th style={{ padding: '10px 14px' }}>CLIQUES RASTREADOS</th>
                  <th style={{ padding: '10px 14px' }}>MENSAGEM PREVISTA</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {shortLinks.map((item) => {
                  const itemUrl = `${siteOrigin}/w/${item.slug}`;
                  const isCopied = copiedType === item.id;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--admin-line)' }}>
                      {/* Campanha & Slug */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--admin-ink)' }}>{item.title}</span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                color: '#25d366',
                                background: 'var(--admin-soft)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--admin-line)',
                              }}
                            >
                              /w/{item.slug}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(itemUrl, item.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                color: 'var(--admin-muted)',
                                padding: '2px',
                                display: 'flex',
                              }}
                              title="Copiar URL completa"
                            >
                              {isCopied ? <Check size={13} style={{ color: '#25d366' }} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Cliques & Estatísticas */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: item.clicks_count > 0 ? 'var(--admin-ink)' : 'var(--admin-muted)',
                            }}
                          >
                            {item.clicks_count > 0 ? `🔥 ${item.clicks_count} cliques` : '0 cliques'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>
                            {item.last_clicked_at
                              ? `Último: ${new Date(item.last_clicked_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}`
                              : 'Aguardando cliques'}
                          </span>
                        </div>
                      </td>

                      {/* Mensagem / Destino */}
                      <td
                        style={{
                          padding: '12px 14px',
                          color: 'var(--admin-muted)',
                          maxWidth: '260px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '12px',
                        }}
                      >
                        {item.message || '(Sem mensagem configurada)'}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(itemUrl, item.id)}
                            className="admin-secondary"
                            style={{ height: '30px', minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                            title="Copiar shortlink completo"
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setSlug(item.slug);
                              setLinkTitle(item.title);
                              if (item.message) setMessage(item.message);
                              if (item.phone) {
                                const raw = item.phone.replace(/\D/g, '');
                                setPhone(raw.startsWith('55') ? raw.slice(2) : raw);
                              }
                              setQrTargetMode('shortlink');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="admin-secondary"
                            style={{ height: '30px', minHeight: '30px', padding: '0 8px', fontSize: '11px' }}
                            title="Carregar no Gerador de QR Code"
                          >
                            <QrCodeIcon size={12} />
                          </button>

                          <a
                            href={itemUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-secondary"
                            style={{
                              height: '30px',
                              minHeight: '30px',
                              padding: '0 8px',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Testar Shortlink no WhatsApp"
                          >
                            <ExternalLink size={12} />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDeleteShortLink(item.id, item.slug)}
                            className="admin-secondary"
                            style={{
                              height: '30px',
                              minHeight: '30px',
                              padding: '0 8px',
                              fontSize: '11px',
                              color: '#b91c1c',
                            }}
                            title="Excluir Shortlink"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
