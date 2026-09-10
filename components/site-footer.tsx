'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  MessageCircle,
  MapPin,
  ArrowUp,
  Clock,
  Camera,
  Mail,
  Navigation,
} from 'lucide-react';
import { studio } from '@/lib/studio';
export function SiteFooter() {
  const social = (label: string, href: string, icon: React.ReactNode) =>
    href ? (
      <a
        href={href}
        target={href.startsWith('#') || href.startsWith('/') ? undefined : '_blank'}
        rel={href.startsWith('#') || href.startsWith('/') ? undefined : 'noopener noreferrer'}
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
          <p>Realçando a beleza do seu olhar.</p>
          <Link href="/#contato" className="footer-talk">
            Vamos conversar <ArrowUpRight size={20} />
          </Link>
        </div>
        <div className="footer-columns">
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
            <Link className="social-link" href="/localizacao">
              <Navigation size={18} />
              Ver localização e como chegar
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="footer-column">
            <h3>Contato</h3>
            {social(
              studio.whatsapp,
              studio.bookingUrl,
              <MessageCircle size={18} />,
            )}
            {social(
              studio.instagram,
              studio.instagramUrl,
              <Camera size={18} />,
            )}
            {social(studio.email, studio.emailUrl, <Mail size={18} />)}
          </div>
          <nav className="footer-column" aria-label="Links do rodapé">
            <h3>Explore</h3>
            <Link href="/#estilos">Estilos</Link>
            <Link href="/servicos">Serviços e valores</Link>
            <Link href="/galeria">Galeria completa</Link>
            <Link href="/localizacao">Localização</Link>
            <Link href="/#duvidas">Dúvidas frequentes</Link>
            <Link href="/#contato">Fale com a Lara</Link>
          </nav>
        </div>
        <div className="footer-signature" aria-hidden="true">
          Lara Varisa
        </div>
        <div className="footer-legal">
          <div className="footer-legal-policies">
            <Link href="/privacidade" className="footer-policy-link">
              Privacidade & LGPD
            </Link>
            <span className="footer-policy-sep" aria-hidden="true">·</span>
            <Link href="/termos" className="footer-policy-link">
              Termos de Agendamento
            </Link>
            <span className="footer-policy-sep" aria-hidden="true">·</span>
            <Link href="/politica-de-cookies" className="footer-policy-link">
              Cookies
            </Link>
          </div>
          <div className="footer-legal-bottom">
            <div className="flex items-center gap-2">
              <span className="footer-copyright">
                © {new Date().getFullYear()} Lara Varisa · Porto Alegre, RS
              </span>
            </div>
            <a href="#conteudo" className="footer-back-top">
              Voltar ao topo <ArrowUp size={14} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
