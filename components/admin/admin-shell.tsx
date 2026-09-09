'use client';

import Link from 'next/link';
import NextImage from 'next/image';
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
import { motion } from 'framer-motion';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
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
      <Sidebar open={open} setOpen={setOpen} animate={true}>
        <SidebarBody className="justify-between gap-6">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {/* Top Logo */}
            <div className="flex items-center justify-between py-1 mb-5 px-1 h-11 flex-shrink-0 overflow-hidden">
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-3 group overflow-hidden h-full"
                onClick={() => setOpen(false)}
              >
                <div className="h-9 w-9 rounded-xl bg-[#fc5000]/10 dark:bg-white/[0.06] border border-[#fc5000]/25 dark:border-white/10 flex items-center justify-center p-1 shadow-sm flex-shrink-0">
                  <NextImage
                    src="/logo-emblem.png"
                    alt="Lara Varisa"
                    width={36}
                    height={36}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
                <motion.div
                  animate={{
                    opacity: open ? 1 : 0,
                    display: open ? 'flex' : 'none',
                  }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col min-w-0 overflow-hidden whitespace-nowrap"
                >
                  <strong className="text-neutral-900 dark:text-white text-sm font-semibold tracking-tight whitespace-nowrap leading-tight">
                    Lara Varisa
                  </strong>
                  <small className="text-neutral-500 dark:text-neutral-400 text-[10px] tracking-widest uppercase font-medium">
                    Lash Designer
                  </small>
                </motion.div>
              </Link>
            </div>

            {/* Navigation links */}
            <div className="flex flex-col gap-1">
              {links.map(([href, label, Icon]) => (
                <SidebarLink
                  key={href}
                  link={{
                    label,
                    href,
                    icon: <Icon size={18} className="flex-shrink-0" />,
                    active: pathname === href,
                    badge:
                      href === '/admin/dashboard/agenda' && pendingCount > 0 ? (
                        <span
                          className="px-1.5 py-0.5 rounded-full bg-[#fc5000] text-white text-[10px] font-bold leading-none animate-pulse shadow-sm"
                          title={`${pendingCount} aguardando`}
                        >
                          {pendingCount}
                        </span>
                      ) : undefined,
                    onClick: () => setOpen(false),
                  }}
                />
              ))}

              <div className="my-2 border-t border-black/[0.08] dark:border-white/10" />

              <SidebarLink
                link={{
                  label: 'Abrir o site',
                  href: '/',
                  target: '_blank',
                  icon: <ExternalLink size={17} className="flex-shrink-0" />,
                  badge: <ArrowUpRight size={14} className="text-neutral-400" />,
                  onClick: () => setOpen(false),
                }}
              />
            </div>
          </div>

          {/* User Profile & Actions Footer */}
          <div className="pt-3 border-t border-black/[0.08] dark:border-white/10 flex flex-col gap-2 flex-shrink-0">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] h-12 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#fc5000] text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                {(name || 'A').trim().slice(0, 1).toUpperCase()}
              </div>
              <motion.div
                animate={{
                  opacity: open ? 1 : 0,
                  display: open ? 'flex' : 'none',
                }}
                transition={{ duration: 0.15 }}
                className="flex flex-col min-w-0 flex-1 overflow-hidden whitespace-nowrap"
              >
                <strong className="text-neutral-900 dark:text-white text-xs font-medium truncate block leading-tight">
                  {name || 'Conta administrativa'}
                </strong>
                <small className="text-neutral-500 dark:text-neutral-400 text-[10px] truncate block">
                  {roleLabel}
                </small>
              </motion.div>
            </div>

            <div className="flex items-center justify-between h-9 px-1 overflow-hidden">
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="relative p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-white/10 transition-colors flex-shrink-0"
                title={
                  notificationsCount > 0
                    ? `${notificationsCount} novidade(s) na central`
                    : 'Central de Notificações'
                }
                aria-label="Abrir central de notificações"
              >
                <Bell size={16} />
                {notificationsCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#fc5000]" />
                )}
              </button>

              <motion.button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                animate={{
                  opacity: open ? 1 : 0,
                  display: open ? 'inline-flex' : 'none',
                }}
                transition={{ duration: 0.15 }}
                className="p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:text-white dark:hover:bg-white/10 transition-colors flex-shrink-0"
                aria-label="Alternar tema"
                title="Alternar tema"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </motion.button>

              <motion.button
                type="button"
                onClick={logout}
                animate={{
                  opacity: open ? 1 : 0,
                  display: open ? 'inline-flex' : 'none',
                }}
                transition={{ duration: 0.15 }}
                className="p-2 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-red-500/10 dark:text-neutral-400 dark:hover:text-red-400 transition-colors flex-shrink-0 ml-auto"
                aria-label="Sair do painel"
                title="Sair"
              >
                <LogOut size={16} />
              </motion.button>
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      <div className="admin-main">
        <header className="admin-mobile-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="h-7 w-7 rounded-lg bg-[#fc5000]/10 dark:bg-white/10 border border-[#fc5000]/25 dark:border-white/10 flex items-center justify-center p-0.5 shadow-sm flex-shrink-0">
              <NextImage
                src="/logo-emblem.png"
                alt="Lara Varisa"
                width={28}
                height={28}
                className="w-full h-full object-contain"
              />
            </div>
            <span>
              <small>PAINEL</small>
              <strong>{pageNames[pathname] || 'Lara Varisa'}</strong>
            </span>
          </div>
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
            <Link href="/" aria-label="Abrir o site" className="admin-mobile-head-link">
              <ExternalLink size={18} />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu lateral"
              className="admin-mobile-menu-btn"
            >
              <Menu size={19} />
            </button>
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
