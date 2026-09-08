'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, CheckCircle, AlertCircle, FileText, Lock } from 'lucide-react';

function AnamneseForm() {
  const searchParams = useSearchParams();
  const queryName = searchParams.get('nome') || searchParams.get('name') || '';
  const queryPhone = searchParams.get('telefone') || searchParams.get('phone') || searchParams.get('whatsapp') || '';

  const formatPhone = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2);
    }
    digits = digits.slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Controlled form fields (inicia com query params se presentes)
  const [clientName, setClientName] = useState(queryName);
  const [clientPhone, setClientPhone] = useState(queryPhone ? formatPhone(queryPhone) : '');
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergiesDetail, setAllergiesDetail] = useState('');
  const [pregnant, setPregnant] = useState(false);
  const [eyeSurgery, setEyeSurgery] = useState(false);
  const [thyroidIssues, setThyroidIssues] = useState(false);
  const [signature, setSignature] = useState(queryName);
  const [consentLgpd, setConsentLgpd] = useState(true);

  // Sincroniza caso searchParams mudem
  useEffect(() => {
    if (queryName && !clientName) {
      setClientName(queryName);
    }
    if (queryName && !signature) {
      setSignature(queryName);
    }
    if (queryPhone && !clientPhone) {
      setClientPhone(formatPhone(queryPhone));
    }
  }, [queryName, queryPhone]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');

    const rawDigits = clientPhone.replace(/\D/g, '');
    if (rawDigits.length < 10 || rawDigits.length > 11) {
      setErrorMessage('Por favor, informe um WhatsApp válido com DDD (ex: 51 99999-9999).');
      return;
    }

    if (!consentLgpd) {
      setErrorMessage('É necessário consentir com o termo para enviar sua ficha.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        client_name: clientName.trim(),
        client_phone: rawDigits,
        has_allergies: hasAllergies,
        allergies_detail: hasAllergies && allergiesDetail.trim() ? allergiesDetail.trim() : null,
        pregnant,
        eye_surgery: eyeSurgery,
        thyroid_issues: thyroidIssues,
        signature: signature.trim() || clientName.trim(),
      };

      const res = await fetch('/api/anamnese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setSubmitted(true);
      } else {
        setErrorMessage(data.error || 'Erro ao enviar ficha. Revise os dados e tente novamente.');
      }
    } catch {
      setErrorMessage('Erro de conexão ao enviar a ficha. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="wrap section" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '520px', width: '100%', background: '#ffffff', border: '1px solid #d8d8d3', borderRadius: '28px', padding: '40px 32px', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.12)', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d', marginBottom: '20px' }}>
            <CheckCircle size={36} />
          </div>
          
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: 'var(--color-ember, #a02c00)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            LARA VARISA LASH
          </span>
          
          <h1 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-heading, inherit)', textTransform: 'uppercase', color: '#070607', marginTop: '6px', marginBottom: '12px' }}>
            Ficha Confirmada! ✨
          </h1>
          
          <p style={{ color: '#52524e', fontSize: '15px', lineHeight: '1.6', margin: '0 0 28px' }}>
            Obrigada, <strong>{clientName}</strong>! Suas informações de saúde ocular foram salvas com segurança no estúdio da Lara Varisa. Te esperamos para realçar seu olhar!
          </p>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            <Link
              href="/"
              style={{
                flex: 1,
                minWidth: '160px',
                padding: '14px 20px',
                borderRadius: '99px',
                border: '1px solid #d4d4ce',
                background: '#f4f4f2',
                color: '#070607',
                fontWeight: 600,
                textAlign: 'center',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              Página Inicial
            </Link>
            <Link
              href="/agendar"
              style={{
                flex: 1,
                minWidth: '160px',
                padding: '14px 20px',
                borderRadius: '99px',
                border: 'none',
                background: '#070607',
                color: '#ffffff',
                fontWeight: 600,
                textAlign: 'center',
                textDecoration: 'none',
                fontSize: '14px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              Agendar Horário
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap section" style={{ maxWidth: '640px', margin: '0 auto', paddingBlock: '40px 80px', paddingInline: '16px' }}>
      {/* Header do Formulário */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2.5px', color: 'var(--color-ember, #a02c00)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          ESTÚDIO DE BELEZA & OLHAR
        </span>
        <h1 style={{ fontSize: '2.4rem', fontFamily: 'var(--font-heading, inherit)', textTransform: 'uppercase', letterSpacing: '1px', color: '#070607', marginTop: '6px' }}>
          Ficha de Anamnese
        </h1>
        <p style={{ color: '#5a5a54', marginTop: '8px', fontSize: '15px', lineHeight: '1.5' }}>
          Preencha com atenção antes do seu procedimento. Sua segurança e a saúde dos seus olhos vêm em primeiro lugar.
        </p>
      </div>

      {errorMessage && (
        <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #f87171', borderRadius: '12px', color: '#b91c1c', marginBottom: '24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Cartão Principal de Fundo Branco com Alto Contraste */}
      <div style={{ background: '#ffffff', border: '1px solid #d8d8d3', borderRadius: '24px', padding: '32px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Nome */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#3f3f3a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Nome Completo *
            </span>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Digite seu nome e sobrenome"
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid #d4d4ce',
                background: '#fbfbf9',
                color: '#070607',
                fontSize: '15px',
                outline: 'none',
                transition: 'border 0.2s',
              }}
            />
          </label>
          
          {/* WhatsApp */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#3f3f3a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              WhatsApp com DDD *
            </span>
            <input
              type="tel"
              required
              value={clientPhone}
              onChange={(e) => setClientPhone(formatPhone(e.target.value))}
              placeholder="(51) 99999-9999"
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid #d4d4ce',
                background: '#fbfbf9',
                color: '#070607',
                fontSize: '15px',
                outline: 'none',
                transition: 'border 0.2s',
              }}
            />
          </label>

          {/* Seção Histórico de Saúde */}
          <div style={{ padding: '20px', background: '#f8f8f6', border: '1px solid #e5e5df', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e5e5df', paddingBottom: '10px' }}>
              <ShieldCheck size={18} style={{ color: 'var(--color-ember, #a02c00)' }} />
              <h3 style={{ fontSize: '14px', color: '#070607', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                Histórico de Saúde & Olhos
              </h3>
            </div>
            
            {/* Alergias */}
            <div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasAllergies}
                  onChange={(e) => setHasAllergies(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#070607', cursor: 'pointer', marginTop: '2px' }}
                />
                <span style={{ fontSize: '14px', color: '#272724', fontWeight: 500, lineHeight: '1.4' }}>
                  Possui alguma alergia conhecida? (Esmaltes, colas, cosméticos, látex)
                </span>
              </label>
              {hasAllergies && (
                <input
                  type="text"
                  required={hasAllergies}
                  value={allergiesDetail}
                  onChange={(e) => setAllergiesDetail(e.target.value)}
                  placeholder="Quais alergias você possui? Descreva aqui..."
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#070607',
                    fontSize: '14px',
                  }}
                />
              )}
            </div>

            {/* Gestante */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pregnant}
                onChange={(e) => setPregnant(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#070607', cursor: 'pointer', marginTop: '2px' }}
              />
              <span style={{ fontSize: '14px', color: '#272724', fontWeight: 500, lineHeight: '1.4' }}>
                Está gestante ou em período de amamentação?
              </span>
            </label>
            
            {/* Cirurgia Ocular */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={eyeSurgery}
                onChange={(e) => setEyeSurgery(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#070607', cursor: 'pointer', marginTop: '2px' }}
              />
              <span style={{ fontSize: '14px', color: '#272724', fontWeight: 500, lineHeight: '1.4' }}>
                Fez cirurgia ocular recente (últimos 6 meses), LASIK ou blefaroplastia?
              </span>
            </label>
            
            {/* Tireoide */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={thyroidIssues}
                onChange={(e) => setThyroidIssues(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#070607', cursor: 'pointer', marginTop: '2px' }}
              />
              <span style={{ fontSize: '14px', color: '#272724', fontWeight: 500, lineHeight: '1.4' }}>
                Possui alteração de tireoide? (Hipo ou hipertireoidismo podem influenciar na retenção)
              </span>
            </label>
          </div>

          {/* Assinatura */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#3f3f3a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Assinatura Digital (Digite seu nome completo) *
            </span>
            <input
              type="text"
              required
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Declaro que as informações acima são verdadeiras"
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid #d4d4ce',
                background: '#fbfbf9',
                color: '#070607',
                fontSize: '15px',
                outline: 'none',
              }}
            />
          </label>

          {/* Termo LGPD */}
          <div style={{ padding: '14px 16px', background: '#f8f8f6', borderRadius: '12px', border: '1px solid #e5e5df' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consentLgpd}
                onChange={(e) => setConsentLgpd(e.target.checked)}
                style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#070607', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: '#52524e', lineHeight: '1.5' }}>
                Consinto expressamente com o tratamento dos meus dados pessoais e sensíveis de saúde ocular nos termos do Art. 11 da <strong>LGPD (Lei nº 13.709/2018)</strong>, com a finalidade exclusiva de avaliação pré-procedimento. Conheça nossa{' '}
                <Link href="/privacidade" target="_blank" style={{ textDecoration: 'underline', color: '#070607', fontWeight: 600 }}>Política de Privacidade</Link>.
              </span>
            </label>
          </div>

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '16px',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: '#ffffff',
              background: '#070607',
              border: 'none',
              borderRadius: '99px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Gravando ficha com segurança...' : 'Concluir e Enviar Ficha ✨'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function AnamnesePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: '#8b8b83' }}>
          Carregando formulário de anamnese...
        </div>
      }
    >
      <AnamneseForm />
    </Suspense>
  );
}


