import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SiteFooter } from '@/components/site-footer';

export default function NotFound() {
  return (
    <div>
      <header className="header wrap">
        <Link href="/" className="brand" aria-label="Lara Varisa — início">
          <img
            className="brand-monogram"
            src="/lv-monogram.svg"
            width="48"
            height="48"
            alt=""
          />
          <span className="brand-wordmark">Lara Varisa</span>
        </Link>
      </header>

      <main style={{ minHeight: '65vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '40px 20px' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: '16px' }}>ERRO 404</p>
          <h1 style={{ fontSize: 'clamp(48px, 8vw, 86px)', lineHeight: 1, margin: '0 0 24px', letterSpacing: '-0.02em', textWrap: 'balance' }}>
            PÁGINA NÃO <em>ENCONTRADA.</em>
          </h1>
          <p style={{ color: '#50504a', fontSize: '18px', maxWidth: '400px', margin: '0 auto 32px' }}>
            Parece que o caminho que você tentou acessar não existe ou foi movido.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Link href="/" className="button" style={{ minHeight: '54px', padding: '0 24px', gap: '12px' }}>
              Voltar ao início <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
