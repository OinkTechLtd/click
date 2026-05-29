import { getProviderHealth, markProviderFailure, markProviderSuccess } from './storage';
import type { ShortenerResult } from './types';

type Provider = {
  name: string;
  shorten: (url: string, signal: AbortSignal) => Promise<string>;
};

function ensureUrl(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

async function textResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const text = (await response.text()).trim();
  if (!/^https?:\/\//i.test(text)) {
    throw new Error('Provider returned an invalid URL');
  }
  return text;
}

const providers: Provider[] = [
  {
    name: 'is.gd',
    shorten: async (url, signal) => textResponse(await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`, { signal })),
  },
  {
    name: 'v.gd',
    shorten: async (url, signal) => textResponse(await fetch(`https://v.gd/create.php?format=simple&url=${encodeURIComponent(url)}`, { signal })),
  },
  {
    name: 'TinyURL',
    shorten: async (url, signal) => textResponse(await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { signal })),
  },
  {
    name: 'CleanURI',
    shorten: async (url, signal) => {
      const response = await fetch('https://cleanuri.com/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ url }),
        signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = (await response.json()) as { result_url?: string; error?: string };
      if (!json.result_url) {
        throw new Error(json.error ?? 'CleanURI did not return a short URL');
      }
      return json.result_url;
    },
  },
];

function sortedProviders() {
  const health = getProviderHealth();
  return [...providers].sort((a, b) => (health[a.name]?.failures ?? 0) - (health[b.name]?.failures ?? 0));
}

export async function shortenWithFallback(rawUrl: string): Promise<ShortenerResult> {
  const url = ensureUrl(rawUrl);
  const errors: string[] = [];

  for (const provider of sortedProviders()) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const shortUrl = await provider.shorten(url, controller.signal);
      markProviderSuccess(provider.name);
      return { provider: provider.name, url: shortUrl };
    } catch (error) {
      markProviderFailure(provider.name);
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw new Error(`Не удалось сократить ссылку через внешние API. ${errors.join('; ')}`);
}

export function providerNames() {
  return providers.map((provider) => provider.name);
}
