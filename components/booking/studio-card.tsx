import { MapPin, Clock, Sparkles, AlertCircle, ShieldAlert } from 'lucide-react';
import { studio } from '@/lib/studio';

export function StudioCard() {
  return (
    <div className="bg-gradient-to-b from-neutral-900/90 to-neutral-950 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4">
      {/* Header with badge */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-semibold tracking-widest text-[#D4AF37] uppercase">
            Atelier Exclusivo
          </span>
          <h3 className="text-lg font-serif text-white mt-0.5">
            Lara Varisa Lash Atelier
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Atendimento presencial e individualizado na Zona Norte
          </p>
        </div>
        <div className="w-9 h-9 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
          <Sparkles size={16} />
        </div>
      </div>

      {/* Location Details */}
      <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-white/5 space-y-2 text-xs">
        <div className="flex items-start gap-2.5 text-neutral-300">
          <MapPin size={15} className="text-[#D4AF37] shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Localização:</strong> Zona Norte, Porto Alegre - RS
            <p className="text-neutral-500 text-[11px] mt-0.5">
              O endereço exato com ponto de referência e instruções de acesso é enviado diretamente no seu WhatsApp após a confirmação.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-neutral-300 pt-1.5 border-t border-white/5">
          <Clock size={15} className="text-[#D4AF37] shrink-0" />
          <div>
            <strong className="text-white">Horário de Atendimento:</strong> Segunda a Sábado, das 09:00 às 19:00
          </div>
        </div>
      </div>

      {/* Studio Policies */}
      <div className="space-y-2 pt-1">
        <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
          Políticas & Recomendações:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-neutral-400">
          <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-white/5">
            <strong className="text-neutral-200 block mb-0.5">⏰ Tolerância:</strong>
            Máximo de 10 min de atraso para preservar a qualidade do serviço.
          </div>
          <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-white/5">
            <strong className="text-neutral-200 block mb-0.5">🔄 Reagendamento:</strong>
            Avisar com no mínimo 24h de antecedência pelo WhatsApp.
          </div>
          <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-white/5">
            <strong className="text-neutral-200 block mb-0.5">👁️ Preparo dos Fios:</strong>
            Comparecer sem máscara de cílios ou rímel à prova d&apos;água.
          </div>
        </div>
      </div>
    </div>
  );
}
