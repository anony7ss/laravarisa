'use client';

import { ChangeEvent } from 'react';
import { User, Phone, Mail, Sparkles } from 'lucide-react';

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
  function handlePhoneChange(e: ChangeEvent<HTMLInputElement>) {
    const formatted = formatBrPhone(e.target.value);
    onChange({ ...formData, phone: formatted });
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-[#cfcfc9] pb-3">
        <span className="text-[11px] font-bold tracking-[0.18em] text-[var(--color-ember)] uppercase font-mono">
          Passo 03
        </span>
        <h2 className="text-2xl md:text-3xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)] mt-0.5">
          Seus Dados
        </h2>
      </div>

      <div className="bg-[var(--color-limestone)] p-5 md:p-7 rounded-[32px] border border-[#d6d6cf] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952] mb-1.5">
              Seu Nome Completo
            </label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8c8c84]" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => onChange({ ...formData, name: e.target.value })}
                placeholder="Como quer ser chamada"
                className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-[#d6d6cf] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-sm focus:outline-none focus:border-[var(--color-obsidian)] transition-colors"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952] mb-1.5">
              WhatsApp para Confirmação
            </label>
            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8c8c84]" />
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="(51) 99999-9999"
                className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-[#d6d6cf] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-sm focus:outline-none focus:border-[var(--color-obsidian)] transition-colors font-mono"
              />
            </div>
          </div>
        </div>

        {/* VIP Discount Option */}
        <div className="pt-2">
          <label className="flex items-start gap-3 p-3.5 rounded-[20px] bg-white border border-[#d6d6cf] cursor-pointer hover:border-[var(--color-obsidian)] transition-colors">
            <input
              type="checkbox"
              checked={formData.isVip}
              onChange={(e) => onChange({ ...formData, isVip: e.target.checked })}
              className="mt-1 w-4 h-4 rounded text-[var(--color-ember)] accent-[var(--color-ember)] cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-semibold text-[var(--color-obsidian)] flex items-center gap-1.5">
                <Sparkles size={14} className="text-[var(--color-ember)]" />
                Quero 10% de desconto na primeira visita (Ativar Perfil VIP)
              </span>
              <p className="text-[#595952] text-[11px] mt-0.5">
                Garante desconto imediato, histórico salvo de sessões e lembretes de retorno.
              </p>
            </div>
          </label>
        </div>

        {/* Email conditional when VIP is checked */}
        {formData.isVip && (
          <div className="pt-1 animate-in fade-in duration-200">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952] mb-1.5">
              Seu E-mail (para vincular seu desconto VIP)
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8c8c84]" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => onChange({ ...formData, email: e.target.value })}
                placeholder="seuemail@exemplo.com"
                className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-[#d6d6cf] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-sm focus:outline-none focus:border-[var(--color-obsidian)] transition-colors"
              />
            </div>
          </div>
        )}

        {/* Notes (minimal) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952] mb-1.5">
            Observações ou preferências <span className="text-[#8c8c84] font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => onChange({ ...formData, notes: e.target.value })}
            placeholder="Ex: Primeira vez com extensão, olhos sensíveis..."
            className="w-full px-4 py-3 rounded-full bg-white border border-[#d6d6cf] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-xs focus:outline-none focus:border-[var(--color-obsidian)] transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
