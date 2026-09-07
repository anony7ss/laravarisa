'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { X, Search, Calendar, Clock, Phone, AlertCircle, Loader2, MessageCircle, ChevronRight, Sparkles } from 'lucide-react';
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

const statusMap: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendado', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  confirmed: { label: 'Confirmado', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  completed: { label: 'Concluído', color: 'bg-neutral-800 text-neutral-400 border-white/5' },
  cancelled: { label: 'Cancelado', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  no_show: { label: 'Não compareceu', color: 'bg-neutral-800 text-neutral-500 border-white/5' },
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

  // Auto-search if initialPhone was provided
  useEffect(() => {
    if (isOpen && initialPhone && initialPhone.replace(/\D/g, '').length >= 10) {
      setPhone(initialPhone);
      fetchAppointments(initialPhone);
    }
  }, [isOpen, initialPhone]);

  async function fetchAppointments(searchPhone: string) {
    const clean = searchPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      setError('Informe seu número de WhatsApp com DDD.');
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
      setError('Erro de conexão ao buscar histórico.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    fetchAppointments(phone);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md h-full bg-[#121110] border-l border-white/10 p-5 md:p-6 overflow-y-auto flex flex-col justify-between shadow-2xl text-white">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]">
                Área da Cliente
              </span>
              <h3 className="text-lg font-serif text-white mt-0.5">Meus Agendamentos</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-900 border border-white/5"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="my-5 space-y-2">
            <label className="block text-xs text-neutral-400">
              Digite seu WhatsApp cadastrado para localizar seus horários:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatBrPhone(e.target.value))}
                  placeholder="(51) 99999-9999"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c59b27] text-black font-semibold text-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                <span>Buscar</span>
              </button>
            </div>
            {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
          </form>

          {/* Results List */}
          <div className="space-y-3">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
                <Loader2 size={24} className="animate-spin text-[#D4AF37]" />
                <span className="text-xs">Consultando histórico...</span>
              </div>
            ) : searched && appointments.length === 0 ? (
              <div className="py-10 text-center rounded-2xl bg-neutral-950/60 border border-white/5 p-4 space-y-2">
                <AlertCircle size={28} className="mx-auto text-neutral-500" />
                <h4 className="text-sm font-medium text-white">Nenhum agendamento encontrado</h4>
                <p className="text-xs text-neutral-400">
                  Não localizamos reservas para o número informado. Verifique se digitou o DDD correto.
                </p>
              </div>
            ) : (
              appointments.map((item) => {
                const startDate = new Date(item.starts_at);
                const isUpcoming = startDate > new Date() && item.status !== 'cancelled';
                const statusInfo = statusMap[item.status] || { label: item.status, color: 'bg-neutral-800 text-neutral-300' };

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
                    className={`p-4 rounded-xl border transition-all ${
                      isUpcoming
                        ? 'bg-[#181613] border-[#D4AF37]/30 shadow-sm'
                        : 'bg-neutral-900/60 border-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-sm font-medium text-white">
                        {item.service_name}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-300 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#D4AF37]" />
                        <span className="capitalize">{dateFmt}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-[#D4AF37]" />
                        <span>{timeFmt}</span>
                      </div>
                    </div>

                    {item.service_price && (
                      <div className="text-xs text-[#D4AF37] font-semibold pt-2 border-t border-white/5 flex items-center justify-between">
                        <span>Investimento</span>
                        <span>{item.service_price}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Support */}
        <div className="pt-4 border-t border-white/10 mt-6 text-center space-y-2">
          <p className="text-[11px] text-neutral-400">
            Deseja remarcar ou tirar dúvidas sobre sua sessão?
          </p>
          <a
            href={whatsappUrl('Olá, Lara! Gostaria de tirar uma dúvida sobre meu agendamento.')}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle size={15} className="text-emerald-400" />
            <span>Falar com a Lara no WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
}
