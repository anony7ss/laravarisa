'use client';

import { Check, Clock3 } from 'lucide-react';

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
      <div className="flex items-baseline justify-between border-b border-[#cfcfc9] pb-3">
        <div>
          <span className="text-[11px] font-bold tracking-[0.18em] text-[var(--color-ember)] uppercase font-mono">
            Passo 01
          </span>
          <h2 className="text-2xl md:text-3xl font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)] mt-0.5">
            Escolha o Procedimento
          </h2>
        </div>
        <span className="text-xs text-[#595952]">
          {services.length} opções
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {services.map((service, index) => {
          const isSelected = selectedService?.id === service.id;
          const isPopular = service.category === 'Marcante';

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelectService(service)}
              className={`text-left p-5 rounded-[24px] transition-all duration-200 flex flex-col justify-between cursor-pointer border ${
                isSelected
                  ? 'bg-[var(--color-obsidian)] text-white border-[var(--color-obsidian)] shadow-md scale-[1.01]'
                  : 'bg-[var(--color-limestone)] text-[var(--color-obsidian)] border-[#d6d6cf] hover:border-[var(--color-obsidian)] hover:bg-[#ffffff]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className={`text-[11px] uppercase font-bold tracking-wider ${isSelected ? 'text-[var(--color-ember)]' : 'text-[#595952]'}`}>
                    {String(index + 1).padStart(2, '0')} · {service.category}
                  </span>
                  {isPopular && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isSelected ? 'bg-[var(--color-ember)] text-white' : 'bg-[#e2e2df] text-[var(--color-obsidian)]'}`}>
                      Destaque
                    </span>
                  )}
                </div>

                <h3 className={`text-lg md:text-xl font-[family-name:var(--font-display)] uppercase tracking-tight leading-tight ${isSelected ? 'text-white' : 'text-[var(--color-obsidian)]'}`}>
                  {service.name}
                </h3>

                <p className={`text-xs mt-1.5 line-clamp-2 ${isSelected ? 'text-[#c2c2bc]' : 'text-[#595952]'}`}>
                  {service.description}
                </p>
              </div>

              <div className={`pt-4 mt-4 border-t flex items-center justify-between ${isSelected ? 'border-white/10' : 'border-[#e2e2df]'}`}>
                <span className={`flex items-center gap-1 text-xs ${isSelected ? 'text-[#c2c2bc]' : 'text-[#595952]'}`}>
                  <Clock3 size={13} />
                  {service.duration}
                </span>
                <span className={`text-base font-bold font-[family-name:var(--font-display)] tracking-tight ${isSelected ? 'text-[var(--color-sulfur)]' : 'text-[var(--color-ember)]'}`}>
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
