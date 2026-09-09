'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { studio } from '@/lib/studio';

export function SiteHeader() {
  const [menu, setMenu] = useState(false);

  return (
    <header className="header wrap">
      <Link href="/" className="brand" aria-label="Lara Varisa — início">
        <Image
          className="brand-monogram"
          src="/logo-emblem.png"
          width={48}
          height={48}
          alt="Lara Varisa"
          priority
        />
        <span className="brand-wordmark">Lara Varisa</span>
      </Link>
      <nav
        aria-label="Navegação principal"
        className={menu ? 'nav open' : 'nav'}
      >
        <a href="#estilos" onClick={() => setMenu(false)}>
          Seu estilo
        </a>
        <a href="#galeria" onClick={() => setMenu(false)}>
          Galeria
        </a>
        <a href="#contato" onClick={() => setMenu(false)}>
          Contato
        </a>
        <a href="#duvidas" onClick={() => setMenu(false)}>
          Dúvidas
        </a>
      </nav>
      <Link
        className="button header-cta"
        href="/agendar"
      >
        Agendar agora <ArrowUpRight size={18} />
      </Link>
      <button
        className="menu-toggle"
        aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menu}
        onClick={() => setMenu(!menu)}
      >
        {menu ? <X /> : <Menu />}
      </button>
    </header>
  );
}

export const Header = SiteHeader;
export default SiteHeader;
