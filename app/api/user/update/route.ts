import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/session';

/**
 * Secure profile persistence via HttpOnly cookie (AES‑GCM, WebCrypto)
 * Now with optional server-side persistence via Prisma when user is authenticated.
 *
 * Notes:
 * - This route will attempt to locate a session via `getUserFromSession(req)`.
 *   If found, updates will be applied to the user row in DB (Prisma). If not found,
 *   the route still updates the encrypted cookie (fallback for anonymous users / previews).
 * - DB imports are dynamic to avoid build-time path issues across different repo layouts.
 */

type Profile = {
  fullName?: string;
  phone?: string;
  address?: string;
  email?: string;
  gender?: string;
  birthDate?: string; // YYYY-MM-DD
  city?: string;
  avatarEmoji?: string;
  updatedAt?: string; // ISO
};

const COOKIE_NAME_V2 = 'vault_profile';
const LEGACY_COOKIE = 'user_profile'; // read-only fallback (plaintext)
const te = new TextEncoder();

// ---------- sanitize helpers ----------
function sanitizeString(v: unknown, max = 140): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.length < 7) return undefined;
  return cleaned.slice(0, 20);
}

function sanitizeGender(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const val = v.trim().toLowerCase();
  if (!val) return undefined;
  const allowed = ['male', 'female', 'unisex', 'other'];
  return allowed.includes(val) ? val : undefined;
}

function sanitizeBirthDate(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();

  // Если ISO-строка с временем, например: 2000-11-18T00:00:00.000Z — извлекаем дату
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];

  // Если просто дата в формате YYYY-MM-DD — принимаем
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;

  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;

  return s;
}

// ---------- base64url helpers ----------
function toBase64Url(buf: ArrayBuffer): string {
  const b64 = Buffer.from(new Uint8Array(buf)).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(s: string): ArrayBuffer {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const buf = Buffer.from(b64, 'base64');
  const out = new Uint8Array(buf.byteLength);
  out.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  return out.buffer;
}

// ---------- WebCrypto AES‑GCM ----------
async function getKey(): Promise<CryptoKey> {
  const secret = process.env.STAGE_VAULT_SECRET || '';
  const raw = te.encode(secret || ''); // default empty -> still deterministic
  const digest = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptProfile(p: Profile): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = te.encode(JSON.stringify(p));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, data);
  const ivBuf = iv.byteOffset === 0 && iv.byteLength === iv.buffer.byteLength
    ? iv.buffer
    : iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength);
  return `${toBase64Url(ivBuf)}.${toBase64Url(ct)}`;
}

async function decryptProfile(token?: string | null): Promise<Profile | null> {
  try {
    if (!token) return null;
    const [ivPart, ctPart] = token.split('.');
    if (!ivPart || !ctPart) return null;
    const ivBuf = fromBase64Url(ivPart);
    const ctBuf = fromBase64Url(ctPart);
    const key = await getKey();
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, ctBuf);
    const json = new TextDecoder().decode(new Uint8Array(pt));
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Profile) : null;
  } catch {
    return null;
  }
}

// ---------- cookie IO ----------
async function readCookieProfile(): Promise<Profile> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME_V2)?.value || null;
  const v2 = await decryptProfile(token);
  if (v2) return v2;

  try {
    const raw = store.get(LEGACY_COOKIE)?.value;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Profile;
  } catch {}
  return {};
}

