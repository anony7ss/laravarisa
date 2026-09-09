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
  HeartHandshake,
  Bell,
  Bot,
  SendHorizontal,
  DollarSign,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { NotificationCenter } from '@/components/admin/notification-center';

function playAppointmentChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Harmonic luxury two-tone chime (E5 -> B5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.8);
  } catch {
    // AudioContext blocked by browser autoplay policy until user interacts
  }
}

const links = [
  ['/admin/dashboard', 'Visão geral', LayoutDashboard],
  ['/admin/dashboard/agenda', 'Agenda', CalendarDays],
  ['/admin/dashboard/leads', 'Leads', MessageSquareText],
  ['/admin/dashboard/clientes', 'Clientes', ContactRound],
  ['/admin/dashboard/financas', 'Finanças', DollarSign],
  ['/admin/dashboard/servicos', 'Serviços', Scissors],
  ['/admin/dashboard/galeria', 'Galeria', Image],
  ['/admin/dashboard/depoimentos', 'Depoimentos', HeartHandshake],
  ['/admin/dashboard/whatsapp', 'WhatsApp Bot', Bot],
  ['/admin/dashboard/configuracoes', 'Configurações', Settings],
] as const;

const mobileLinks = links.slice(0, 4);

const pageNames: Record<string, string> = {
  '/admin/dashboard': 'Visão geral',
  '/admin/dashboard/agenda': 'Agenda',
  '/admin/dashboard/leads': 'Leads',
  '/admin/dashboard/clientes': 'Clientes',
  '/admin/dashboard/financas': 'Finanças & Fluxo de Caixa',
  '/admin/dashboard/servicos': 'Serviços',
  '/admin/dashboard/galeria': 'Galeria',
  '/admin/dashboard/depoimentos': 'Depoimentos',
  '/admin/dashboard/whatsapp': 'WhatsApp Bot',
  '/admin/dashboard/configuracoes': 'Configurações',
};

let lastAppointmentsFetchTime = 0;
let cachedScheduledCount = 0;

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
  const [pendingCount, setPendingCount] = useState(cachedScheduledCount);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let initialRun = true;

    async function checkAppointments(force = false) {
      if (typeof document !== 'undefined' && document.hidden && !force) return;

      const now = Date.now();
      if (!force && now - lastAppointmentsFetchTime < 20000) {
        if (isMounted) setPendingCount(cachedScheduledCount);
        return;
      }

      try {
        const res = await fetch('/api/admin/appointments');
        if (!res.ok) return;
        const json = await res.json();
        if (!json.ok || !Array.isArray(json.data)) return;

        const count = json.data.filter(
          (item: { status: string }) => item.status === 'scheduled',
        ).length;

        lastAppointmentsFetchTime = Date.now();
        cachedScheduledCount = count;

        if (!isMounted) return;

        setPendingCount((prev) => {
          if (!initialRun && count > prev) {
            playAppointmentChime();
          }
          return count;
        });
        initialRun = false;
      } catch {
        // network or auth error
      }
    }

    checkAppointments();
    const interval = setInterval(() => checkAppointments(), 35000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        checkAppointments(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin-theme');
      const hasDarkClass =
        document.querySelector('.admin-root')?.classList.contains('dark') ||
        document.documentElement.classList.contains('dark');
      if (saved === 'dark' || (saved === null && hasDarkClass)) {
        setDarkMode(true);
        document.cookie = 'admin-theme=dark; path=/; max-age=31536000; SameSite=Lax';
      } else if (saved === 'light') {
        document.cookie = 'admin-theme=light; path=/; max-age=31536000; SameSite=Lax';
      }
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.querySelector('.admin-root');
    if (root) {
      if (darkMode) {
        root.classList.add('dark');
        document.documentElement.classList.add('dark');
        try {
          localStorage.setItem('admin-theme', 'dark');
          document.cookie = 'admin-theme=dark; path=/; max-age=31536000; SameSite=Lax';
        } catch {}
      } else {
        root.classList.remove('dark');
        document.documentElement.classList.remove('dark');
        try {
          localStorage.setItem('admin-theme', 'light');
          document.cookie = 'admin-theme=light; path=/; max-age=31536000; SameSite=Lax';
        } catch {}
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
          <div className="admin-sidebar-head-actions">
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="admin-bell-btn"
              title={
                notificationsCount > 0
                  ? `${notificationsCount} novidade(s) na central`
                  : 'Central de Notificações'
              }
              aria-label="Abrir central de notificações"
            >
              <Bell size={17} />
              {notificationsCount > 0 && (
                <span className="admin-bell-badge">{notificationsCount}</span>
              )}
            </button>
            <button
              className="admin-sidebar-close"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
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
              {href === '/admin/dashboard/agenda' && pendingCount > 0 && (
                <span
                  className="admin-nav-badge"
                  title={`${pendingCount} aguardando`}
                >
                  {pendingCount}
                </span>
              )}
              {pathname === href &&
                (href !== '/admin/dashboard/agenda' || pendingCount === 0) && (
                  <span className="admin-active-dot" />
                )}
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
          <div className="admin-user-actions">
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Alternar tema"
              title="Alternar tema"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={logout} aria-label="Sair do painel" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="admin-bell-btn"
              title={`${notificationsCount} novidade(s) na central`}
              aria-label="Abrir central de notificações"
            >
              <Bell size={18} />
              {notificationsCount > 0 && (
                <span className="admin-bell-badge">{notificationsCount}</span>
              )}
            </button>
            <Link href="/" aria-label="Abrir o site">
              <ExternalLink size={19} />
            </Link>
          </div>
        </header>
        {children}
        <nav className="admin-mobile-nav" aria-label="Navegação rápida">
          {mobileLinks.map(([href, label, Icon]) => (
            <Link
              href={href}
              key={href}
              className={pathname === href ? 'active' : ''}
              aria-current={pathname === href ? 'page' : undefined}
              style={{ position: 'relative' }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {href === '/admin/dashboard/agenda' && pendingCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: 'calc(50% - 14px)',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--admin-orange, #fc5000)',
                    boxShadow: '0 0 6px rgba(252, 80, 0, 0.8)',
                  }}
                />
              )}
            </Link>
          ))}
          <button onClick={() => setOpen(true)}>
            <Menu size={19} />
            <span>Mais</span>
          </button>
        </nav>
      </div>

      <NotificationCenter
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onTotalChange={setNotificationsCount}
      />
    </div>
  );
}
