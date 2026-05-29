import type { ClickLink } from './types';

export function createId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
}

export function encodeLink(link: ClickLink) {
  const json = JSON.stringify(link);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeLink(payload: string): ClickLink | null {
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as ClickLink;
  } catch {
    return null;
  }
}

export function buildGoUrl(link: ClickLink) {
  return `${window.location.origin}${window.location.pathname}#/go/${encodeLink(link)}`;
}
