import { downloadMediaMessage } from '@whiskeysockets/baileys';
import config from './config.js';
import { logInfo, logWarn, logError } from './terminal.js';

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
  if (!apiKey || apiKey === 'dummy_key' || apiKey.length < 10) {
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

  try {
    // Baixa o buffer do áudio via Baileys
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { reuploadRequest: sock?.updateMediaMessage }
    );

    if (!buffer || buffer.length === 0) {
      logWarn('Áudio', 'Buffer de áudio vazio retornado pelo WhatsApp.');
      return {
        sucesso: false,
        texto: '',
        erro: 'Buffer de áudio vazio',
      };
    }

    const mimetype = audioMessage.mimetype || 'audio/ogg';
    const extensao = mimetype.includes('mp4') ? 'm4a' : 'ogg';
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError('Áudio', `Falha na API Groq Whisper (${response.status}): ${errorText}`);
      return {
        sucesso: false,
        texto: '',
        erro: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const textoTranscrevido = (data.text || '').trim();

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
      erro: error?.message || 'Erro desconhecido',
    };
  }
}

export default {
  transcreverAudio,
};
