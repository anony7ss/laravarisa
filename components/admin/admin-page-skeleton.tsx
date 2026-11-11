'use client';

/**
 * AdminPageSkeleton
 * Exibido imediatamente via loading.tsx enquanto o servidor busca dados.
 * Mantém o layout (kicker + título + linhas) para evitar CLS.
 */
export function AdminPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <main className="admin-page admin-page-skeleton">
      {/* Título */}
      <div className="admin-page-title">
        <div>
          <div className="h-2.5 w-20 rounded-full bg-black/[0.07] dark:bg-white/[0.08] animate-pulse mb-2.5" />
          <div className="h-7 w-44 rounded-lg bg-black/[0.09] dark:bg-white/[0.12] animate-pulse" />
        </div>
      </div>

      {/* Barra de ações simulada */}
      <div className="flex gap-3 mt-1 mb-5">
        <div className="h-9 w-32 rounded-xl bg-black/[0.06] dark:bg-white/[0.07] animate-pulse" />
        <div className="h-9 w-24 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
      </div>

      {/* Linhas de conteúdo */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] animate-pulse"
            style={{ animationDelay: `${i * 55}ms`, opacity: 1 - i * 0.08 }}
          />
        ))}
      </div>
    </main>
  );
}
