'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  MessageCircle,
  Mail,
  MapPin,
  ArrowUp,
  Clock,
  X,
} from 'lucide-react';
import { studio } from '@/lib/studio';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
export function SiteFooter() {
  const [demo, setDemo] = useState(false);
  const social = (label: string, href: string, icon: React.ReactNode) =>
    studio.demo || !href ? (
      <button onClick={() => setDemo(true)} className="social-link">
        {icon}
        {label}
        <ArrowUpRight size={16} />
      </button>
    ) : (
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
    );
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
            {social(
              'WhatsApp',
              studio.whatsappNumber
                ? `https://wa.me/${studio.whatsappNumber}`
                : '',
              <MessageCircle size={19} />,
            )}
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
            {studio.mapsUrl && !studio.demo && (
              <a
                className="footer-map"
                href={studio.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no mapa <ArrowUpRight size={16} />
              </a>
            )}
          </div>
          <div className="footer-column">
            <h3>Contato</h3>
            {social(studio.email, `mailto:${studio.email}`, <Mail size={18} />)}
            {social(
              studio.whatsapp,
              studio.whatsappNumber
                ? `https://wa.me/${studio.whatsappNumber}`
                : '',
              <MessageCircle size={18} />,
            )}
            {studio.demo && (
              <span className="demo-badge">
                Contatos e endereço demonstrativos
              </span>
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
      <Dialog open={demo} onOpenChange={setDemo}>
        <DialogContent className="booking-dialog" showCloseButton={false}>
          <DialogClose className="dialog-x" aria-label="Fechar">
            <X />
          </DialogClose>
          <DialogTitle className="booking-title">
            Contato de exemplo
          </DialogTitle>
          <DialogDescription className="booking-description">
            Os canais e o endereço desta prévia são demonstrativos. Os links
            serão ativados com os dados reais da Lara.
          </DialogDescription>
          <DialogClose className="button">Entendi</DialogClose>
        </DialogContent>
      </Dialog>
    </footer>
  );
}

