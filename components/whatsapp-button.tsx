'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { whatsappUrl } from '@/lib/studio';

export function WhatsAppButton() {
  const pathname = usePathname();
  // Don't show in admin area, booking portal, or anamnese form
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/agendar') || pathname?.startsWith('/anamnese')) return null;
  const destination = whatsappUrl('Olá, Lara! Gostaria de tirar uma dúvida sobre os procedimentos de cílios ✨');
  const isExternal = destination.startsWith('https://wa.me/');

  return (
    <a
      href={destination}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="whatsapp-float"
      aria-label={isExternal ? 'Agendar no WhatsApp' : 'Falar com a Lara'}
    >
      <MessageCircle size={28} />
    </a>
  );
}
