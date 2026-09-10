# Lara Varisa

React 19 + TypeScript + Vinext/Vite, GSAP e ScrollTrigger. Arte original otimizada em WebP, fontes locais e tokens fornecidos preservados.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build
```

Para testar em outro dispositivo na mesma rede, use `npm run dev -- --hostname 0.0.0.0` e abra `http://IP-DO-COMPUTADOR:3000` no celular. O firewall do Windows precisa permitir a porta 3000.

## Configuração de produção

Os dados comerciais e o catálogo são lidos do banco no servidor, com fallback local para manter o site navegável durante a configuração inicial. Defina as variáveis server-only do ambiente (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LEAD_HASH_SECRET` e `AUTH_2FA_COOKIE_SECRET`) antes de habilitar o painel. Segredos nunca devem usar o prefixo `NEXT_PUBLIC_`.

O formulário de contato grava leads no backend e o agendamento grava a reserva de forma atômica. O WhatsApp é usado para a conversa e para as mensagens transacionais do bot, enquanto o painel protegido concentra os dados recebidos.

## Verificações

```bash
npx tsc --noEmit
npm test --prefix bot-whatsapp
npm run build
git diff --check
```

O lint da aplicação pode ser executado com `npx oxlint app lib/studio.ts`.

## Galeria e contato

A rota /galeria exibe a foto fornecida e dois recortes identificados da mesma foto. Para ampliar o portfólio, adicione fotos reais em public e entradas em lib/gallery.ts. A galeria da página inicial usa Embla Auto Scroll; interação pausa o movimento até clicar em Continuar. Movimento reduzido e aba inativa suspendem a reprodução automática.

`lib/studio.ts` concentra os fallbacks de apresentação. O formulário valida os campos e envia a dúvida ao endpoint protegido de leads; o painel pode acompanhar e classificar cada contato.

GSAP/ScrollTrigger controlam entrada do hero, revelação das seções, zoom na imagem, assinatura do rodapé e progresso da rolagem. prefers-reduced-motion desativa as animações automáticas.

## Serviços

A página `/servicos` reúne o catálogo completo. Preços, duração e manutenção vêm do catálogo publicado, com fallback em `lib/services.ts`; cada serviço mantém uma ação específica para o WhatsApp.

A página `/localizacao` reúne mapa, horário, região de atendimento e atalhos para rotas e confirmação do endereço.
