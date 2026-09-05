'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function WhatsAppButton() {
  const pathname = usePathname();
  // Don't show in admin area
  if (pathname?.startsWith('/admin')) return null;

  return (
    <a
      href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20um%20hor%C3%A1rio%21"
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
      aria-label="Agendar no WhatsApp"
    >
      <MessageCircle size={28} />
    </a>
  );
}
