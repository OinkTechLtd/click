const CONSENT_KEY = 'click-consent-v1';
const LINKS_KEY = 'click-links-v1';
const HEALTH_KEY = 'click-shortener-health-v1';

export type ConsentState = {
  accepted: boolean;
  acceptedAt: string;
};

export type ProviderHealth = Record<string, { failures: number; lastFailureAt?: string; lastSuccessAt?: string }>;

export function getConsent(): ConsentState | null {
  const raw = localStorage.getItem(CONSENT_KEY);
  return raw ? (JSON.parse(raw) as ConsentState) : null;
}

export function saveConsent(): ConsentState {
  const state = { accepted: true, acceptedAt: new Date().toISOString() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
  return state;
}

export function getSavedLinks(): string[] {
  const raw = localStorage.getItem(LINKS_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export function saveLink(url: string) {
  const links = [url, ...getSavedLinks().filter((item) => item !== url)].slice(0, 20);
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
}

export function getProviderHealth(): ProviderHealth {
  const raw = localStorage.getItem(HEALTH_KEY);
  return raw ? (JSON.parse(raw) as ProviderHealth) : {};
}

export function markProviderFailure(provider: string) {
  const health = getProviderHealth();
  const current = health[provider] ?? { failures: 0 };
  health[provider] = { ...current, failures: current.failures + 1, lastFailureAt: new Date().toISOString() };
  localStorage.setItem(HEALTH_KEY, JSON.stringify(health));
}

export function markProviderSuccess(provider: string) {
  const health = getProviderHealth();
  health[provider] = { failures: 0, lastSuccessAt: new Date().toISOString() };
  localStorage.setItem(HEALTH_KEY, JSON.stringify(health));
}
