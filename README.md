# Lara Varisa

React 19 + TypeScript + Vinext/Vite, GSAP e ScrollTrigger. Arte original otimizada em WebP, fontes locais e tokens fornecidos preservados.

## Desenvolvimento

npm install
npm run dev
npm run build

## Contato

Configure bookingUrl em lib/studio.ts com o endereço HTTPS oficial de agendamento ou WhatsApp. Sem contato configurado, a página informa que o agendamento está em breve e não coleta dados nem confirma reservas.

Os estilos são propostas editoriais. Confirme serviços e informações comerciais antes de disponibilizar para clientes.

## Verificações

Build e TypeScript validados. O scaffold inclui componentes não utilizados com avisos de lint preexistentes; o lint da aplicação pode ser executado com npx oxlint app lib/studio.ts.


## Galeria e contato

A rota /galeria exibe a foto fornecida e dois recortes identificados da mesma foto. Para ampliar o portfólio, adicione fotos reais em public e entradas em lib/gallery.ts. A galeria da página inicial usa Embla Auto Scroll; interação pausa o movimento até clicar em Continuar. Movimento reduzido e aba inativa suspendem a reprodução automática.

lib/studio.ts concentra Instagram, WhatsApp, e-mail, endereço e horários. demo: true impede redirecionamentos de contato; o formulário valida os campos e exibe a mensagem sem enviar. Para ativar, configure dados reais, demo: false e contactMode como whatsapp ou email. O visitante confirma o envio no aplicativo escolhido; não há armazenamento de mensagens no servidor.

GSAP/ScrollTrigger controlam entrada do hero, revelação das seções, zoom na imagem, assinatura do rodapé e progresso da rolagem. prefers-reduced-motion desativa as animações automáticas.
