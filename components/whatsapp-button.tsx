'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { whatsappUrl } from '@/lib/studio';

export function WhatsAppButton() {
  const pathname = usePathname();
  // Don't show in admin area or booking portal (which has its own action bar)
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/agendar')) return null;

  return (
    <a
      href={whatsappUrl('Olá, Lara! Gostaria de tirar uma dúvida sobre os procedimentos de cílios ✨')}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
      aria-label="Agendar no WhatsApp"
    >
      <MessageCircle size={28} />
    </a>
  );
}
