import { MapPin, Clock3, Sparkles } from 'lucide-react';

export function StudioCard() {
  return (
    <div className="bg-[var(--color-limestone)] p-5 md:p-6 rounded-[32px] border border-[#d6d6cf] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-[#595952]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#e2e2df] flex items-center justify-center text-[var(--color-obsidian)] shrink-0">
          <MapPin size={18} />
        </div>
        <div>
          <strong className="text-sm font-[family-name:var(--font-display)] uppercase tracking-tight text-[var(--color-obsidian)] block">
            Atelier Lara Varisa · Zona Norte
          </strong>
          <p className="text-[12px] mt-0.5">
            Porto Alegre, RS · O endereço detalhado e orientações de chegada são enviados no seu WhatsApp após a confirmação.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] pt-3 md:pt-0 border-t md:border-t-0 border-[#e2e2df] w-full md:w-auto">
        <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-[#d6d6cf]">
          <Clock3 size={13} className="text-[var(--color-ember)]" />
          10 min de tolerância
        </span>
        <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-[#d6d6cf]">
          <Sparkles size={13} className="text-[var(--color-ember)]" />
          Atendimento 100% individual
        </span>
      </div>
    </div>
  );
}
