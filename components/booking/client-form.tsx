'use client';

import { ChangeEvent } from 'react';
import { User, Phone } from 'lucide-react';
import { triggerHaptic } from '@/lib/utils';

export type ClientFormData = {
  name: string;
  phone: string;
  email: string;
  notes: string;
  isVip: boolean;
  termsAccepted?: boolean;
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

  const isAccepted = formData.termsAccepted ?? true;

  return (
    <div className="space-y-3 w-full max-w-full overflow-hidden">
      <div className="px-1">
        <h2 className="text-base sm:text-lg font-bold text-[var(--color-obsidian)] tracking-tight">
          Seus Dados
        </h2>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#d6d6cf] shadow-sm space-y-3.5 w-full max-w-full overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
          {/* Name */}
          <div className="w-full min-w-0">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952] mb-1.5">
              Nome
            </label>
            <div className="relative w-full">
              <User size={15} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#8c8c84] shrink-0" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => onChange({ ...formData, name: e.target.value })}
                placeholder="Como prefere ser chamada"
                className="w-full pl-10 sm:pl-11 pr-3.5 sm:pr-4 py-2.5 sm:py-3 rounded-full bg-[#f7f6f2] border border-[#e2e2df] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-sm focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="w-full min-w-0">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952] mb-1.5">
              WhatsApp
            </label>
            <div className="relative w-full">
              <Phone size={15} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-[#8c8c84] shrink-0" />
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="(51) 99999-9999"
                className="w-full pl-10 sm:pl-11 pr-3.5 sm:pr-4 py-2.5 sm:py-3 rounded-full bg-[#f7f6f2] border border-[#e2e2df] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-sm focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors font-mono"
              />
            </div>
          </div>
        </div>

        {/* Notes (minimal) */}
        <div className="w-full min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#595952] mb-1.5">
            Observações <span className="text-[#8c8c84] font-normal lowercase">(opcional)</span>
          </label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => onChange({ ...formData, notes: e.target.value })}
            placeholder="Ex: Primeira vez com extensão, olhos sensíveis..."
            className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full bg-[#f7f6f2] border border-[#e2e2df] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-sm focus:outline-none focus:bg-white focus:border-[var(--color-obsidian)] transition-colors"
          />
        </div>

        {/* Checkbox Termos & Lembretes */}
        <div className="pt-2 border-t border-[#f0f0ed]">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAccepted}
              onChange={(e) => {
                triggerHaptic('light');
                onChange({ ...formData, termsAccepted: e.target.checked });
              }}
              className="w-3.5 h-3.5 rounded text-black accent-black cursor-pointer shrink-0"
            />
            <span className="text-[11px] text-[#707068] leading-tight">
              Aceito os <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-[var(--color-obsidian)]">termos</a> e receber lembretes no WhatsApp.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
