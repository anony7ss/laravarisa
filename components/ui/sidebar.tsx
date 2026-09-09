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
        'h-screen sticky top-0 px-3 py-5 hidden md:flex md:flex-col bg-[#f4f3ec] dark:bg-[#161614]/95 backdrop-blur-2xl text-[#11110f] dark:text-[#f7f6f2] w-[280px] flex-shrink-0 border-r border-black/[0.08] dark:border-white/10 select-none overflow-hidden z-30',
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
            'fixed h-full w-full inset-0 bg-[#fbfaf6] dark:bg-[#141412] text-[#11110f] dark:text-[#f7f6f2] p-6 z-[100] flex flex-col justify-between shadow-2xl overflow-y-auto md:hidden',
            className,
          )}
          {...(props as any)}
        >
          <div
            className="absolute right-5 top-5 z-50 p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-black/5 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-white/10 cursor-pointer transition-colors"
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
        'flex items-center gap-3 px-2.5 h-10 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors duration-150 group/sidebar relative overflow-hidden',
        isActive &&
          'bg-[#fc5000]/10 dark:bg-gradient-to-r dark:from-[#fc5000]/20 dark:to-[#fc5000]/10 text-[#fc5000] dark:text-white font-medium shadow-sm border border-[#fc5000]/30',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-colors',
          isActive
            ? 'text-[#fc5000]'
            : 'text-neutral-500 dark:text-neutral-400 group-hover/sidebar:text-neutral-900 dark:group-hover/sidebar:text-white',
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
