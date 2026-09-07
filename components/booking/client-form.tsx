'use client';

import { useState, ChangeEvent } from 'react';
import { User, Phone, Mail, MessageSquare, Crown, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';

export type ClientFormData = {
  name: string;
  phone: string;
  email: string;
  notes: string;
  isVip: boolean;
};

export function formatBrPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function ClientForm({
  formData,
  onChange,
}: {
  formData: ClientFormData;
  onChange: (data: ClientFormData) => void;
}) {
  const [activeTab, setActiveTab] = useState<'guest' | 'vip'>(formData.isVip ? 'vip' : 'guest');

  function handlePhoneChange(e: ChangeEvent<HTMLInputElement>) {
    const formatted = formatBrPhone(e.target.value);
    onChange({ ...formData, phone: formatted });
  }

  function handleTabChange(tab: 'guest' | 'vip') {
    setActiveTab(tab);
    onChange({ ...formData, isVip: tab === 'vip' });
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-[11px] font-semibold tracking-[0.2em] text-[#D4AF37] uppercase">
          Etapa 3 de 3
        </span>
        <h2 className="text-xl md:text-2xl font-serif tracking-tight text-white mt-0.5">
          Seus Dados & Preferências
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Você pode agendar rapidamente como convidada ou desbloquear benefícios VIP.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 bg-neutral-900 rounded-xl border border-white/10">
        <button
          type="button"
          onClick={() => handleTabChange('guest')}
          className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'guest'
              ? 'bg-neutral-800 text-white shadow-sm border border-white/10'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <User size={14} />
          <span>Agendamento Rápido</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('vip')}
          className={`py-2.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'vip'
              ? 'bg-gradient-to-r from-[#D4AF37] to-[#C59B27] text-black shadow-md shadow-[#D4AF37]/20 font-bold'
              : 'text-[#D4AF37] hover:text-[#F3E5AB]'
          }`}
        >
          <Crown size={14} />
          <span>Ativar Perfil VIP</span>
          <span className="bg-black/30 text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-widest text-black">
            10% OFF
          </span>
        </button>
      </div>

      {/* VIP Benefits Banner */}
      {activeTab === 'vip' && (
        <div className="bg-gradient-to-br from-[#1b1710] to-[#12110e] border border-[#D4AF37]/40 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 text-[#E7C969] font-medium">
            <Sparkles size={15} />
            <span>Vantagens do Perfil VIP Ativado:</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-300 pt-1">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#D4AF37] shrink-0" />
              <span><strong>10% de desconto</strong> no 1º atendimento</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#D4AF37] shrink-0" />
              <span>Histórico salvo de procedimentos</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#D4AF37] shrink-0" />
              <span>Aviso de manutenção periódica</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#D4AF37] shrink-0" />
              <span>Reagendamento prioritário online</span>
            </li>
          </ul>
        </div>
      )}

      {/* Inputs Form */}
      <div className="bg-neutral-900/70 border border-white/10 rounded-2xl p-5 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Nome Completo <span className="text-[#D4AF37]">*</span>
          </label>
          <div className="relative">
            <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              placeholder="Como prefere ser chamada"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-950/80 border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
            />
          </div>
        </div>

        {/* WhatsApp Phone */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            WhatsApp para Confirmação <span className="text-[#D4AF37]">*</span>
          </label>
          <div className="relative">
            <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={handlePhoneChange}
              placeholder="(51) 99999-9999"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-950/80 border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all font-mono"
            />
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Enviaremos o lembrete e as instruções de chegada pelo WhatsApp.
          </p>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            E-mail {activeTab === 'vip' ? <span className="text-[#D4AF37]">* (necessário para conta VIP)</span> : <span className="text-neutral-500">(opcional)</span>}
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="email"
              required={activeTab === 'vip'}
              value={formData.email}
              onChange={(e) => onChange({ ...formData, email: e.target.value })}
              placeholder="seuemail@exemplo.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-950/80 border border-white/10 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
            />
          </div>
        </div>

        {/* Notes / Special Requests */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Observações ou Sensibilidades <span className="text-neutral-500">(opcional)</span>
          </label>
          <div className="relative">
            <textarea
              rows={2}
              maxLength={500}
              value={formData.notes}
              onChange={(e) => onChange({ ...formData, notes: e.target.value })}
              placeholder="Ex: Primeira vez fazendo cílios, olhos sensíveis, preferência por formato mais natural..."
              className="w-full p-3 rounded-xl bg-neutral-950/80 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all resize-none"
            />
          </div>
        </div>

        {/* Privacy Note */}
        <div className="flex items-center gap-2 text-[11px] text-neutral-500 pt-2 border-t border-white/5">
          <ShieldCheck size={14} className="text-[#D4AF37] shrink-0" />
          <span>Seus dados são confidenciais e protegidos pela LGPD.</span>
        </div>
      </div>
    </div>
  );
}
