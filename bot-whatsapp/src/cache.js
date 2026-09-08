import { supabase } from './supabase.js';

// Cache de serviços do estúdio
let cachedServices = null;
let cachedServicesTime = 0;
const SERVICES_TTL_MS = 10 * 60 * 1000; // 10 minutos de TTL

// Cache de configurações do estúdio (site_settings)
let cachedSettings = null;
let cachedSettingsTime = 0;
const SETTINGS_TTL_MS = 10 * 60 * 1000; // 10 minutos de TTL

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

  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, price_label, duration_label, duration_minutes, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true, nullsFirst: false });

    if (!error && Array.isArray(data)) {
      cachedServices = data.map((s) => ({
        id: s.id,
        nome: s.name,
        preco: s.price_label,
        duracao: s.duration_label,
        duracao_minutos: s.duration_minutes,
      }));
      cachedServicesTime = agora;
      return cachedServices;
    }
  } catch (err) {
    console.warn('[cache:obterServicos] Erro ao buscar serviços:', err?.message || err);
  }

  // Fallback: se der erro na rede mas tínhamos cache antigo, reutiliza o anterior
  return cachedServices || [];
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

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'global')
      .maybeSingle();

    if (!error && data) {
      cachedSettings = data;
      cachedSettingsTime = agora;
      return cachedSettings;
    }
  } catch (err) {
    console.warn('[cache:obterConfiguracoes] Erro ao buscar configurações:', err?.message || err);
  }

  return cachedSettings || null;
}

export default {
  obterServicosEmCache,
  obterConfiguracoesEmCache,
  invalidarCacheServicos,
  invalidarCacheConfiguracoes,
};
