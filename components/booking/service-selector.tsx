'use client';

import { Check, Clock, Sparkles, CalendarSync } from 'lucide-react';
import type { LashService } from '@/lib/services';

export type ServiceItem = {
  id: string;
  slug?: string;
  name: string;
  category: string;
  description: string;
  price: string;
  duration: string;
  durationMinutes?: number;
  maintenance: string;
  intensity: 1 | 2 | 3;
};

const categoryBadges: Record<string, string> = {
  Natural: 'Sutil & Clássico',
  Marcante: 'Mais Pedido ★',
  Texturizado: 'Profundidade Leve',
  Alongado: 'Efeito Delineado',
  Intenso: 'Densidade Máxima',
  'Fios naturais': 'Sem Extensão',
  Cuidado: 'Saúde dos Fios',
};

export function ServiceSelector({
  services,
  selectedService,
  onSelectService,
}: {
  services: ServiceItem[];
  selectedService: ServiceItem | null;
  onSelectService: (service: ServiceItem) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold tracking-[0.2em] text-[#D4AF37] uppercase">
            Etapa 1 de 3
          </span>
          <h2 className="text-xl md:text-2xl font-serif tracking-tight text-white mt-0.5">
            Escolha seu Procedimento
          </h2>
        </div>
        <span className="text-xs text-neutral-400">
          {services.length} opções disponíveis
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {services.map((service) => {
          const isSelected = selectedService?.id === service.id;
          const badge = categoryBadges[service.category] || service.category;
          const isPopular = service.category === 'Marcante';

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelectService(service)}
              className={`group relative text-left p-4 rounded-xl transition-all duration-300 border flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-b from-[#1a1610] to-[#121110] border-[#D4AF37] shadow-[0_0_25px_-5px_rgba(212,175,55,0.25)] ring-1 ring-[#D4AF37]'
                  : 'bg-neutral-900/60 hover:bg-neutral-900 border-white/10 hover:border-neutral-700 text-neutral-300'
              }`}
            >
              {/* Top Row: Name & Badge */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                      isPopular
                        ? 'bg-[#D4AF37]/20 text-[#E7C969] border border-[#D4AF37]/40'
                        : isSelected
                          ? 'bg-white/10 text-white border border-white/20'
                          : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {isPopular && <Sparkles size={11} className="text-[#D4AF37]" />}
                    {badge}
                  </span>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-[#D4AF37] text-black scale-110'
                        : 'border border-neutral-700 text-transparent group-hover:border-neutral-500'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </div>
                </div>

                <h3 className="text-base md:text-lg font-medium text-white group-hover:text-[#F3E5AB] transition-colors">
                  {service.name}
                </h3>

                <p className="text-xs text-neutral-400 line-clamp-2 mt-1 mb-3">
                  {service.description}
                </p>
              </div>

              {/* Bottom Row: Metadata & Price */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-[#D4AF37]" />
                    {service.duration}
                  </span>
                  <span className="flex items-center gap-1 hidden sm:inline-flex">
                    <CalendarSync size={12} className="text-neutral-500" />
                    {service.maintenance}
                  </span>
                </div>

                <span className="text-sm font-semibold text-[#D4AF37] tracking-tight">
                  {service.price}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
