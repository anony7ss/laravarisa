import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import config from './config.js';
import { clearScreen } from './terminal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_FILE = path.resolve(__dirname, '../.bot_session.json');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

const c = colors;
const BAR = `${c.gray}-----------------------------------------------------------${c.reset}`;

// Cria cliente Supabase para autenticação (anon ou service role)
const authClient = createClient(
  config.supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || config.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Cliente com permissões de banco para leitura de perfil
const adminDbClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Lê uma linha de texto do terminal
 */
function askQuestion(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Lê senha mascarada com asteriscos ou oculta
 */
function askPassword(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);

    if (typeof process.stdin.setRawMode !== 'function') {
      // Fallback para ambientes sem rawMode
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    let password = '';
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (chunk) => {
      for (const char of chunk) {
        // Enter (\r ou \n)
        if (char === '\r' || char === '\n' || char === '\u0004') {
          cleanup();
          process.stdout.write('\n');
          resolve(password);
          return;
        }
        // Ctrl+C
        if (char === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          process.exit(0);
        }
        // Backspace
        if (char === '\u0008' || char === '\x7f') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        // Caractere digitável
        if (char >= ' ') {
          password += char;
          process.stdout.write('*');
        }
      }
    };

    function cleanup() {
      process.stdin.removeListener('data', onData);
      try {
        process.stdin.setRawMode(wasRaw);
      } catch {}
    }

    process.stdin.on('data', onData);
  });
}

/**
 * Recupera perfil de administrador do usuário autenticado
 */
async function verificarPerfilAdmin(userId) {
  try {
    const { data: profile, error } = await adminDbClient
      .from('profiles')
      .select('id, full_name, role, phone')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) return null;
    if (profile.role !== 'admin' && profile.role !== 'staff') {
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

/**
 * Salva sessão em arquivo local seguro
 */
function salvarSessaoLocal(sessionData) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), { mode: 0o600 });
  } catch {}
}

/**
 * Lê sessão salva
 */
function carregarSessaoLocal() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const raw = fs.readFileSync(SESSION_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

/**
 * Remove sessão salva
 */
export function limparSessaoAuth() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch {}
}

/**
 * Renderiza o cabeçalho elegante de login
 */
function renderLoginHeader() {
  clearScreen();
  console.log(`\n${BAR}`);
  console.log(`  ${c.bold}${c.brightMagenta}LARA VARISA${c.reset}${' '.repeat(34)}${c.bold}${c.brightCyan}Arla AI VIP${c.reset}`);
  console.log(`  ${c.dim}Autenticacao Administrativa Supabase${c.reset}`);
  console.log(BAR);
  console.log(`  ${c.dim}Informe as credenciais de admin do site para inicializar:${c.reset}\n`);
}

/**
 * Fluxo de autenticação administrativo do Bot no Supabase
 * @returns {Promise<{ user: any, profile: any }>}
 */
export async function autenticarAdminBot() {
  const forceLogin = process.argv.includes('--login') || process.argv.includes('--logout');
  if (forceLogin) {
    limparSessaoAuth();
  }

  // 1. Tenta restaurar sessão prévia válida
  const sessaoSalva = carregarSessaoLocal();
  if (sessaoSalva?.access_token && !forceLogin) {
    try {
      const { data: { user }, error } = await authClient.auth.getUser(sessaoSalva.access_token);
      if (user && !error) {
        const profile = await verificarPerfilAdmin(user.id);
        if (profile) {
          return { user, profile };
        }
      }
    } catch {
      // Sessão expirada ou inválida, segue para login interativo
    }
  }

  // 2. Fallback por variáveis de ambiente (útil para CI / Deploy headless)
  const envEmail = process.env.BOT_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const envPassword = process.env.BOT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

  if (envEmail && envPassword && !forceLogin) {
    try {
      const { data, error } = await authClient.auth.signInWithPassword({
        email: envEmail,
        password: envPassword,
      });

      if (!error && data?.user) {
        const profile = await verificarPerfilAdmin(data.user.id);
        if (profile) {
          salvarSessaoLocal({
            access_token: data.session?.access_token,
            refresh_token: data.session?.refresh_token,
            user_id: data.user.id,
            email: data.user.email,
            saved_at: new Date().toISOString(),
          });
          return { user: data.user, profile };
        }
      }
    } catch {}
  }

  // 3. Login Interativo no Terminal
  let tentativas = 0;
  const MAX_TENTATIVAS = 3;

  while (tentativas < MAX_TENTATIVAS) {
    tentativas++;
    renderLoginHeader();

    if (tentativas > 1) {
      console.log(`  ${c.red}[X] E-mail ou senha inválidos. Tentativa ${tentativas} de ${MAX_TENTATIVAS}.${c.reset}\n`);
    }

    const email = await askQuestion(`  ${c.dim}E-mail:${c.reset} `);
    if (!email) {
      console.log(`  ${c.red}[X] E-mail é obrigatório.${c.reset}`);
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    const password = await askPassword(`  ${c.dim}Senha:${c.reset}  `);
    if (!password) {
      console.log(`  ${c.red}[X] Senha é obrigatória.${c.reset}`);
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    process.stdout.write(`\n  ${c.brightYellow}[..] Autenticando com Supabase Auth...${c.reset}`);

    try {
      const { data, error } = await authClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data?.user) {
        process.stdout.write(`\r  ${c.red}[X] Falha no login: ${error?.message || 'Credenciais inválidas'}${c.reset}\n`);
        await new Promise((r) => setTimeout(r, 1800));
        continue;
      }

      const profile = await verificarPerfilAdmin(data.user.id);
      if (!profile) {
        process.stdout.write(`\r  ${c.red}[X] Usuário autenticado, porém sem permissão de Administrador em profiles.${c.reset}\n`);
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }

      salvarSessaoLocal({
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        user_id: data.user.id,
        email: data.user.email,
        saved_at: new Date().toISOString(),
      });

      process.stdout.write(`\r  ${c.brightGreen}[OK] Autenticado com sucesso! Bem-vinda, ${profile.full_name || 'Lara Varisa'}.${c.reset}\n`);
      await new Promise((r) => setTimeout(r, 800));
      clearScreen();
      return { user: data.user, profile };
    } catch (err) {
      process.stdout.write(`\r  ${c.red}[X] Erro de rede ou conexão: ${err?.message || err}${c.reset}\n`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n  ${c.red}[!] Limite de tentativas excedido. Encerrando por segurança.${c.reset}\n`);
  process.exit(1);
}

export default {
  autenticarAdminBot,
  limparSessaoAuth,
};