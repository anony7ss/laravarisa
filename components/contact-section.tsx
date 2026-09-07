'use client';
import { useCallback, useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Mail, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Turnstile } from '@/components/turnstile';
export function ContactSection() {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const onTurnstileToken = useCallback(
    (token: string) => setTurnstileToken(token),
    [],
  );
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const field = (key: string) => {
      const value = data.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const message = {
      name: field('name'),
      email: field('email'),
      phone: field('phone'),
      message: field('message'),
      website: field('website'),
      turnstileToken,
    };
    if (message.name.length < 2 || message.message.length < 10) {
      setError(
        'Preencha seu nome e uma mensagem com pelo menos 10 caracteres.',
      );
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || 'Não foi possível enviar.');
      form.reset();
      setSent(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível enviar agora.',
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <section id="contato" className="contact-section wrap section">
      <div className="contact-copy reveal">
        <p className="eyebrow">06 / VAMOS CONVERSAR</p>
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
        {!sent ? (
          <>
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
                placeholder="(51) 98960-0000"
                maxLength={15}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  if (value.length > 11) value = value.slice(0, 11);
                  if (value.length > 2) {
                    value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                  }
                  if (value.length > 9) {
                    value = `${value.slice(0, 10)}-${value.slice(10)}`;
                  }
                  e.target.value = value;
                }}
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
            <Turnstile onToken={onTurnstileToken} />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <p className="form-privacy">
              Seus dados estão protegidos nos termos da <strong>LGPD (Lei 13.709/18)</strong> e são utilizados exclusivamente para responder à sua mensagem. Veja nossa{' '}
              <Link href="/privacidade" target="_blank" style={{ textDecoration: 'underline' }}>
                Política de Privacidade
              </Link>.
            </p>
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? 'Enviando sua mensagem…' : 'Enviar dúvida'}
              {!submitting && <ArrowUpRight size={19} />}
            </button>
          </>
        ) : (
          <div className="form-success-state" role="status" style={{ animation: 'fade-in 0.5s ease-out' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f6f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: '#a02c00' }}>
              <Check size={24} />
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '8px' }}>Mensagem enviada!</h3>
            <p style={{ color: '#4b4b46', lineHeight: '1.5' }}>
              Obrigado por entrar em contato. A Lara responderá o mais breve possível pelo contato informado.
            </p>
            <button className="button" style={{ marginTop: '24px', background: 'transparent', color: '#a02c00', border: '1px solid #a02c00' }} type="button" onClick={() => setSent(false)}>
              Enviar outra mensagem
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
