# Lara Varisa

React 19 + TypeScript + Vinext/Vite, GSAP e ScrollTrigger. Arte original otimizada em WebP, fontes locais e tokens fornecidos preservados.

## Desenvolvimento

npm install
npm run dev
npm run build

## Contato

O botão Agendar agora abre o WhatsApp com uma mensagem pronta. Configure `whatsappNumber` em `lib/studio.ts` para direcionar a conversa diretamente ao número oficial da Lara.

Os estilos são propostas editoriais. Confirme serviços e informações comerciais antes de disponibilizar para clientes.

## Verificações

Build e TypeScript validados. O scaffold inclui componentes não utilizados com avisos de lint preexistentes; o lint da aplicação pode ser executado com npx oxlint app lib/studio.ts.

## Galeria e contato

A rota /galeria exibe a foto fornecida e dois recortes identificados da mesma foto. Para ampliar o portfólio, adicione fotos reais em public e entradas em lib/gallery.ts. A galeria da página inicial usa Embla Auto Scroll; interação pausa o movimento até clicar em Continuar. Movimento reduzido e aba inativa suspendem a reprodução automática.

lib/studio.ts concentra Instagram, WhatsApp, endereço e horários. O formulário valida os campos, permite revisar a dúvida e abre o WhatsApp com a mensagem pronta. O visitante confirma o envio no aplicativo; não há armazenamento de mensagens no servidor.

GSAP/ScrollTrigger controlam entrada do hero, revelação das seções, zoom na imagem, assinatura do rodapé e progresso da rolagem. prefers-reduced-motion desativa as animações automáticas.
