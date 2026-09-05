'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  Camera,
  MessageCircle,
  MapPin,
  ArrowUp,
  Clock,
} from 'lucide-react';
import { studio } from '@/lib/studio';
export function SiteFooter() {
  const social = (label: string, href: string, icon: React.ReactNode) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="social-link"
      >
        {icon}
        {label}
        <ArrowUpRight size={16} />
      </a>
    ) : null;
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-intro">
          <p>Seu olhar, com a sua essência.</p>
          <Link href="/#contato" className="footer-talk">
            Vamos conversar <ArrowUpRight size={20} />
          </Link>
        </div>
        <div className="footer-columns">
          <div className="footer-column">
            <h3>Acompanhe</h3>
            {social('Instagram', studio.instagramUrl, <Camera size={19} />)}
            {social('WhatsApp', studio.bookingUrl, <MessageCircle size={19} />)}
            <span className="footer-handle">{studio.instagram}</span>
          </div>
          <div className="footer-column">
            <h3>Encontre a Lara</h3>
            <address>
              <MapPin size={18} />
              <span>
                {studio.address}
                <br />
                {studio.city}
              </span>
            </address>
            <p className="footer-hours">
              <Clock size={18} />
              {studio.hours}
            </p>
          </div>
          <div className="footer-column">
            <h3>Contato</h3>
            {social(
              studio.whatsapp,
              studio.bookingUrl,
              <MessageCircle size={18} />,
            )}
          </div>
          <nav className="footer-column" aria-label="Links do rodapé">
            <h3>Explore</h3>
            <Link href="/#estilos">Estilos</Link>
            <Link href="/galeria">Galeria completa</Link>
            <Link href="/#duvidas">Dúvidas frequentes</Link>
            <Link href="/#contato">Fale com a Lara</Link>
          </nav>
        </div>
        <div className="footer-signature" aria-hidden="true">
          Lara Varisa<span>LV</span>
        </div>
        <div className="footer-legal">
          <span>© {new Date().getFullYear()} Lara Varisa</span>
          <span>Beleza em cada detalhe.</span>
          <a href="#conteudo">
            Voltar ao topo <ArrowUp size={15} />
          </a>
        </div>
      </div>
    </footer>
  );
}