async function writeCookieProfile(p: Profile) {
  const store = await cookies();
  const isProd = process.env.NODE_ENV === 'production';
  const token = await encryptProfile(p);

  store.set(COOKIE_NAME_V2, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  if (store.get(LEGACY_COOKIE)) {
    store.set(LEGACY_COOKIE, '', { path: '/', maxAge: 0 });
  }
}

// ---------- routes ----------
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Record<string, unknown>;

    const incoming: Profile = {
      fullName: sanitizeString(payload.fullName),
      phone: normalizePhone(sanitizeString(payload.phone)),
      address: sanitizeString(payload.address, 300),
      email: sanitizeString(payload.email, 120),
      gender: sanitizeGender((payload as any).gender),
      birthDate: sanitizeBirthDate((payload as any).birthDate),
      city: sanitizeString((payload as any).city, 120),
      avatarEmoji: sanitizeString((payload as any).avatarEmoji, 4),
    };

    // Merge with current cookie profile
    const current = await readCookieProfile();
    const merged: Profile = { ...current, ...incoming, updatedAt: new Date().toISOString() };

    // Attempt to persist to DB if authenticated user present
    let dbUpdatedUser: any = null;
    try {
      const userId = await getUserIdFromRequest();
      if (userId) {
        const data: Record<string, any> = {};
        if (merged.fullName) data.fullName = merged.fullName;
        if (merged.phone) data.phone = merged.phone;
        if (merged.address) data.address = merged.address;
        if (merged.birthDate) {
          try {
            const parsedDate = new Date(merged.birthDate);
            if (!isNaN(parsedDate.getTime())) {
              data.birthDate = parsedDate;
            } else {
              console.warn('[api.user.update] invalid birthDate, skipping');
            }
          } catch (e) {
            console.warn('[api.user.update] failed to parse birthDate:', merged.birthDate);
          }
        }
        if (merged.city) data.city = merged.city;
        if (merged.gender) data.gender = merged.gender;
        if (merged.avatarEmoji) data.avatarEmoji = merged.avatarEmoji;

        if (Object.keys(data).length > 0) {
          dbUpdatedUser = await prisma.user.update({
            where: { id: userId },
            data,
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              address: true,
              city: true,
              gender: true,
              birthDate: true,
              avatarEmoji: true,
              verified: true,
            },
          });
        }
      }
    } catch (e) {
      // Log DB/session errors but keep going: cookie is still authoritative for UI fallback
      // eslint-disable-next-line no-console
      console.error('[api.user.update] db/session update failed', e);
    }

    // Always update encrypted cookie as fallback / quick sync
    await writeCookieProfile(merged);

    const outProfile = dbUpdatedUser
      ? {
          ...merged,
          // overwrite fields with DB truth when available
          fullName: dbUpdatedUser.fullName ?? merged.fullName,
          phone: dbUpdatedUser.phone ?? merged.phone,
          address: dbUpdatedUser.address ?? merged.address,
          city: dbUpdatedUser.city ?? merged.city,
          gender: dbUpdatedUser.gender ?? merged.gender,
          birthDate: dbUpdatedUser.birthDate
            ? dbUpdatedUser.birthDate.toISOString().split('T')[0]
            : merged.birthDate,
          avatarEmoji: dbUpdatedUser.avatarEmoji ?? merged.avatarEmoji,
          email: dbUpdatedUser.email ?? merged.email,
        }
      : merged;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[api.user.update] profile saved', {
        hasFullName: Boolean(outProfile.fullName),
        hasPhone: Boolean(outProfile.phone),
        hasAddress: Boolean(outProfile.address),
        hasBirthDate: Boolean(outProfile.birthDate),
      });
    }

    return NextResponse.json({ success: true, profile: outProfile });
  } catch (err: any) {
    console.error('[api.user.update] error', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Invalid payload' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Try authenticated user -> DB first
    try {
      const userId = await getUserIdFromRequest();
      if (userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            address: true,
            city: true,
            gender: true,
            birthDate: true,
            avatarEmoji: true,
            verified: true,
          },
        });
        if (dbUser) {
          const profile: Profile = {
            fullName: dbUser.fullName ?? undefined,
            phone: dbUser.phone ?? undefined,
            address: dbUser.address ?? undefined,
            email: dbUser.email ?? undefined,
            city: dbUser.city ?? undefined,
            gender: dbUser.gender ?? undefined,
            birthDate: dbUser.birthDate
              ? dbUser.birthDate.toISOString().split('T')[0]
              : undefined,
            avatarEmoji: dbUser.avatarEmoji ?? undefined,
            updatedAt: new Date().toISOString(),
          };
          if (!profile.birthDate) {
            const cookieProfile = await readCookieProfile();
            profile.birthDate = cookieProfile.birthDate;
          }
          return NextResponse.json({ success: true, profile });
        }
      }
    } catch (e) {
      // swallow and fallback to cookie
      // eslint-disable-next-line no-console
      console.error('[api.user.update] session/db GET failed', e);
    }

    // Fallback: return cookie profile
    const profile = await readCookieProfile();
    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    console.error('[api.user.update] GET error', err);
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500 });
  }
}
