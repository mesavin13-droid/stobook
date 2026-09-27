import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Profile } from '../types/index.js';
import { DEVELOPMENT_SESSION_SECRET } from '../config/env.js';

export const SESSION_COOKIE_NAME = 'stobook_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SessionPayload {
  userId: string;
  telegramId?: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

export interface AuthContext {
  profile: Profile;
  telegramId?: number;
}

function getSessionSecret(): string {
  const configuredSecret = process.env.SESSION_SECRET?.trim();
  if (configuredSecret) {
    if (configuredSecret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters');
    }
    return configuredSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }
  return DEVELOPMENT_SESSION_SECRET;
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    const issuedAt = parsed.issuedAt;
    const expiresAt = parsed.expiresAt;
    if (
      typeof parsed.userId !== 'string' ||
      !uuidPattern.test(parsed.userId) ||
      (parsed.telegramId !== undefined && (!Number.isSafeInteger(parsed.telegramId) || parsed.telegramId <= 0)) ||
      typeof issuedAt !== 'number' ||
      !Number.isSafeInteger(issuedAt) ||
      typeof expiresAt !== 'number' ||
      !Number.isSafeInteger(expiresAt) ||
      typeof parsed.nonce !== 'string' ||
      parsed.nonce.length < 16
    ) {
      return null;
    }
    if (expiresAt <= issuedAt) return null;
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

function sign(value: string): string {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

export function createSessionToken(
  userId: string,
  telegramId?: number,
  now = Date.now(),
  ttlSeconds = SESSION_TTL_SECONDS
): string {
  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    userId,
    telegramId,
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
    nonce: randomUUID()
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function parseSessionToken(token: string, now = Date.now()): SessionPayload | null {
  const [encoded, providedSignature, ...extraParts] = token.split('.');
  if (!encoded || !providedSignature || extraParts.length > 0) return null;
  const expectedSignature = sign(encoded);
  const providedBuffer = Buffer.from(providedSignature, 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }
  const payload = decodePayload(encoded);
  if (!payload || payload.expiresAt <= Math.floor(now / 1000)) return null;
  return payload;
}

function getCookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function readSession(request: Request): SessionPayload | null {
  try {
    const token = getCookieValue(request, SESSION_COOKIE_NAME);
    if (!token) return null;
    return parseSessionToken(token);
  } catch {
    return null;
  }
}

export function buildAuthContext(payload: SessionPayload | null, profile: Profile | null): AuthContext | null {
  if (!payload || !profile || payload.userId !== profile.id) return null;
  return { profile, telegramId: payload.telegramId };
}

export function setSessionCookie(response: Response, token: string, secure: boolean): void {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    // Telegram WebApp открывает приложение в iframe на web.telegram.org, то
    // есть cookie оказывается сторонней. При SameSite=Lax браузер не отправляет
    // её в таком контексте, и любой запрос API выглядит анонимным — отсюда
    // «нужно авторизоваться» даже сразу после входа. None решает это, но
    // требует Secure, поэтому по обычному http (localhost) остаётся Lax.
    secure ? 'SameSite=None' : 'SameSite=Lax'
  ];
  if (secure) attributes.push('Secure');
  response.setHeader('Set-Cookie', attributes.join('; '));
}

export function clearSessionCookie(response: Response, secure: boolean): void {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    secure ? 'SameSite=None' : 'SameSite=Lax'
  ];
  if (secure) attributes.push('Secure');
  response.setHeader('Set-Cookie', attributes.join('; '));
}
