export async function adminRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers:
      options?.body instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options?.headers },
  });
  const result = (await response.json()) as { data?: T; error?: string };
  if (!response.ok)
    throw new Error(result.error || 'Não foi possível concluir.');
  return result.data as T;
}
