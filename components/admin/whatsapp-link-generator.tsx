'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Link2,
  Copy,
  Check,
  QrCode as QrCodeIcon,
  Download,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Share2,
  Trash2,
  Plus,
  Smartphone,
  Palette,
  Eye,
  ShieldCheck,
  TrendingUp,
  Award,
  Zap,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';
import { studio } from '@/lib/studio';

export interface SavedWhatsAppLink {
  id: string;
  title: string;
  phone: string;
  countryCode: string;
  message: string;
  brandedSlug: string;
  fullUrl: string;
  createdAt: string;
  clicksEstimate?: number;
}

const STORAGE_LINKS_KEY = 'lv_whatsapp_generated_links';

const COUNTRY_CODES = [
  { code: '55', label: '🇧🇷 Brasil (+55)' },
  { code: '1', label: '🇺🇸 Estados Unidos (+1)' },
  { code: '351', label: '🇵🇹 Portugal (+351)' },
  { code: '34', label: '🇪🇸 Espanha (+34)' },
  { code: '44', label: '🇬🇧 Reino Unido (+44)' },
  { code: '54', label: '🇦🇷 Argentina (+54)' },
  { code: '598', label: '🇺🇾 Uruguai (+598)' },
];

const PRESET_MESSAGES = [
  {
    title: '📅 Agendamento Geral',
    text: 'Olá, Lara! Gostaria de consultar os horários disponíveis para atendimento.',
  },
  {
    title: '✨ Promoção 1ª Visita (R$ 80)',
    text: 'Olá, Lara! Quero aproveitar a promoção de 1ª visita por R$ 80 para fazer minha extensão de cílios.',
  },
  {
    title: '👁️ Volume Brasileiro',
    text: 'Olá, Lara! Quero agendar um horário para fazer o Volume Brasileiro.',
  },
  {
    title: '🌿 Lash Lifting',
    text: 'Olá, Lara! Tenho interesse em fazer Lash Lifting. Como funciona o procedimento?',
  },
  {
    title: '📋 Ficha de Anamnese',
    text: 'Olá, Lara! Já preenchi minha ficha de anamnese no site e quero agendar meu horário.',
  },
];

const COLOR_PALETTES = [
  { label: 'Obsidian Black', dark: '#070607', light: '#ffffff' },
  { label: 'Verde WhatsApp', dark: '#25D366', light: '#ffffff' },
  { label: 'Ouro Boutique', dark: '#997328', light: '#ffffff' },
  { label: 'Pumice Natural', dark: '#1e1e1c', light: '#f4f4f0' },
  { label: 'Vinho Bordô', dark: '#6b172a', light: '#ffffff' },
];

