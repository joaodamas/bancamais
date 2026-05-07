interface JsonRequestOptions {
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
  timeoutMs?: number;
}

export async function fetchJson<T>(url: string, options: JsonRequestOptions = {}): Promise<T> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), options.timeoutMs ?? 8000);

  try {
    const target = new URL(url);

    if (options.searchParams) {
      Object.entries(options.searchParams).forEach(([key, value]) => {
        target.searchParams.set(key, value);
      });
    }

    const response = await fetch(target, {
      method: "GET",
      headers: options.headers,
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Upstream request failed with status ${response.status}.`);
    }

    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}
