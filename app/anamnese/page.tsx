'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function AnamnesePage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    
    try {
      const res = await fetch('/api/anamnese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      if (res.ok) setSubmitted(true);
      else alert('Erro ao enviar ficha. Tente novamente.');
    } catch (e) {
      alert('Erro ao enviar ficha.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="wrap section" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <h1 className="hero-title" style={{ fontSize: '2rem' }}>Obrigada! ✨</h1>
        <p style={{ marginTop: '16px', color: '#a1a1aa' }}>Sua ficha foi enviada com sucesso para a Lara Varisa.</p>
        <Link href="/" className="button" style={{ marginTop: '32px' }}>Voltar para a página inicial</Link>
      </main>
    );
  }

  return (
    <main className="wrap section" style={{ maxWidth: '600px', margin: '0 auto', paddingBlock: '80px' }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <p className="eyebrow">LARA VARISA</p>
        <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>Ficha de Anamnese</h1>
        <p style={{ color: '#a1a1aa', marginTop: '12px' }}>Preencha com atenção antes do seu procedimento. Sua segurança vem em primeiro lugar.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Nome Completo *</span>
          <input type="text" name="client_name" required style={{ padding: '12px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#fff' }} />
        </label>
        
        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>WhatsApp *</span>
          <input type="tel" name="client_phone" required placeholder="(DDD) 99999-9999" style={{ padding: '12px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#fff' }} />
        </label>

        <div style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Histórico de Saúde</h3>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="checkbox" name="has_allergies" value="true" />
            <span>Possui alguma alergia? (Esmaltes, colas, cosméticos)</span>
          </label>
          <input type="text" name="allergies_detail" placeholder="Se sim, quais?" style={{ padding: '12px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#fff', fontSize: '14px' }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="checkbox" name="pregnant" value="true" />
            <span>Está gestante ou amamentando?</span>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="checkbox" name="eye_surgery" value="true" />
            <span>Fez alguma cirurgia ocular recente (menos de 6 meses)?</span>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="checkbox" name="thyroid_issues" value="true" />
            <span>Possui problemas de tireoide? (Pode afetar a retenção)</span>
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Assinatura Digital (Digite seu nome) *</span>
          <input type="text" name="signature" required placeholder="Declaro que as informações são verdadeiras" style={{ padding: '12px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#fff' }} />
        </label>

        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input type="checkbox" required defaultChecked style={{ marginTop: '3px' }} />
            <span style={{ fontSize: '12px', color: '#c2c2bc', lineHeight: '1.5' }}>
              Consinto expressamente com o tratamento dos meus dados pessoais e dados sensíveis de saúde ocular nos termos do Art. 11 da <strong>LGPD (Lei nº 13.709/2018)</strong>, com a finalidade exclusiva de avaliação pré-procedimento e segurança estética. Conheça nossa{' '}
              <Link href="/privacidade" target="_blank" style={{ textDecoration: 'underline', color: '#fff' }}>Política de Privacidade</Link>.
            </span>
          </label>
        </div>

        <button type="submit" className="button" disabled={loading} style={{ marginTop: '16px', justifyContent: 'center', width: '100%' }}>
          {loading ? 'Enviando...' : 'Enviar Ficha'}
        </button>
      </form>
    </main>
  );
}
