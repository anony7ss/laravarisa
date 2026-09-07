'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowUpRight,
  CalendarDays,
  ContactRound,
  ExternalLink,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Scissors,
  Moon,
  Sun,
  X,
  Settings,
  HeartHandshake
} from 'lucide-react';
import { useState, useEffect } from 'react';

const links = [
  ['/admin/dashboard', 'Visão geral', LayoutDashboard],
  ['/admin/dashboard/agenda', 'Agenda', CalendarDays],
  ['/admin/dashboard/leads', 'Leads', MessageSquareText],
  ['/admin/dashboard/clientes', 'Clientes', ContactRound],
  ['/admin/dashboard/servicos', 'Serviços', Scissors],
  ['/admin/dashboard/galeria', 'Galeria', Image],
  ['/admin/dashboard/depoimentos', 'Depoimentos', HeartHandshake],
  ['/admin/dashboard/configuracoes', 'Configurações', Settings],
] as const;

const mobileLinks = links.slice(0, 4);

const pageNames: Record<string, string> = {
  '/admin/dashboard': 'Visão geral',
  '/admin/dashboard/agenda': 'Agenda',
  '/admin/dashboard/leads': 'Leads',
  '/admin/dashboard/clientes': 'Clientes',
  '/admin/dashboard/servicos': 'Serviços',
  '/admin/dashboard/galeria': 'Galeria',
  '/admin/dashboard/depoimentos': 'Depoimentos',
  '/admin/dashboard/configuracoes': 'Configurações',
};

export function AdminShell({
  children,
  name,
  role,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('admin-theme');
    if (saved === 'dark') setDarkMode(true);
  }, []);

  useEffect(() => {
    const root = document.querySelector('.admin-root');
    if (root) {
      if (darkMode) {
        root.classList.add('dark');
        localStorage.setItem('admin-theme', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('admin-theme', 'light');
      }
    }
  }, [darkMode]);
  const roleLabel =
    role === 'admin'
      ? 'Administrador'
      : role === 'editor'
        ? 'Editor'
        : 'Leitura';

  useEffect(() => {
    document.cookie = 'lv_staff=1; path=/; max-age=604800; SameSite=Lax';
  }, []);

  async function logout() {
    document.cookie =
      'lv_staff=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.assign('/admin/login');
  }

  return (
    <div className="admin-shell">
      <aside className={open ? 'admin-sidebar open' : 'admin-sidebar'}>
        <div className="admin-sidebar-head">
          <Link href="/admin/dashboard" onClick={() => setOpen(false)}>
            <span className="admin-brand-copy">
              <strong>Lara Varisa</strong>
              <small>Lash designer</small>
            </span>
          </Link>
          <button aria-label="Fechar menu" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <p className="admin-nav-label">GESTÃO</p>
        <nav aria-label="Navegação administrativa">
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? 'active' : ''}
              aria-current={pathname === href ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="admin-nav-icon">
                <Icon size={18} />
              </span>
              <span>{label}</span>
              {pathname === href && <span className="admin-active-dot" />}
            </Link>
          ))}
        </nav>
        <Link className="admin-site-link" href="/" target="_blank">
          <span>
            <ExternalLink size={17} /> Abrir o site
          </span>
          <ArrowUpRight size={16} />
        </Link>
        <div className="admin-user">
          <span className="admin-avatar">
            {(name || 'A').trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="admin-user-copy">
            <strong>{name || 'Conta administrativa'}</strong>
            <small>{roleLabel}</small>
          </span>
          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Alternar tema"
            title="Alternar tema"
            style={{ marginRight: '4px' }}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={logout} aria-label="Sair do painel" title="Sair">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="admin-overlay"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="admin-main">
        <header className="admin-mobile-head">
          <span>
            <small>PAINEL</small>
            <strong>{pageNames[pathname] || 'Lara Varisa'}</strong>
          </span>
          <Link href="/" aria-label="Abrir o site">
            <ExternalLink size={19} />
          </Link>
        </header>
        {children}
        <nav className="admin-mobile-nav" aria-label="Navegação rápida">
          {mobileLinks.map(([href, label, Icon]) => (
            <Link
              href={href}
              key={href}
              className={pathname === href ? 'active' : ''}
              aria-current={pathname === href ? 'page' : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ))}
          <button onClick={() => setOpen(true)}>
            <Menu size={19} />
            <span>Mais</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