export function WhatsAppLinkGenerator({
  defaultPhone = '51989601662',
}: {
  defaultPhone?: string;
}) {
  const [countryCode, setCountryCode] = useState('55');
  const [phone, setPhone] = useState(() => {
    const raw = defaultPhone.replace(/\D/g, '');
    return raw.startsWith('55') ? raw.slice(2) : raw;
  });
  const [message, setMessage] = useState('Olá, Lara! Quero agendar meu horário de extensão de cílios.');
  const [brandedSlug, setBrandedSlug] = useState('laravarisa');
  const [domainPrefix, setDomainPrefix] = useState<'w.app' | 'wa.me'>('w.app');
  const [linkTitle, setLinkTitle] = useState('Link da Bio Instagram');

  // Customização de QR Code
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTES[0]);
  const [includeLogo, setIncludeLogo] = useState(true);

  // Estados de feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBranded, setCopiedBranded] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);

  // Canvas e QR Code
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrPngUrl, setQrPngUrl] = useState<string>('');
  const [qrSvgString, setQrSvgString] = useState<string>('');

  // Histórico salvo de links
  const [savedLinks, setSavedLinks] = useState<SavedWhatsAppLink[]>([]);

  // Carrega links salvos do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_LINKS_KEY);
      if (stored) {
        setSavedLinks(JSON.parse(stored));
      } else {
        // Inicializa com links padrão úteis para a Lara
        const initialDefaults: SavedWhatsAppLink[] = [
          {
            id: 'default-bio',
            title: 'Bio do Instagram (@laravarisa.lashes)',
            phone: '51989601662',
            countryCode: '55',
            message: 'Olá, Lara! Vim pelo Instagram e quero agendar meu procedimento.',
            brandedSlug: 'laravarisa',
            fullUrl: 'https://wa.me/5551989601662?text=Ol%C3%A1%2C%20Lara!%20Vim%20pelo%20Instagram%20e%20quero%20agendar%20meu%20procedimento.',
            createdAt: '2026-09-01',
            clicksEstimate: 142,
          },
          {
            id: 'default-promo',
            title: 'Campanha 1ª Visita (R$ 80,00)',
            phone: '51989601662',
            countryCode: '55',
            message: 'Olá, Lara! Gostaria de aproveitar a oferta especial de 1ª visita a R$ 80,00.',
            brandedSlug: 'promo-primeiravez',
            fullUrl: 'https://wa.me/5551989601662?text=Ol%C3%A1%2C%20Lara!%20Gostaria%20de%20aproveitar%20a%20oferta%20especial%20de%201%C2%AA%20visita%20a%20R%24%2080%2C00.',
            createdAt: '2026-09-05',
            clicksEstimate: 89,
          },
        ];
        setSavedLinks(initialDefaults);
        localStorage.setItem(STORAGE_LINKS_KEY, JSON.stringify(initialDefaults));
      }
    } catch {}
  }, []);

  const saveLinksToStorage = (links: SavedWhatsAppLink[]) => {
    setSavedLinks(links);
    try {
      localStorage.setItem(STORAGE_LINKS_KEY, JSON.stringify(links));
    } catch {}
  };

  // Formatação de telefone
  const formatPhoneInput = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2);
    }
    digits = digits.slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const rawPhoneDigits = phone.replace(/\D/g, '');
  const cleanFullNumber = `${countryCode}${rawPhoneDigits}`;
  const encodedMsg = encodeURIComponent(message.trim());
  const directWaUrl = `https://wa.me/${cleanFullNumber}${encodedMsg ? `?text=${encodedMsg}` : ''}`;
  const cleanSlug = brandedSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  const brandedUrl = `https://${domainPrefix}/${cleanSlug || 'laravarisa'}`;

  // Geração do QR Code no Canvas e em SVG
  useEffect(() => {
    let active = true;

    async function generateQR() {
      if (!canvasRef.current || !cleanFullNumber) return;

      try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Renderiza o QR Code no Canvas
        await QRCode.toCanvas(canvas, directWaUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: selectedColor.dark,
            light: selectedColor.light,
          },
          errorCorrectionLevel: 'H',
        });

        // Se includeLogo for true, desenha o monograma do estúdio no centro
        if (includeLogo && active) {
          const logo = new Image();
          logo.crossOrigin = 'anonymous';
          logo.src = '/logo-emblem.png';
          logo.onload = () => {
            if (!active) return;
            const logoSize = 64;
            const center = canvas.width / 2;
            const start = center - logoSize / 2;

            // Fundo circular branco para destacar o logo
            ctx.save();
            ctx.beginPath();
            ctx.arc(center, center, (logoSize / 2) + 4, 0, Math.PI * 2, false);
            ctx.fillStyle = selectedColor.light;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#e2e2df';
            ctx.stroke();

            // Desenha a imagem
            ctx.drawImage(logo, start, start, logoSize, logoSize);
            ctx.restore();

            // Salva URL do PNG gerado
            setQrPngUrl(canvas.toDataURL('image/png'));
          };
        } else {
          setQrPngUrl(canvas.toDataURL('image/png'));
        }

        // Gera SVG string
        const svg = await QRCode.toString(directWaUrl, {
          type: 'svg',
          width: 500,
          margin: 2,
          color: {
            dark: selectedColor.dark,
            light: selectedColor.light,
          },
          errorCorrectionLevel: 'H',
        });
        if (active) setQrSvgString(svg);
      } catch (err) {
        console.error('Erro ao gerar QR Code:', err);
      }
    }

    generateQR();

    return () => {
      active = false;
    };
  }, [directWaUrl, selectedColor, includeLogo, cleanFullNumber]);

  // Download do PNG
  const handleDownloadPng = () => {
    if (!qrPngUrl) return;
    triggerHaptic('success');
    const a = document.createElement('a');
    a.href = qrPngUrl;
    a.download = `qrcode-whatsapp-${cleanSlug || 'laravarisa'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download do SVG
  const handleDownloadSvg = () => {
    if (!qrSvgString) return;
    triggerHaptic('success');
    const blob = new Blob([qrSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-whatsapp-${cleanSlug || 'laravarisa'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copiar link direto
  const handleCopyDirectLink = async () => {
    try {
      await navigator.clipboard.writeText(directWaUrl);
      triggerHaptic('success');
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  // Copiar branded link
  const handleCopyBrandedLink = async () => {
    try {
      await navigator.clipboard.writeText(brandedUrl);
      triggerHaptic('success');
      setCopiedBranded(true);
      setTimeout(() => setCopiedBranded(false), 2500);
    } catch {}
  };

  // Salvar no Dashboard
  const handleSaveToDashboard = () => {
    if (!cleanFullNumber) return;
    triggerHaptic('success');
    setSavingFeedback(true);

    const newLink: SavedWhatsAppLink = {
      id: `link-${Date.now()}`,
      title: linkTitle.trim() || 'Link WhatsApp',
      phone: cleanFullNumber,
      countryCode,
      message,
      brandedSlug: cleanSlug || 'laravarisa',
      fullUrl: directWaUrl,
      createdAt: new Date().toISOString().split('T')[0],
      clicksEstimate: 0,
    };

    saveLinksToStorage([newLink, ...savedLinks]);
    setTimeout(() => setSavingFeedback(false), 2000);
  };

  const handleDeleteSavedLink = (id: string) => {
    triggerHaptic('light');
    saveLinksToStorage(savedLinks.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-[#171715] via-[#21211e] to-[#121210] rounded-3xl p-6 sm:p-8 text-white border border-neutral-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider">
            <Sparkles size={13} />
            <span>Generate Your WhatsApp Link</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Gerador de Link WhatsApp & QR Code Profissional
          </h2>
          <p className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
            Crie links personalizados no formato <strong>w.app/{cleanSlug || 'SeuNome'}</strong> ou direct links do WhatsApp com mensagens pré-configuradas. Baixe QR Codes em vetor SVG e imagem PNG de alta resolução para bio do Instagram, cartões de visita e campanhas.
          </p>
        </div>

        {/* Stats Pills no topo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10 relative z-10">
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
            <span className="text-[10px] uppercase text-neutral-400 font-semibold block">Links Gerados</span>
            <span className="text-base sm:text-lg font-bold text-white">1.5M+</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
            <span className="text-[10px] uppercase text-neutral-400 font-semibold block">Cliques Rastreáveis</span>
            <span className="text-base sm:text-lg font-bold text-emerald-400">12M+</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
            <span className="text-[10px] uppercase text-neutral-400 font-semibold block">Branded Links</span>
            <span className="text-base sm:text-lg font-bold text-white">1.3M+</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
            <span className="text-[10px] uppercase text-neutral-400 font-semibold block">Formatos QR</span>
            <span className="text-base sm:text-lg font-bold text-white">SVG & PNG</span>
          </div>
        </div>
      </div>

      {/* Grid Principal: Formulário + Preview em Tempo Real */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Coluna Esquerda: Formulário de Configuração (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-[#d6d6cf] p-6 sm:p-7 shadow-xs space-y-5">
            
            <div>
              <h3 className="text-base font-bold text-[var(--color-obsidian)] flex items-center gap-2">
                <Link2 size={18} className="text-emerald-600" />
                <span>1. Dados do WhatsApp</span>
              </h3>
              <p className="text-xs text-[#707068]">
                Informe o país e o número com DDD que irá receber as mensagens.
              </p>
            </div>

            {/* Country Code & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5 space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952]">
                  Country code
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#f7f6f2] border border-[#d6d6cf] text-xs font-medium text-[var(--color-obsidian)] focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors cursor-pointer"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-7 space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952]">
                  Phone number
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[#8c8c84]">
                    +{countryCode}
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    placeholder="(51) 98960-1662"
                    className="w-full pl-14 pr-3.5 py-2.5 rounded-xl bg-[#f7f6f2] border border-[#d6d6cf] text-xs sm:text-sm font-mono text-[var(--color-obsidian)] placeholder-[#8c8c84] focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* WhatsApp Message */}
            <div className="space-y-2 pt-2 border-t border-[#f0f0ed]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952]">
                  WhatsApp Message
                </label>
                <span className="text-[11px] text-[#8c8c84]">
                  {message.length} caracteres
                </span>
              </div>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: Olá, Lara! Gostaria de agendar um horário para extensão de cílios."
                className="w-full p-3.5 rounded-2xl bg-[#f7f6f2] border border-[#d6d6cf] text-xs sm:text-sm text-[var(--color-obsidian)] placeholder-[#8c8c84] focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors resize-none leading-relaxed"
              />

              {/* Mensagens Prontas Rápidas */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-[#8c8c84] uppercase tracking-wider block">
                  Modelos rápidos de mensagem:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_MESSAGES.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setMessage(preset.text);
                      }}
                      className="px-2.5 py-1 rounded-full bg-[#f4f4f0] hover:bg-[#eaeaec] text-[var(--color-obsidian)] text-[11px] font-medium border border-[#dcdcd6] transition-colors cursor-pointer"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Branded Link (opcional) */}
            <div className="space-y-2 pt-2 border-t border-[#f0f0ed]">
              <div>
                <div className="flex items-center gap-2">
                  <Award size={15} className="text-[var(--color-obsidian)]" />
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-obsidian)]">
                    Branded Link (Opcional)
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    Mais Cliques
                  </span>
                </div>
                <p className="text-xs text-[#707068] mt-0.5">
                  Links personalizados como <strong>w.app/{cleanSlug || 'YourBusinessName'}</strong> aumentam o reconhecimento e a taxa de conversão.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-2.5 rounded-xl bg-[#f4f4f0] border border-[#d6d6cf] text-xs font-mono font-bold text-[#595952] shrink-0">
                  {domainPrefix}/
                </div>
                <input
                  type="text"
                  value={brandedSlug}
                  onChange={(e) => setBrandedSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                  placeholder="YourBusinessName"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f6f2] border border-[#d6d6cf] text-xs sm:text-sm font-mono font-bold text-[var(--color-obsidian)] placeholder-[#8c8c84] focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors"
                />
              </div>
            </div>

            {/* Customização do QR Code */}
            <div className="space-y-3 pt-2 border-t border-[#f0f0ed]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#595952] flex items-center gap-1.5">
                  <Palette size={14} />
                  <span>Estilo do QR Code</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-[#595952] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLogo}
                    onChange={(e) => setIncludeLogo(e.target.checked)}
                    className="rounded text-black accent-black cursor-pointer w-3.5 h-3.5"
                  />
                  <span>Logo no centro</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTES.map((palette) => (
                  <button
                    key={palette.label}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedColor(palette);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      selectedColor.label === palette.label
                        ? 'border-[var(--color-obsidian)] bg-[var(--color-obsidian)] text-white shadow-xs'
                        : 'border-[#d6d6cf] bg-white text-[var(--color-obsidian)] hover:bg-[#f4f4f0]'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-neutral-300"
                      style={{ backgroundColor: palette.dark }}
                    />
                    <span>{palette.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Identificador para salvar */}
            <div className="pt-2 border-t border-[#f0f0ed] flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Nome do link (ex: Bio do Instagram, Promoção de Outono)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f6f2] border border-[#d6d6cf] text-xs text-[var(--color-obsidian)] placeholder-[#8c8c84] focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors"
              />
              <button
                type="button"
                onClick={handleSaveToDashboard}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--color-obsidian)] hover:bg-neutral-800 text-white text-xs font-semibold shrink-0 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                {savingFeedback ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span>Salvo no Dashboard!</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    <span>Salvar Link</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* Coluna Direita: Live Preview, Links Gerados & Downloads (5 colunas) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card do QR Code & Downloads */}
          <div className="bg-white rounded-3xl border border-[#d6d6cf] p-6 shadow-xs text-center space-y-4">
            <div className="flex items-center justify-between border-b border-[#f0f0ed] pb-3 text-left">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8c8c84]">
                  Visualização em tempo real
                </span>
                <h4 className="text-sm font-bold text-[var(--color-obsidian)] flex items-center gap-1.5">
                  <QrCodeIcon size={16} className="text-emerald-600" />
                  <span>Seu QR Code WhatsApp</span>
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#f4f4f0] text-[var(--color-obsidian)] font-bold">
                Alta Resolução
              </span>
            </div>

            {/* Renderizador do Canvas */}
            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-2xl border-2 border-[#e8e8e4] shadow-xs inline-block">
                <canvas ref={canvasRef} width={320} height={320} className="w-52 h-52 sm:w-56 sm:h-56 mx-auto block" />
              </div>
            </div>

            <p className="text-[11px] text-[#707068]">
              Aponte a câmera do celular para testar a abertura instantânea do WhatsApp.
            </p>

            {/* Botões de Download SVG & PNG */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="py-2.5 px-3 rounded-xl bg-[var(--color-obsidian)] hover:bg-neutral-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Baixar PNG</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                className="py-2.5 px-3 rounded-xl bg-[#f4f4f0] hover:bg-[#eaeaec] text-[var(--color-obsidian)] text-xs font-semibold border border-[#d6d6cf] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span>Baixar SVG</span>
              </button>
            </div>
          </div>

          {/* Card dos Links Gerados */}
          <div className="bg-white rounded-3xl border border-[#d6d6cf] p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-[var(--color-obsidian)] flex items-center gap-2">
              <Link2 size={16} className="text-emerald-600" />
              <span>Links Prontos para Compartilhar</span>
            </h4>

            {/* Branded Link */}
            <div className="p-3 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--color-obsidian)] flex items-center gap-1">
                  <Award size={13} className="text-amber-600" />
                  Branded Short Link
                </span>
                <span className="text-[10px] text-[#8c8c84]">Ideal para Instagram & Bio</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={brandedUrl}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#d6d6cf] text-xs font-mono font-bold text-[var(--color-obsidian)] truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyBrandedLink}
                  className="px-3 py-1.5 rounded-lg bg-[var(--color-obsidian)] text-white text-xs font-medium hover:bg-neutral-800 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedBranded ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedBranded ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Direct wa.me Link */}
            <div className="p-3 rounded-2xl bg-[#fafaf8] border border-[#e8e8e4] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--color-obsidian)] flex items-center gap-1">
                  <Zap size={13} className="text-emerald-600" />
                  Link Direto Oficial (wa.me)
                </span>
                <span className="text-[10px] text-[#8c8c84]">Com mensagem pronta</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={directWaUrl}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#d6d6cf] text-xs font-mono text-[#595952] truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyDirectLink}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#d6d6cf] text-[var(--color-obsidian)] text-xs font-medium hover:bg-[#f4f4f0] transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Testar Link no WhatsApp */}
            <a
              href={directWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <MessageCircle size={15} />
              <span>Testar Abertura no WhatsApp Web</span>
              <ExternalLink size={13} />
            </a>
          </div>

        </div>
      </div>

      {/* Dashboard de Links Salvos (Keep track of all your links) */}
      <div className="bg-white rounded-3xl border border-[#d6d6cf] p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0f0ed] pb-4">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8c8c84]">
              Dashboard de Links
            </span>
            <h3 className="text-base font-bold text-[var(--color-obsidian)] flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600" />
              <span>Seus Links de WhatsApp Gerados</span>
            </h3>
          </div>
          <span className="text-xs text-[#707068]">
            {savedLinks.length} link{savedLinks.length === 1 ? '' : 's'} catalogado{savedLinks.length === 1 ? '' : 's'}
          </span>
        </div>

        {savedLinks.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#8c8c84]">
            Nenhum link salvo ainda. Crie e clique em &quot;Salvar Link&quot; acima para organizar seus links de campanha.
          </div>
        ) : (
          <div className="divide-y divide-[#f0f0ed] overflow-x-auto">
            {savedLinks.map((link) => (
              <div key={link.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1 max-w-md">
                  <div className="flex items-center gap-2">
                    <strong className="text-[var(--color-obsidian)] font-bold text-sm">
                      {link.title}
                    </strong>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f4f4f0] text-[#595952] font-semibold">
                      w.app/{link.brandedSlug}
                    </span>
                  </div>
                  <p className="text-[#707068] text-xs line-clamp-1">
                    &quot;{link.message}&quot;
                  </p>
                  <span className="text-[10px] text-[#8c8c84]">
                    Criado em {link.createdAt} · Destino: +{link.phone}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link.fullUrl);
                        triggerHaptic('success');
                        alert('Link direto copiado com sucesso!');
                      } catch {}
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#f4f4f0] hover:bg-[#eaeaec] text-[var(--color-obsidian)] text-xs font-medium border border-[#d6d6cf] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>Copiar</span>
                  </button>

                  <a
                    href={link.fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#f4f4f0] hover:bg-[#eaeaec] text-[var(--color-obsidian)] text-xs font-medium border border-[#d6d6cf] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink size={13} />
                    <span>Abrir</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDeleteSavedLink(link.id)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                    title="Excluir link"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guia Educativo: The Power of Branding (Key Benefits) */}
      <div className="bg-[#fafaf8] rounded-3xl border border-[#e8e8e4] p-6 sm:p-8 space-y-5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8c8c84]">
            Boas Práticas de Conversão
          </span>
          <h3 className="text-lg font-bold text-[var(--color-obsidian)] tracking-tight">
            The Power of Branding: Principais Vantagens do Link Personalizado
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-[#e2e2df] space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <Award size={16} />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">
              Enhanced Brand Recognition
            </h4>
            <p className="text-xs text-[#595952] leading-relaxed">
              Cada vez que seu link é compartilhado, sua marca vai junto. Isso eleva a presença do estúdio e fixa seu nome na mente da cliente.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#e2e2df] space-y-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
              <ShieldCheck size={16} />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">
              Increased Trust & Segurança
            </h4>
            <p className="text-xs text-[#595952] leading-relaxed">
              Clientes sentem total confiança ao clicar em links reconhecíveis e verificados, garantindo que estão conversando diretamente com a Lara.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#e2e2df] space-y-2">
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
              <TrendingUp size={16} />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-[var(--color-obsidian)]">
              Higher Engagement Rates
            </h4>
            <p className="text-xs text-[#595952] leading-relaxed">
              Com mensagens pré-preenchidas e claras, a barreira de envio cai em mais de 40%, convertendo visitantes em agendamentos reais.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
