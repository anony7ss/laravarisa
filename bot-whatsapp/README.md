# 🤖 Lara Varisa — Bot de Agendamento Autônomo para WhatsApp

Bot inteligente em Node.js com Baileys e motor **DeepSeek V4 Flash (OpenCode Go)** integrado ao banco de dados Supabase via Realtime e RPCs atômicas.

O bot atende clientes via WhatsApp com a persona acolhedora da Lara, consulta horários livres em tempo real, confirma agendamentos sem choque de horários e sincroniza instantaneamente reservas feitas no site oficial.

---

## 🚀 Guia Rápido de Implantação na Shard Cloud (5 Minutos)

A **Shard Cloud** oferece planos especializados em Bots Node.js (baixo custo, alto uptime e terminal web integrado com suporte a QR Code).

### Passo 1: Criar Aplicação na Shard Cloud
1. Acesse o painel da [Shard Cloud](https://shardcloud.com.br) ou seu painel de hospedagem de bots.
2. Clique em **Criar Nova Aplicação / Criar Bot**.
3. Selecione a categoria **Node.js** (versão 20 LTS ou superior recomendada).
4. O plano básico de 256MB ou 512MB de RAM é mais do que suficiente (o bot roda em média com ~65MB a 85MB de RAM).

---

### Passo 2: Enviar os Arquivos do Bot
Você pode subir os arquivos de duas maneiras:
- **Via Git (Recomendado):** Conecte seu repositório GitHub e configure o Root Directory como `bot-whatsapp/`.
- **Via Upload ZIP / SFTP:** Compacte o conteúdo da pasta `bot-whatsapp/` (sem a pasta `node_modules` e sem `auth_info_baileys`) e faça o upload pelo Gerenciador de Arquivos do painel da Shard Cloud.

---

### Passo 3: Configurar as Variáveis de Ambiente
No painel do seu bot na Shard Cloud, navegue até a aba **Variáveis de Ambiente (Environment Variables)** e adicione:

| Variável | Valor de Exemplo | Descrição |
| :--- | :--- | :--- |
| `OPENCODE_API_KEY` | `sk-...` | Sua chave de API da OpenCode Go |
| `OPENCODE_BASE_URL` | `https://opencode.ai/zen/go/v1` | Endpoint oficial da API OpenCode Go |
| `OPENCODE_MODEL` | `deepseek-v4-flash` | Modelo DeepSeek V4 Flash (ultra rápido) |
| `SUPABASE_URL` | `https://rthnsupiueesipypazxq.supabase.co` | URL do seu projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Chave de serviço (Service Role) do Supabase |
| `STUDIO_NAME` | `Lara Lash & Sobrancelhas` | Nome exibido nas mensagens |
| `STUDIO_CITY` | `Porto Alegre - RS` | Cidade e localização do estúdio |

---

### Passo 4: Iniciar e Escanear o QR Code
1. Clique no botão **Iniciar / Iniciar Aplicação**.
2. Abra a aba **Console / Terminal Web** no painel da Shard Cloud.
3. As dependências serão instaladas automaticamente (`npm install`) e o comando `npm start` será disparado.
4. Um **QR Code compacto** será renderizado diretamente no terminal web.
5. No WhatsApp do seu celular:
   - Toque em **Aparelhos Conectados** > **Conectar um aparelho**.
   - Aponte a câmera para o QR Code exibido no terminal.
6. Assim que autenticado, o terminal exibirá:
   ```text
   ✅ [whatsapp] Conexão com o WhatsApp estabelecida com sucesso!
   ⚡ [bootstrap] Conexão WhatsApp confirmada. Ativando sincronização em tempo real do site...
   ✅ [supabase-realtime] Sincronização em tempo real ativa! Escutando novos agendamentos do site.
   ```

---

### Passo 5: Teste Ponta a Ponta
1. Envie uma mensagem no WhatsApp do bot (ex: *"Oi Lara, quero ver os horários para extensão de cílios"*). O bot responderá com o tom acolhedor da Lara e consultará a agenda.
2. Faça um agendamento de teste através da página `/agendar` do site. Em poucos segundos, o bot enviará uma mensagem de confirmação amigável no WhatsApp cadastrado!

---

## 🛡️ Resiliência, Memória e Mecanismos Anti-Ban

### 1. Monitoramento e Otimização de Memória RAM
- **Armazenamento de Sessões com TTL de 60 minutos:** Sessões de conversas inativas há mais de 1 hora são automaticamente descartadas da memória RAM pelo coletor interno (`src/memory.js`).
- **Consumo Baixo:** O consumo típico fica entre **60MB e 90MB**, operando com folga no plano mais econômico da Shard Cloud.

### 2. Reconexão Automática
- Em caso de oscilações de rede, reinício do servidor da Shard Cloud ou queda temporária da internet, o Baileys reconecta automaticamente utilizando as credenciais salvas em `./auth_info_baileys`.
- Os erros não capturados são neutralizados por handlers de `uncaughtException` e `unhandledRejection`, evitando encerramentos repentinos.

### 3. Proteção Anti-Ban e Digitação Humanizada
- Todas as mensagens enviadas passam pela fila sequencial (`src/queue.js`).
- O bot primeiro marca a mensagem da cliente como lida, aguarda um tempo natural de reflexão e simula o estado `"digitando..."` com velocidade proporcional ao tamanho do texto gerado (entre 1.5s e 4.0s).

---

## 📁 Estrutura do Diretório `bot-whatsapp/`

```
bot-whatsapp/
├── index.js                  # Ponto de entrada e bootstrap principal
├── package.json              # Dependências e scripts de execução
├── .env.example              # Modelo de variáveis de ambiente
├── README.md                 # Este guia de implantação
└── src/
    ├── config.js             # Validação e centralização das configurações
    ├── whatsapp.js           # Gerenciamento de socket Baileys e QR Code
    ├── supabase.js           # Cliente Supabase & listener Realtime do site
    ├── memory.js             # Gerenciador de contexto em memória com TTL
    ├── queue.js              # Fila humanizada com digitação e anti-ban
    ├── tools.js              # RPCs de horários, serviços e agendamentos
    └── ai.js                 # Motor OpenCode Go com Persona da Lara
```

---

## 🛠️ Comandos Locais

Para rodar localmente durante desenvolvimento:

```bash
cd bot-whatsapp
npm install
cp .env.example .env
# Edite o .env com suas chaves
npm start
```
