'use client';
import { useState, type SyntheticEvent } from 'react';
import { ArrowUpRight, Mail, MessageCircle, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { composeMessage, contactUrl, type ContactMessage } from '@/lib/studio';
export function ContactSection() {
  const [draft, setDraft] = useState<ContactMessage | null>(null);
  const [error, setError] = useState('');
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (key: string) => {
      const value = data.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const message = {
      name: field('name'),
      email: field('email'),
      phone: field('phone'),
      message: field('message'),
    };
    if (message.name.length < 2 || message.message.length < 10) {
      setError(
        'Preencha seu nome e uma mensagem com pelo menos 10 caracteres.',
      );
      return;
    }
    setError('');
    setDraft(message);
  }
  const url = draft ? contactUrl(draft) : null;
  return (
    <section id="contato" className="contact-section wrap section">
      <div className="contact-copy reveal">
        <p className="eyebrow">05 / VAMOS CONVERSAR</p>
        <h2>
          UM OLÁ.
          <br />
          UM NOVO <em>OLHAR.</em>
        </h2>
        <p>
          Quer escolher um efeito ou tirar uma dúvida? Conte um pouco do que
          você procura.
        </p>
        <div className="contact-channels">
          <span>
            <MessageCircle size={21} />
            Uma conversa, sem compromisso.
          </span>
          <span>
            <Mail size={21} />
            Sua mensagem, com atenção aos detalhes.
          </span>
        </div>
      </div>
      <form className="contact-form reveal" onSubmit={submit}>
        <div className="form-heading">
          <span>Fale com a Lara</span>
          <ArrowUpRight size={25} />
        </div>
        <div className="form-grid">
          <label htmlFor="contact-name">
            Seu nome
            <Input
              id="contact-name"
              name="name"
              autoComplete="name"
              placeholder="Como podemos chamar você?"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label htmlFor="contact-email">
            E-mail
            <Input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@email.com"
              required
              maxLength={120}
            />
          </label>
        </div>
        <label htmlFor="contact-phone">
          WhatsApp <span className="optional">(opcional)</span>
          <Input
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(DDD) número"
            maxLength={24}
          />
        </label>
        <label htmlFor="contact-message">
          O que você tem em mente?
          <Textarea
            id="contact-message"
            name="message"
            placeholder="Quero saber mais sobre os estilos e o agendamento…"
            required
            minLength={10}
            maxLength={1500}
            rows={4}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="form-privacy">
          Seus dados ficam apenas nesta página até você decidir continuar no
          canal de contato.
        </p>
        <button className="button" type="submit">
          Enviar dúvida
          <ArrowUpRight size={19} />
        </button>
      </form>
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="contact-dialog" showCloseButton={false}>
          <DialogClose className="dialog-x" aria-label="Fechar">
            <X />
          </DialogClose>
          <DialogTitle className="booking-title">Sua mensagem</DialogTitle>
          <DialogDescription className="booking-description">
            Confira os dados antes de continuar. O envio será concluído no
            WhatsApp.
          </DialogDescription>
          <pre className="message-preview">
            {draft ? composeMessage(draft) : ''}
          </pre>
          {url && (
            <a
              className="button"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Continuar no WhatsApp <ArrowUpRight size={18} />
            </a>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
