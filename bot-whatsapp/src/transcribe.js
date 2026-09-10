import { downloadMediaMessage } from '@whiskeysockets/baileys';
import config from './config.js';
import { logInfo, logWarn, logError } from './terminal.js';
import { isSupportedMediaBuffer, readAsyncIterableWithLimit, readResponseBodyWithLimit, sanitizeUntrustedText } from './security-utils.js';

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const TRANSCRIPTION_TIMEOUT_MS = 15_000;

/**
 * Transcreve mensagens de áudio ou notas de voz do WhatsApp usando a API Groq Whisper.
 * Lê a chave e o modelo diretamente das variáveis de ambiente configuradas via config.js.
 * 
 * @param {any} msg Objeto da mensagem Baileys contendo audioMessage ou pttMessage
 * @param {any} sock Instância ativa do socket Baileys para retry de download caso necessário
 * @returns {Promise<{ sucesso: boolean, texto: string, erro?: string }>}
 */
export async function transcreverAudio(msg, sock) {
  const apiKey = config.groqApiKey;
  if (!apiKey || apiKey === 'disabled-api-key' || apiKey.length < 10) {
    logWarn('Áudio', 'GROQ_API_KEY não configurada no .env. Transcrição indisponível.');
    return {
      sucesso: false,
      texto: '',
      erro: 'Chave Groq não configurada',
    };
  }

  const audioMessage = msg?.message?.audioMessage || msg?.message?.pttMessage;
  if (!audioMessage) {
    return {
      sucesso: false,
      texto: '',
      erro: 'Mensagem não contém áudio válido',
    };
  }

  const declaredLength = Number(audioMessage.fileLength || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_BYTES) {
    logWarn('Áudio', `Áudio recusado por exceder ${MAX_AUDIO_BYTES / (1024 * 1024)} MB.`);
    return {
      sucesso: false,
      texto: '',
      erro: 'Áudio muito grande',
    };
  }

  const mimetype = String(audioMessage.mimetype || 'audio/ogg').split(';', 1)[0].trim().toLowerCase();
  const allowedMimeTypes = new Set([
    'audio/ogg',
    'audio/opus',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/webm',
  ]);
  if (!allowedMimeTypes.has(mimetype)) {
    return {
      sucesso: false,
      texto: '',
      erro: 'Formato de áudio não suportado',
    };
  }

  try {
    // Baixa o buffer do áudio via Baileys
    const stream = await downloadMediaMessage(
      msg,
      'stream',
      {},
      { reuploadRequest: sock?.updateMediaMessage }
    );
    const buffer = await readAsyncIterableWithLimit(stream, MAX_AUDIO_BYTES);

    if (!buffer || buffer.length === 0) {
      logWarn('Áudio', 'Buffer de áudio vazio retornado pelo WhatsApp.');
      return {
        sucesso: false,
        texto: '',
        erro: 'Buffer de áudio vazio',
      };
    }

    if (buffer.length > MAX_AUDIO_BYTES) {
      logWarn('Áudio', `Áudio recusado por exceder ${MAX_AUDIO_BYTES / (1024 * 1024)} MB.`);
      return {
        sucesso: false,
        texto: '',
        erro: 'Áudio muito grande',
      };
    }
    if (!isSupportedMediaBuffer(buffer, 'audio')) {
      return {
        sucesso: false,
        texto: '',
        erro: 'Conteúdo de áudio inválido',
      };
    }

    const extensao = mimetype.includes('mp4') || mimetype === 'audio/x-m4a'
      ? 'm4a'
      : mimetype === 'audio/mpeg'
        ? 'mp3'
        : mimetype === 'audio/webm'
          ? 'webm'
          : 'ogg';
    const audioFile = new File([buffer], `audio.${extensao}`, { type: mimetype });

    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', config.groqWhisperModel || 'whisper-large-v3-turbo');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = (await readResponseBodyWithLimit(response, 16 * 1024)).toString('utf8').slice(0, 500);
      logError('Áudio', `Falha na API Groq Whisper (${response.status}): ${errorText}`);
      return {
        sucesso: false,
        texto: '',
        erro: `HTTP ${response.status}`,
      };
    }

    const data = JSON.parse((await readResponseBodyWithLimit(response, 64 * 1024)).toString('utf8'));
    const textoTranscrevido = sanitizeUntrustedText(String(data?.text || ''), 6000).trim();

    if (!textoTranscrevido) {
      return {
        sucesso: false,
        texto: '',
        erro: 'Áudio sem fala detectada',
      };
    }

    return {
      sucesso: true,
      texto: textoTranscrevido,
    };
  } catch (error) {
    logError('Áudio', `Erro ao transcrever áudio: ${error?.message || error}`);
    return {
      sucesso: false,
      texto: '',
      erro: 'Não foi possível transcrever o áudio agora.',
    };
  }
}

export default {
  transcreverAudio,
};
