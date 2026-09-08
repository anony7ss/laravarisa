import { MapPin, Clock3, Sparkles } from 'lucide-react';

export function StudioCard() {
  return (
    <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#e2e2df] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#595952] w-full max-w-full overflow-hidden">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full flex-1">
        <div className="w-8 h-8 rounded-full bg-[#f7f6f2] flex items-center justify-center text-[var(--color-obsidian)] shrink-0">
          <MapPin size={15} className="text-[var(--color-ember)]" />
        </div>
        <div className="min-w-0 flex-1">
          <strong className="text-xs sm:text-sm font-semibold text-[var(--color-obsidian)] block truncate">
            Studio Lara Varisa · Zona Norte, Porto Alegre
          </strong>
          <p className="text-[11px] text-[#7a7a72] leading-snug break-words">
            O endereço exato e orientações são enviados no seu WhatsApp.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0f0ed] w-full sm:w-auto">
        <span className="flex items-center gap-1 bg-[#f7f6f2] px-2.5 py-1 rounded-full text-[#595952] whitespace-nowrap">
          <Clock3 size={11} className="text-[var(--color-ember)] shrink-0" />
          10 min tolerância
        </span>
        <span className="flex items-center gap-1 bg-[#f7f6f2] px-2.5 py-1 rounded-full text-[#595952] whitespace-nowrap">
          <Sparkles size={11} className="text-[var(--color-ember)] shrink-0" />
          Individual
        </span>
      </div>
    </div>
  );
}
