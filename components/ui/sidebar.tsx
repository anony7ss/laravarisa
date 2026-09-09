'use client';

import { cn } from '@/lib/utils';
import Link, { type LinkProps } from 'next/link';
import React, { useState, createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

export interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
  badge?: React.ReactNode;
  active?: boolean;
  target?: string;
  onClick?: () => void;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined,
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<'div'>)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        'h-screen sticky top-0 px-3 py-5 hidden md:flex md:flex-col bg-[#161614]/95 backdrop-blur-2xl text-[#f7f6f2] w-[280px] flex-shrink-0 border-r border-white/10 select-none overflow-hidden z-30',
        className,
      )}
      animate={{
        width: animate ? (open ? '280px' : '68px') : '280px',
      }}
      transition={{
        duration: 0.22,
        ease: [0.25, 1, 0.5, 1],
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) => {
  const { open, setOpen } = useSidebar();
  return (
    <div
      className={cn(
        'h-12 px-4 flex flex-row md:hidden items-center justify-between bg-[#161614] text-[#f7f6f2] w-full border-b border-white/10',
      )}
      {...props}
    >
      <div className="flex items-center justify-between w-full z-20">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#fc5000] flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-sm">
            LV
          </div>
          <span className="font-medium text-sm text-white tracking-wide">
            Lara Varisa
          </span>
        </div>
        <button
          type="button"
          aria-label="Abrir menu de navegação"
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{
              duration: 0.28,
              ease: [0.32, 0.72, 0, 1],
            }}
            className={cn(
              'fixed h-full w-full inset-0 bg-[#161614] text-[#f7f6f2] p-6 z-[100] flex flex-col justify-between shadow-2xl overflow-y-auto',
              className,
            )}
          >
            <div
              className="absolute right-5 top-5 z-50 p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              onClick={() => setOpen(false)}
              role="button"
              tabIndex={0}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps;
}) => {
  const { open, setOpen, animate } = useSidebar();
  const isActive = link.active;

  return (
    <Link
      href={link.href}
      target={link.target}
      onClick={() => {
        if (link.onClick) link.onClick();
        setOpen(false);
      }}
      className={cn(
        'flex items-center gap-3 px-2.5 h-10 rounded-xl text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors duration-150 group/sidebar relative overflow-hidden',
        isActive &&
          'bg-gradient-to-r from-[#fc5000]/20 to-[#fc5000]/10 text-white font-medium shadow-sm border border-[#fc5000]/30',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-colors',
          isActive
            ? 'text-[#fc5000]'
            : 'text-neutral-400 group-hover/sidebar:text-white',
        )}
      >
        {link.icon}
      </div>

      <motion.span
        animate={{
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: 0.15 }}
        className="text-sm group-hover/sidebar:translate-x-0.5 transition-transform duration-150 whitespace-nowrap overflow-hidden text-ellipsis flex-1 !p-0 !m-0"
      >
        {link.label}
      </motion.span>

      {link.badge && (
        <motion.div
          animate={{
            display: animate ? (open ? 'flex' : 'none') : 'flex',
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className="ml-auto"
        >
          {link.badge}
        </motion.div>
      )}
    </Link>
  );
};
