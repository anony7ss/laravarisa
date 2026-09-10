import { supabase } from './supabase.js';

// Cache de serviços do estúdio
let cachedServices = null;
let cachedServicesTime = 0;
const SERVICES_TTL_MS = 10 * 60 * 1000; // 10 minutos de TTL
let servicesRequest = null;

// Cache de configurações do estúdio (site_settings)
let cachedSettings = null;
let cachedSettingsTime = 0;
const SETTINGS_TTL_MS = 10 * 60 * 1000; // 10 minutos de TTL
let settingsRequest = null;

// Apenas os campos consumidos pelo bot. Evita carregar segredos, templates e
// colunas administrativas em toda mensagem recebida.
const SETTINGS_SELECT = [
  'id',
  'booking_enabled',
  'booking_closed_message',
  'booking_alert',
  'open_days',
  'open_time',
  'close_time',
  'break_start',
  'break_end',
  'max_future_days',
  'slot_interval_minutes',
  'min_lead_hours',
  'studio_name',
  'studio_address',
  'studio_city',
  'studio_hours',
  'booking_promo_tag',
  'booking_guarantee_text',
  'whatsapp_booking_message',
  'whatsapp_audio_mode',
  'whatsapp_audio_voice',
  'lara_phone',
  'notify_lara_on_human_transfer',
  'notify_lara_on_new_booking',
  'notify_admin_sound',
  'reminder_active',
  'reminder_hours_before',
  'reminder_message_template',
  'reminder_same_day_active',
  'reminder_same_day_hours_before',
  'reminder_same_day_message_template',
  'post_care_active',
  'post_care_hours_after',
  'post_care_message_template',
  'google_review_url',
].join(', ');

/**
 * Invalida o cache de serviços (chamado quando o Supabase Realtime detecta mudanças na tabela services)
 */
export function invalidarCacheServicos() {
  cachedServices = null;
  cachedServicesTime = 0;
}

/**
 * Invalida o cache de configurações (chamado quando o Supabase Realtime detecta mudanças na tabela site_settings)
 */
export function invalidarCacheConfiguracoes() {
  cachedSettings = null;
  cachedSettingsTime = 0;
}

/**
 * Retorna os serviços ativos com cache em memória (RAM)
 * Evita requisições repetidas ao banco a cada mensagem recebida.
 * 
 * @param {boolean} [forcarAtualizacao=false] 
 * @returns {Promise<Array<{ id: string, nome: string, preco: string, duracao: string, duracao_minutos: number }>>}
 */
export async function obterServicosEmCache(forcarAtualizacao = false) {
  const agora = Date.now();
  if (!forcarAtualizacao && cachedServices && agora - cachedServicesTime < SERVICES_TTL_MS) {
    return cachedServices;
  }

  // Deduplica rajadas (várias mensagens novas ao mesmo tempo não abrem várias
  // consultas idênticas ao banco).
  if (servicesRequest) return servicesRequest;

  servicesRequest = (async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price_label, duration_label, duration_minutes, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .limit(100);

      if (!error && Array.isArray(data)) {
        cachedServices = data.map((s) => ({
          id: s.id,
          nome: s.name,
          preco: s.price_label,
          duracao: s.duration_label,
          duracao_minutos: s.duration_minutes,
        }));
        cachedServicesTime = Date.now();
        return cachedServices;
      }
    } catch (err) {
      console.warn('[cache:obterServicos] Erro ao buscar serviços:', err?.message || err);
    } finally {
      servicesRequest = null;
    }

    // Fallback: se der erro na rede mas tínhamos cache antigo, reutiliza o anterior
    return cachedServices || [];
  })();

  return servicesRequest;
}

/**
 * Retorna as configurações globais em cache (booking_enabled, open_days, templates, etc.)
 * 
 * @param {boolean} [forcarAtualizacao=false] 
 * @returns {Promise<any>}
 */
export async function obterConfiguracoesEmCache(forcarAtualizacao = false) {
  const agora = Date.now();
  if (!forcarAtualizacao && cachedSettings && agora - cachedSettingsTime < SETTINGS_TTL_MS) {
    return cachedSettings;
  }

  if (settingsRequest) return settingsRequest;

  settingsRequest = (async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select(SETTINGS_SELECT)
        .eq('id', 'global')
        .maybeSingle();

      if (!error && data) {
        cachedSettings = data;
        cachedSettingsTime = Date.now();
        return cachedSettings;
      }
    } catch (err) {
      console.warn('[cache:obterConfiguracoes] Erro ao buscar configurações:', err?.message || err);
    } finally {
      settingsRequest = null;
    }

    return cachedSettings || null;
  })();

  return settingsRequest;
}

export default {
  obterServicosEmCache,
  obterConfiguracoesEmCache,
  invalidarCacheServicos,
  invalidarCacheConfiguracoes,
};
