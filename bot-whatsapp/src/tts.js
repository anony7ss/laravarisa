import { EdgeTTS } from '@andresaya/edge-tts';
import { spawn } from 'child_process';
import { logAction, logError, logInfo, logWarn } from './terminal.js';

/**
 * Voz padrão do estúdio para a Lara (voz neural feminina de alta fidelidade e naturalidade em pt-BR)
 */
export const DEFAULT_VOICE = 'pt-BR-FranciscaNeural';

/**
 * Remove acentos e caracteres diacríticos para facilitar buscas e detecções semânticas.
 * @param {string} str 
 * @returns {string}
 */
export function removerAcentos(str) {
  if (!str || typeof str !== 'string') return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Verifica se a mensagem do cliente pede explicitamente uma resposta em áudio / voz.
 * Ex: "manda em áudio", "me explica por áudio", "prefiro áudio", "grava um áudio", "pode mandar áudio?"
 * 
 * @param {string} texto 
 * @returns {boolean}
 */
export function clientePediuAudio(texto) {
  if (!texto || typeof texto !== 'string') return false;
  const norm = removerAcentos(texto);

  const padroes = [
    /\b(manda|mandar|mande|envia|enviar|envie|fala|falar|fale|grava|gravar|grave|responde|responder|responda|prefiro|quero|pode ser|consegue)\b.*\b(audio|voz|gravacao)\b/,
    /\b(em|por)\s+(audio|voz)\b/,
    /\b(audio|voz)\b.*\b(por\s*favor|pfv|pode\s*ser|obrigad[oa])\b/,
    /\b(manda|grava|responde|envia)\s+(um\s+)?(audio|voz)\b/
  ];

  return padroes.some((re) => re.test(norm));
}

/**
 * Limpa o texto gerado pela IA para fala sintética:
 * - Remove formatações markdown (*, _, ~, `, #)
 * - Remove emojis visuais para não soar robótico
 * - Substitui URLs longas por menção falada
 * - Organiza quebras de linha e tópicos em pausas naturais com pontuação
 * 
 * @param {string} texto 
 * @returns {string}
 */
export function limparTextoParaFala(texto) {
  if (!texto || typeof texto !== 'string') return '';

  let limpo = texto
    // Substitui links por menção falada suave
    .replace(/https?:\/\/[^\s]+/gi, 'no link que te enviei')
    // Remove emojis Unicode (emoticons, símbolos pictográficos e variações)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{200D}\u{20E3}]/gu, '')
    // Remove formatação Markdown
    .replace(/[*_~`#]+/g, '')
    // Converte listas e marcadores em frases pausadas
    .replace(/\r?\n\s*[-*•]\s*/g, '. ')
    // Converte quebras de linha múltiplas em pausa/ponto
    .replace(/\r?\n+/g, '. ')
    // Remove pontuações duplicadas e normaliza espaços
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return limpo;
}

/**
 * Converte buffer de MP3 gerado pelo Edge TTS para o formato OGG Opus nativo do WhatsApp.
 * O WhatsApp Mobile (iOS e Android) exige estritamente container OGG com codec Opus
 * para notas de voz (PTT), caso contrário exibe erro de áudio ou não reproduz no celular.
 * 
 * @param {Buffer} mp3Buffer
 * @returns {Promise<{ buffer: Buffer, mimetype: string }>}
 */
export function converterParaOggOpus(mp3Buffer) {
  return new Promise((resolve) => {
    try {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-loglevel', 'error',
        '-i', 'pipe:0',
        '-c:a', 'libopus',
        '-b:a', '32k',
        '-vbr', 'on',
        '-application', 'voip',
        '-f', 'ogg',
        'pipe:1',
      ]);

      const chunks = [];
      ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));

      ffmpeg.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve({
            buffer: Buffer.concat(chunks),
            mimetype: 'audio/ogg; codecs=opus',
          });
        } else {
          resolve({
            buffer: mp3Buffer,
            mimetype: 'audio/mpeg',
          });
        }
      });

      ffmpeg.on('error', (err) => {
        logWarn('TTS', `FFmpeg não pôde converter áudio (${err?.message}). Usando MP3 fallback.`);
        resolve({
          buffer: mp3Buffer,
          mimetype: 'audio/mpeg',
        });
      });

      ffmpeg.stdin.write(mp3Buffer);
      ffmpeg.stdin.end();
    } catch {
      resolve({
        buffer: mp3Buffer,
        mimetype: 'audio/mpeg',
      });
    }
  });
}

/**
 * Sintetiza texto em áudio neural brasileiro com a voz da Lara (Edge TTS - Microsoft Neural)
 * e converte para OGG Opus para 100% de compatibilidade em celulares iPhone e Android.
 * 
 * @param {string} texto Texto a ser falado
 * @param {string} [voz=DEFAULT_VOICE] Identificador da voz em pt-BR
 * @returns {Promise<{ sucesso: boolean, buffer?: Buffer, mimetype?: string, textoFalado?: string, erro?: string }>}
 */
export async function gerarAudioVoz(texto, voz = DEFAULT_VOICE) {
  const textoLimpo = limparTextoParaFala(texto);

  if (!textoLimpo || textoLimpo.length < 2) {
    return {
      sucesso: false,
      erro: 'Texto vazio para síntese de voz',
    };
  }

  try {
    const vozEscolhida = (voz && voz.startsWith('pt-BR')) ? voz : DEFAULT_VOICE;
    const tts = new EdgeTTS();

    // IMPORTANTE: O 2º parâmetro DEVE ser a voz pt-BR, senão o EdgeTTS usa a voz americana padrão en-US-AnaNeural!
    await tts.synthesize(textoLimpo, vozEscolhida);
    const mp3Buffer = await tts.toBuffer();

    if (!mp3Buffer || mp3Buffer.length === 0) {
      throw new Error('Buffer de voz retornado pelo sintetizador está vazio.');
    }

    // Converte para OGG Opus nativo para tocar perfeitamente em celulares (WhatsApp mobile)
    const { buffer: audioFinal, mimetype } = await converterParaOggOpus(mp3Buffer);

    return {
      sucesso: true,
      buffer: audioFinal,
      mimetype,
      textoFalado: textoLimpo,
    };
  } catch (err) {
    logError('TTS', `Falha ao gerar voz neural: ${err?.message || err}`);
    return {
      sucesso: false,
      erro: err?.message || 'Erro desconhecido ao sintetizar voz',
    };
  }
}

export default {
  DEFAULT_VOICE,
  removerAcentos,
  clientePediuAudio,
  limparTextoParaFala,
  converterParaOggOpus,
  gerarAudioVoz,
};
