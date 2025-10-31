import crypto from "crypto";

export type User = {
  id: number;
  email: string;
  fullName?: string; // preferred field name; replaces deprecated `name`
  // auth
  passwordHash?: string;
  passwordSalt?: string;
  verified: boolean;
  // profile (optional; used by /api/user/update and /api/auth/me)
  phone?: string;
  address?: string;
  city?: string;
  gender?: string; // 'male' | 'female' | 'other'
  birthDate?: string; // ISO date string
  loyaltyPoints?: number; // for Stage Loyalty
  avatarEmoji?: string; // selected avatar emoji code or filename
  // meta
  createdAt: number;
  updatedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __USERS_BY_EMAIL__: Map<string, User> | undefined;
  // eslint-disable-next-line no-var
  var __USERS_BY_ID__: Map<number, User> | undefined;
  // eslint-disable-next-line no-var
  var __USER_ID_COUNTER__: number | undefined;
}

export const USERS_BY_EMAIL: Map<string, User> =
  global.__USERS_BY_EMAIL__ ?? (global.__USERS_BY_EMAIL__ = new Map());
export const USERS_BY_ID: Map<number, User> =
  global.__USERS_BY_ID__ ?? (global.__USERS_BY_ID__ = new Map());
const USER_ID_COUNTER = (global.__USER_ID_COUNTER__ = global.__USER_ID_COUNTER__ ?? 1000);
function nextUserId() {
  const v = (global.__USER_ID_COUNTER__ as number) + 1;
  global.__USER_ID_COUNTER__ = v;
  return v;
}

function hashPassword(password: string, salt?: string) {
  const s = salt ?? crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, s, 64);
  return { salt: s, hash: key.toString("hex") };
}

function saveUser(u: User) {
  USERS_BY_EMAIL.set(u.email, u);
  USERS_BY_ID.set(u.id, u);
  return u;
}

export function upsertUser(params: { email: string; name?: string; fullName?: string; password?: string }) {
  const email = params.email.trim().toLowerCase();
  let user = USERS_BY_EMAIL.get(email);
  const now = Date.now();
  if (!user) {
    user = {
      id: nextUserId(),
      email,
      fullName: (params.fullName ?? params.name)?.trim() || undefined,
      verified: false,
      createdAt: now,
      updatedAt: now,
    };
    if (params.password) {
      const { salt, hash } = hashPassword(params.password);
      user.passwordSalt = salt;
      user.passwordHash = hash;
    }
    return saveUser(user);
  }
  // update existing – merge, do not lose profile fields
  const maybeFullName = (params.fullName ?? params.name)?.trim();
  if (maybeFullName !== undefined && maybeFullName !== '') user.fullName = maybeFullName;
  if (params.password) {
    const { salt, hash } = hashPassword(params.password);
    user.passwordSalt = salt;
    user.passwordHash = hash;
  }
  user.updatedAt = now;
  return saveUser(user);
}

export function updateUserProfile(identifier: { id?: number | string; email?: string }, patch: Partial<User>) {
  const keyEmail = identifier.email?.toString().trim().toLowerCase();
  let u: User | undefined;
  if (keyEmail) {
    u = USERS_BY_EMAIL.get(keyEmail);
  } else if (identifier.id !== undefined) {
    const idNum = typeof identifier.id === 'string' ? Number(identifier.id) : identifier.id;
    if (!Number.isFinite(idNum as number)) return null;
    u = USERS_BY_ID.get(idNum as number);
  }
  if (!u) return null;
  const now = Date.now();
  const merged: User = {
    ...u,
    ...patch,
    // normalize: prefer fullName; ignore legacy name field from patch
    fullName: patch.fullName ?? u.fullName,
    // never allow email/id to be overwritten by patch
    id: u.id,
    email: u.email,
    updatedAt: now,
  };
  return saveUser(merged);
}

export function setVerified(email: string, verified: boolean) {
  const key = email.trim().toLowerCase();
  const u = USERS_BY_EMAIL.get(key);
  if (u) {
    u.verified = verified;
    u.updatedAt = Date.now();
    return saveUser(u);
  }
  return u || null;
}

export function getUserByEmail(email: string) {
  return USERS_BY_EMAIL.get(email.trim().toLowerCase()) || null;
}

export function getUserById(id: number | string) {
  const idNum = typeof id === 'string' ? Number(id) : id;
  if (!Number.isFinite(idNum)) return null;
  return USERS_BY_ID.get(idNum) || null;
}

export function verifyPassword(user: User, password: string) {
  if (!user.passwordSalt || !user.passwordHash) return false;
  const { hash } = hashPassword(password, user.passwordSalt);
  return hash === user.passwordHash;
}

export function publicUser(u: User) {
  if (!u) return null as any;
  const { passwordHash, passwordSalt, ...safe } = u as any;
  // legacy: expose name alias for code paths expecting `name`
  if (!safe.name && safe.fullName) safe.name = safe.fullName;
  return safe as Omit<User, 'passwordHash' | 'passwordSalt'> & { name?: string };
}