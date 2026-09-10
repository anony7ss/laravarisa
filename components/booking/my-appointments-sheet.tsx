'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Side sheet keeps its existing visual structure. */

import { useState, useEffect, useCallback, type SyntheticEvent } from 'react';
import { X, Search, CalendarDays, Clock3, Phone, AlertCircle, Loader2, MessageCircle } from 'lucide-react';
import { formatBrPhone } from './client-form';
import { whatsappUrl } from '@/lib/studio';

export type ClientAppointmentItem = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  client_name: string;
  notes: string;
  service_name: string;
  service_price: string;
  service_duration: string;
};

const statusMap: Record<string, { label: string; style: string }> = {
  scheduled: { label: 'Agendado', style: 'bg-[var(--color-sulfur)] text-[var(--color-obsidian)] border-[#d6d6cf]' },
  confirmed: { label: 'Confirmado', style: 'bg-[var(--color-obsidian)] text-white border-[var(--color-obsidian)]' },
  completed: { label: 'Concluído', style: 'bg-white text-[#595952] border-[#d6d6cf]' },
  cancelled: { label: 'Cancelado', style: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]' },
  no_show: { label: 'Não compareceu', style: 'bg-white text-[#8c8c84] border-[#d6d6cf]' },
};

export function MyAppointmentsSheet({
  isOpen,
  onClose,
  initialPhone = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialPhone?: string;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<ClientAppointmentItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const fetchAppointments = useCallback(async (searchPhone: string) => {
    const clean = searchPhone.replace(/\D/g, '');
    if (clean.length < 8) {
      setError('Informe seu número de WhatsApp.');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const res = await fetch(`/api/public/my-appointments?phone=${clean}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setAppointments(data.data);
      } else {
        setError(data.error || 'Não foi possível consultar os agendamentos.');
      }
    } catch {
      setError('Erro ao buscar histórico.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !initialPhone || initialPhone.replace(/\D/g, '').length < 8) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPhone(initialPhone);
      void fetchAppointments(initialPhone);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialPhone, fetchAppointments]);

  function handleSearch(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    void fetchAppointments(phone);
  }

  const whatsappDestination = whatsappUrl('Olá, Lara! Gostaria de uma informação sobre meu agendamento.');
  const whatsappExternal = whatsappDestination.startsWith('https://wa.me/');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md h-full bg-[var(--color-limestone)] text-[var(--color-obsidian)] border-l border-[#d6d6cf] p-6 md:p-8 overflow-y-auto flex flex-col justify-between shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-appointments-title"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#d6d6cf]">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ember)]">
                Área da Cliente
              </span>
              <h3 id="my-appointments-title" className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-obsidian)] mt-0.5">
                Meus Agendamentos
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white border border-[#d6d6cf] flex items-center justify-center text-[#595952] hover:text-[var(--color-obsidian)] cursor-pointer"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search by WhatsApp */}
          <form onSubmit={handleSearch} className="my-6 space-y-2">
            <label htmlFor="my-appointments-phone" className="block text-xs font-medium text-[#595952]">
              Digite seu WhatsApp para localizar seus horários:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c8c84]" />
                <input
                  id="my-appointments-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatBrPhone(e.target.value))}
                  placeholder="(51) 99999-9999"
                  className="w-full pl-10 pr-3 py-2.5 rounded-full bg-white border border-[#d6d6cf] text-[var(--color-obsidian)] placeholder-[#8c8c84] text-xs focus:outline-none focus:border-[var(--color-obsidian)] font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="px-5 py-2.5 rounded-full text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm hover:opacity-90 active:scale-95 transition-all bg-[var(--color-obsidian)]"
              >
                {loading ? <Loader2 size={13} className="animate-spin text-white" /> : <Search size={13} className="text-white" />}
                <span className="text-white">Buscar</span>
              </button>
            </div>
            {error && <p className="text-xs text-rose-600 mt-1" role="alert">{error}</p>}
          </form>

          {/* Results */}
          <div className="space-y-3">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#595952]">
                <Loader2 size={20} className="animate-spin text-[var(--color-ember)]" />
                <span>Consultando sua agenda...</span>
              </div>
            ) : searched && appointments.length === 0 ? (
              <div className="py-10 text-center rounded-[24px] bg-white border border-[#d6d6cf] p-4 space-y-2">
                <AlertCircle size={24} className="mx-auto text-[#8c8c84]" />
                <h4 className="text-sm font-semibold text-[var(--color-obsidian)]">Nenhum horário encontrado</h4>
                <p className="text-xs text-[#595952]">
                  Não encontramos reservas para o número informado. Verifique se digitou o DDD.
                </p>
              </div>
            ) : (
              appointments.map((item) => {
                const startDate = new Date(item.starts_at);
                const isUpcoming = startDate > new Date() && item.status !== 'cancelled';
                const statusInfo = statusMap[item.status] || { label: item.status, style: 'bg-white text-[#595952] border-[#d6d6cf]' };

                const dateFmt = startDate.toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                });
                const timeFmt = startDate.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-[20px] border transition-all ${
                      isUpcoming ? 'bg-white border-[var(--color-obsidian)] shadow-sm' : 'bg-[#e2e2df]/60 border-[#d6d6cf]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-sm font-bold text-[var(--color-obsidian)]">
                        {item.service_name}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statusInfo.style}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#595952]">
                      <span className="flex items-center gap-1 capitalize">
                        <CalendarDays size={13} className="text-[var(--color-ember)]" />
                        {dateFmt}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock3 size={13} className="text-[var(--color-ember)]" />
                        {timeFmt}
                      </span>
                    </div>

                    {item.service_price && (
                      <div className="text-xs font-semibold text-[var(--color-obsidian)] pt-2 mt-2 border-t border-[#e2e2df] flex items-center justify-between">
                        <span className="text-[#595952]">Valor</span>
                        <span>{item.service_price}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer WhatsApp Link */}
        <div className="pt-4 border-t border-[#d6d6cf] mt-6 text-center space-y-2">
          <p className="text-xs text-[#595952]">
            Deseja reagendar ou tirar dúvidas?
          </p>
          <a
            href={whatsappDestination}
            target={whatsappExternal ? '_blank' : undefined}
            rel={whatsappExternal ? 'noopener noreferrer' : undefined}
            className="w-full py-3 px-4 rounded-full bg-white hover:bg-[#e2e2df] border border-[#d6d6cf] text-[var(--color-obsidian)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <MessageCircle size={15} className="text-[#25D366]" />
            <span>Falar com a Lara no WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
}
