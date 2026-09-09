'use client';

import { useState } from 'react';
import {
  Palette,
  Type,
  Image as ImageIcon,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Check,
  Eye,
  MapPin,
  Clock3,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

export interface BookingCustomizerProps {
  settings: Record<string, any>;
  disabled?: boolean;
}

export const THEME_PRESETS = [
  {
    id: 'classic-noir',
    name: 'Lara Varisa Classic (Original)',
    desc: 'Fundo Pumice suave, Preto Obsidian e Ouro nobre',
    bg: '#e7e7e2',
    card: '#ffffff',
    primary: '#121211',
    accent: '#cca352',
    text: '#121211',
    border: '#cfcfc9',
    fontHeading: 'Anton',
    fontBody: 'DM Sans',
  },
  {
    id: 'dark-luxury',
    name: 'Dark Noir Luxury',
    desc: 'Preto profundo acetinado, cartões grafite e ouro radiante',
    bg: '#0e0e0d',
    card: '#181816',
    primary: '#cca352',
    accent: '#e6c875',
    text: '#f5f5f0',
    border: '#2a2a26',
    fontHeading: 'Playfair Display',
    fontBody: 'Plus Jakarta Sans',
  },
  {
    id: 'champagne-nude',
    name: 'Champagne & Nude',
    desc: 'Tons quentes de nude, seda champagne e marfim boutique',
    bg: '#f4efe8',
    card: '#ffffff',
    primary: '#2b231c',
    accent: '#b88655',
    text: '#2b231c',
    border: '#e4dcd2',
    fontHeading: 'Cinzel',
    fontBody: 'DM Sans',
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold Glow',
    desc: 'Estética feminina refinada com detalhes em ouro rosé',
    bg: '#f9f3f3',
    card: '#ffffff',
    primary: '#261517',
    accent: '#c47d85',
    text: '#261517',
    border: '#eddada',
    fontHeading: 'Cormorant Garamond',
    fontBody: 'Plus Jakarta Sans',
  },
  {
    id: 'emerald-luxe',
    name: 'Emerald Lash Studio',
    desc: 'Grafite noturno com toque esmeralda joia e ouro',
    bg: '#0c1410',
    card: '#13211b',
    primary: '#2ea069',
    accent: '#48c788',
    text: '#f0f7f3',
    border: '#20392f',
    fontHeading: 'Montserrat',
    fontBody: 'Inter',
  },
];

export const HEADING_FONTS = [
  { id: 'Anton', name: 'Anton (Impactante Original)' },
  { id: 'Playfair Display', name: 'Playfair Display (Editorial Luxo)' },
  { id: 'Cinzel', name: 'Cinzel (Romano Elegante / Jóia)' },
  { id: 'Montserrat', name: 'Montserrat (Moderno Geométrico)' },
  { id: 'Cormorant Garamond', name: 'Cormorant Garamond (Alta Moda)' },
  { id: 'Outfit', name: 'Outfit (Modernista Sofisticado)' },
  { id: 'Inter', name: 'Inter (Minimalista Contemporâneo)' },
];

export const BODY_FONTS = [
  { id: 'DM Sans', name: 'DM Sans (Original Refinado)' },
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans (Design Clean)' },
  { id: 'Inter', name: 'Inter (Máxima Legibilidade)' },
  { id: 'Poppins', name: 'Poppins (Arredondado Amigável)' },
  { id: 'Montserrat', name: 'Montserrat (Geométrico)' },
];

export function BookingCustomizer({ settings, disabled = false }: BookingCustomizerProps) {
  // Estados locais sincronizados com as configurações
  const [theme, setTheme] = useState(settings?.booking_theme || 'classic-noir');
  const [bgColor, setBgColor] = useState(settings?.booking_bg_color || '#e7e7e2');
  const [cardBg, setCardBg] = useState(settings?.booking_card_bg || '#ffffff');
  const [primaryColor, setPrimaryColor] = useState(settings?.booking_primary_color || '#121211');
  const [accentColor, setAccentColor] = useState(settings?.booking_accent_color || '#cca352');
  const [textColor, setTextColor] = useState(settings?.booking_text_color || '#121211');
  const [borderColor, setBorderColor] = useState(settings?.booking_border_color || '#cfcfc9');

  const [fontHeading, setFontHeading] = useState(settings?.booking_font_heading || 'Anton');
  const [fontBody, setFontBody] = useState(settings?.booking_font_body || 'DM Sans');

  const [coverUrl, setCoverUrl] = useState(settings?.booking_cover_url || '/lara-lashes-optimized.webp');
  const [avatarUrl, setAvatarUrl] = useState(settings?.booking_avatar_url || '/logo-emblem.png');

  const [title, setTitle] = useState(settings?.booking_title || 'Lara Varisa');
  const [subtitle, setSubtitle] = useState(settings?.booking_subtitle || 'Lash Designer ︱ Especialista no Olhar');
  const [locationLabel, setLocationLabel] = useState(settings?.booking_location_label || 'Zona Norte, Porto Alegre - RS');
  const [promoTag, setPromoTag] = useState(settings?.booking_promo_tag || '1ª visita: R$ 80 qualquer procedimento');
  const [guaranteeText, setGuaranteeText] = useState(
    settings?.booking_guarantee_text ||
      'Procedimentos realizados com isolamento perfeito, fios hipoalergênicos e biossegurança rigorosa.'
  );

  // Aplicar Preset de Tema
  const applyPreset = (preset: (typeof THEME_PRESETS)[0]) => {
    triggerHaptic('light');
    setTheme(preset.id);
    setBgColor(preset.bg);
    setCardBg(preset.card);
    setPrimaryColor(preset.primary);
    setAccentColor(preset.accent);
    setTextColor(preset.text);
    setBorderColor(preset.border);
    setFontHeading(preset.fontHeading);
    setFontBody(preset.fontBody);
  };

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* CAMPOS OCULTOS QUE SERÃO ENVIADOS NO FORMULÁRIO PRINCIPAL */}
      <input type="hidden" name="booking_theme" value={theme} />
      <input type="hidden" name="booking_bg_color" value={bgColor} />
      <input type="hidden" name="booking_card_bg" value={cardBg} />
      <input type="hidden" name="booking_primary_color" value={primaryColor} />
      <input type="hidden" name="booking_accent_color" value={accentColor} />
      <input type="hidden" name="booking_text_color" value={textColor} />
      <input type="hidden" name="booking_border_color" value={borderColor} />
      <input type="hidden" name="booking_font_heading" value={fontHeading} />
      <input type="hidden" name="booking_font_body" value={fontBody} />
      <input type="hidden" name="booking_cover_url" value={coverUrl} />
      <input type="hidden" name="booking_avatar_url" value={avatarUrl} />
      <input type="hidden" name="booking_title" value={title} />
      <input type="hidden" name="booking_subtitle" value={subtitle} />
      <input type="hidden" name="booking_location_label" value={locationLabel} />
      <input type="hidden" name="booking_promo_tag" value={promoTag} />
      <input type="hidden" name="booking_guarantee_text" value={guaranteeText} />

      {/* CABEÇALHO DO PAINEL */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--admin-line)',
        }}
      >
        <div>
          <p className="admin-kicker">PERSONALIZAÇÃO DA EXPERIÊNCIA DA CLIENTE</p>
          <h2
            style={{
              fontFamily: 'var(--font-body), sans-serif',
              fontSize: '18px',
              fontWeight: 600,
              margin: 0,
              textTransform: 'none',
              letterSpacing: 'normal',
            }}
          >
            Personalizar Página de Agendamento (/agendar)
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--admin-muted)', margin: '4px 0 0 0' }}>
            Ajuste 100% das cores, temas, fontes, banner de capa, logotipo e textos sem alterar o layout boutique.
          </p>
        </div>

        <a
          href="/agendar"
          target="_blank"
          rel="noopener noreferrer"
          className="admin-secondary"
          style={{
            height: '34px',
            minHeight: '34px',
            padding: '0 14px',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ExternalLink size={13} />
          <span>Ver Página /agendar</span>
        </a>
      </div>

      {/* 1. TEMAS PRÉ-DEFINIDOS (PRESETS 1-CLIQUE) */}
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: '#cca352' }} />
            <div>
              <p className="admin-kicker">TEMAS INSTANTÂNEOS</p>
              <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                Selecione um Estilo de Luxo ou Crie o Seu
              </h3>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {THEME_PRESETS.map((preset) => {
            const isSelected = theme === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => !disabled && applyPreset(preset)}
                style={{
                  padding: '14px',
                  borderRadius: '14px',
                  border: `2px solid ${isSelected ? 'var(--admin-ink)' : 'var(--admin-line)'}`,
                  background: isSelected ? 'var(--admin-soft)' : 'var(--admin-card)',
                  cursor: disabled ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--admin-ink)' }}>
                    {preset.name}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--admin-ink)',
                        color: 'var(--admin-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '11px', color: 'var(--admin-muted)', margin: '0 0 10px 0', minHeight: '30px' }}>
                  {preset.desc}
                </p>

                {/* Paleta visual em bolinhas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    title={`Fundo: ${preset.bg}`}
                    style={{ width: '16px', height: '16px', borderRadius: '50%', background: preset.bg, border: '1px solid #ccc' }}
                  />
                  <span
                    title={`Cartão: ${preset.card}`}
                    style={{ width: '16px', height: '16px', borderRadius: '50%', background: preset.card, border: '1px solid #ccc' }}
                  />
                  <span
                    title={`Primária: ${preset.primary}`}
                    style={{ width: '16px', height: '16px', borderRadius: '50%', background: preset.primary }}
                  />
                  <span
                    title={`Acento: ${preset.accent}`}
                    style={{ width: '16px', height: '16px', borderRadius: '50%', background: preset.accent }}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--admin-muted)', marginLeft: 'auto', fontFamily: 'monospace' }}>
                    {preset.fontHeading}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. GRADE DE CONTROLE FINO: CORES + FONTES + IMAGENS (2 COLUNAS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* COLUNA ESQUERDA: PALETA DE CORES */}
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={16} />
              <div>
                <p className="admin-kicker">PALETA DE CORES</p>
                <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  Controle Manual de Cores
                </h3>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {/* Cor de Fundo da Página */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)', display: 'block' }}>
                  Fundo da Página
                </label>
                <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>Cor de fundo geral de /agendar</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={bgColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setBgColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={bgColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setBgColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '80px', height: '32px', fontSize: '12px', fontFamily: 'monospace', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 8px' }}
                />
              </div>
            </div>

            {/* Cor dos Cartões */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--admin-line)', paddingTop: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)', display: 'block' }}>
                  Fundo dos Cartões & Cards
                </label>
                <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>Procedimentos, calendário e resumo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={cardBg}
                  disabled={disabled}
                  onChange={(e) => {
                    setCardBg(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={cardBg}
                  disabled={disabled}
                  onChange={(e) => {
                    setCardBg(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '80px', height: '32px', fontSize: '12px', fontFamily: 'monospace', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 8px' }}
                />
              </div>
            </div>

            {/* Cor Primária */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--admin-line)', paddingTop: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)', display: 'block' }}>
                  Cor Primária (Botões de Ação)
                </label>
                <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>Botões Agendar, Confirmar e Abas</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={primaryColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={primaryColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '80px', height: '32px', fontSize: '12px', fontFamily: 'monospace', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 8px' }}
                />
              </div>
            </div>

            {/* Cor de Acento / Ouro */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--admin-line)', paddingTop: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)', display: 'block' }}>
                  Cor de Destaque / Acento
                </label>
                <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>Ícones, estrelas e selos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={accentColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setAccentColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={accentColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setAccentColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '80px', height: '32px', fontSize: '12px', fontFamily: 'monospace', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 8px' }}
                />
              </div>
            </div>

            {/* Cor do Texto Principal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--admin-line)', paddingTop: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)', display: 'block' }}>
                  Cor do Texto Principal
                </label>
                <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>Títulos, nomes e valores</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={textColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setTextColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={textColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setTextColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '80px', height: '32px', fontSize: '12px', fontFamily: 'monospace', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 8px' }}
                />
              </div>
            </div>

            {/* Cor das Bordas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--admin-line)', paddingTop: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)', display: 'block' }}>
                  Cor das Bordas e Divisórias
                </label>
                <span style={{ fontSize: '11px', color: 'var(--admin-muted)' }}>Linhas sutis dos cartões</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={borderColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setBorderColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={borderColor}
                  disabled={disabled}
                  onChange={(e) => {
                    setBorderColor(e.target.value);
                    setTheme('custom');
                  }}
                  style={{ width: '80px', height: '32px', fontSize: '12px', fontFamily: 'monospace', borderRadius: '6px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 8px' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: TIPOGRAFIA & IMAGENS */}
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* TIPOGRAFIA */}
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Type size={16} />
                <div>
                  <p className="admin-kicker">FONTES & TIPOGRAFIA</p>
                  <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                    Famílias de Fontes da Página
                  </h3>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', display: 'block', marginBottom: '6px' }}>
                  Fonte dos Títulos & Valores Numéricos
                </label>
                <select
                  value={fontHeading}
                  disabled={disabled}
                  onChange={(e) => setFontHeading(e.target.value)}
                  style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 12px', fontSize: '13px' }}
                >
                  {HEADING_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', display: 'block', marginBottom: '6px' }}>
                  Fonte dos Textos Gerais & Descrições
                </label>
                <select
                  value={fontBody}
                  disabled={disabled}
                  onChange={(e) => setFontBody(e.target.value)}
                  style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 12px', fontSize: '13px' }}
                >
                  {BODY_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* BANNER E FOTO DE PERFIL */}
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={16} />
                <div>
                  <p className="admin-kicker">IMAGENS DO CABEÇALHO</p>
                  <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                    Banner de Capa & Foto do Estúdio
                  </h3>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              {/* Banner de Capa */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', display: 'block', marginBottom: '6px' }}>
                  URL do Banner de Capa Superior
                </label>
                <input
                  type="text"
                  value={coverUrl}
                  disabled={disabled}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="/lara-lashes-optimized.webp ou URL externa"
                  style={{ width: '100%', height: '38px', borderRadius: '10px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 12px', fontSize: '12px', fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setCoverUrl('/lara-lashes-optimized.webp')}
                    className="admin-secondary"
                    style={{ height: '24px', minHeight: '24px', padding: '0 8px', fontSize: '10px' }}
                  >
                    Banner Cílios Lara (Padrão)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverUrl('/hero-bg.webp')}
                    className="admin-secondary"
                    style={{ height: '24px', minHeight: '24px', padding: '0 8px', fontSize: '10px' }}
                  >
                    Hero Studio Dark
                  </button>
                </div>
              </div>

              {/* Foto / Logotipo */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', display: 'block', marginBottom: '6px' }}>
                  Foto de Perfil ou Emblema do Estúdio
                </label>
                <input
                  type="text"
                  value={avatarUrl}
                  disabled={disabled}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="/logo-emblem.png ou URL da foto da Lara"
                  style={{ width: '100%', height: '38px', borderRadius: '10px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 12px', fontSize: '12px', fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('/logo-emblem.png')}
                    className="admin-secondary"
                    style={{ height: '24px', minHeight: '24px', padding: '0 8px', fontSize: '10px' }}
                  >
                    Emblema Oficial (Padrão)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('/apple-icon.png')}
                    className="admin-secondary"
                    style={{ height: '24px', minHeight: '24px', padding: '0 8px', fontSize: '10px' }}
                  >
                    Ícone Redondo
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* 3. TEXTOS & MENSAGENS PERSONALIZÁVEIS */}
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-kicker">TEXTOS DA PÁGINA</p>
            <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
              Títulos, Subtítulo e Mensagens Institucionais
            </h3>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', display: 'block', marginBottom: '6px' }}>
              Nome Principal no Cabeçalho
            </label>
            <input
              type="text"
              value={title}
              disabled={disabled}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lara Varisa"
              style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 12px', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', display: 'block', marginBottom: '6px' }}>
              Subtítulo / Especialidade
            </label>
            <input
              type="text"
              value={subtitle}
              disabled={disabled}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Lash Designer ︱ Especialista no Olhar"
              style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 12px', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', display: 'block', marginBottom: '6px' }}>
              Texto de Localização no Cabeçalho
            </label>
            <input
              type="text"
              value={locationLabel}
              disabled={disabled}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="Zona Norte, Porto Alegre - RS"
              style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 12px', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', display: 'block', marginBottom: '6px' }}>
              Texto da Oferta / Selo Promo
            </label>
            <input
              type="text"
              value={promoTag}
              disabled={disabled}
              onChange={(e) => setPromoTag(e.target.value)}
              placeholder="1ª visita: R$ 80 qualquer procedimento"
              style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 12px', fontSize: '13px' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-muted)', display: 'block', marginBottom: '6px' }}>
              Garantia de Biossegurança e Conforto (Rodapé do Agendamento)
            </label>
            <input
              type="text"
              value={guaranteeText}
              disabled={disabled}
              onChange={(e) => setGuaranteeText(e.target.value)}
              placeholder="Procedimentos realizados com isolamento perfeito, fios hipoalergênicos e biossegurança rigorosa."
              style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid var(--admin-line)', background: 'var(--admin-input-bg)', color: 'var(--admin-ink)', padding: '0 12px', fontSize: '13px' }}
            />
          </div>
        </div>
      </section>

      {/* 4. PRÉ-VISUALIZAÇÃO EM TEMPO REAL */}
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={16} />
            <div>
              <p className="admin-kicker">PRÉVIA EM TEMPO REAL</p>
              <h3 style={{ fontFamily: 'var(--font-body), sans-serif', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                Como a cliente verá a página /agendar
              </h3>
            </div>
          </div>
        </div>

        {/* CONTAINER DA PRÉVIA COM CORES DINÂMICAS */}
        <div
          style={{
            borderRadius: '20px',
            overflow: 'hidden',
            backgroundColor: bgColor,
            border: `1px solid ${borderColor}`,
            color: textColor,
            fontFamily: `${fontBody}, sans-serif`,
            transition: 'all 0.2s ease',
          }}
        >
          {/* Header Cover */}
          <div style={{ position: 'relative', height: '100px', width: '100%', overflow: 'hidden', background: '#111' }}>
            <img
              src={coverUrl}
              alt="Capa"
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
          </div>

          {/* Profile Avatar & Info */}
          <div style={{ padding: '0 16px 16px 16px', textAlign: 'center', marginTop: '-36px', position: 'relative' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: bgColor,
                padding: '3px',
                margin: '0 auto',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#161614',
                  border: `2px solid ${borderColor}`,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={avatarUrl}
                  alt={title}
                  style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            <h4
              style={{
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: `${fontHeading}, sans-serif`,
                textTransform: 'uppercase',
                margin: '8px 0 2px 0',
                color: textColor,
              }}
            >
              {title}
            </h4>
            <p style={{ fontSize: '11px', color: textColor, opacity: 0.75, margin: 0 }}>
              {subtitle}
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', marginTop: '4px', color: textColor, opacity: 0.65 }}>
              <MapPin size={10} style={{ color: accentColor }} />
              <span>{locationLabel}</span>
              <span>·</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>Agenda aberta</span>
            </div>

            {/* Simulação de Card de Procedimento com Cores do Tema */}
            <div
              style={{
                marginTop: '16px',
                backgroundColor: cardBg,
                borderRadius: '16px',
                border: `1px solid ${borderColor}`,
                padding: '14px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: accentColor,
                    background: `${accentColor}18`,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    display: 'inline-block',
                    marginBottom: '4px',
                  }}
                >
                  {promoTag}
                </span>
                <h5 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 2px 0', color: textColor }}>
                  Efeito Molhado (Wet Look)
                </h5>
                <span style={{ fontSize: '11px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock3 size={11} /> 2 horas · Manutenção 18-21 dias
                </span>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '10px', textDecoration: 'line-through', opacity: 0.5, display: 'block' }}>
                    R$ 160
                  </span>
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      fontFamily: `${fontHeading}, sans-serif`,
                      color: textColor,
                      display: 'block',
                      lineHeight: 1,
                    }}
                  >
                    R$ 80
                  </span>
                </div>

                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: primaryColor,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>

            {/* Garantia */}
            <div
              style={{
                marginTop: '10px',
                fontSize: '10px',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <ShieldCheck size={12} style={{ color: accentColor }} />
              <span>{guaranteeText}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
