export async function adminRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  const headers = new Headers(options?.headers);

  if (!(options?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers,
      signal: options?.signal ?? controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('application/json')
      ? ((await response.json().catch(() => ({}))) as {
          data?: T;
          error?: string;
          message?: string;
        })
      : { error: await response.text().catch(() => '') };

    if (!response.ok) {
      throw new Error(result.error || result.message || 'Não foi possível concluir.');
    }

    // Alguns endpoints de CRUD usam { data }, enquanto uploads e ações
    // retornam o payload diretamente. Aceitar os dois formatos evita que o
    // painel perca o caminho/URL de um upload bem-sucedido.
    return (Object.prototype.hasOwnProperty.call(result, 'data')
      ? result.data
      : result) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('A solicitação demorou demais. Tente novamente.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
