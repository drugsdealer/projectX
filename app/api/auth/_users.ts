import crypto from "crypto";

export type User = {
  id: string;
  email: string;
  name?: string;
  passwordHash?: string;
  passwordSalt?: string;
  verified: boolean;
  createdAt: number;
  updatedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __USERS_BY_EMAIL__: Map<string, User> | undefined;
  // eslint-disable-next-line no-var
  var __USERS_BY_ID__: Map<string, User> | undefined;
}

export const USERS_BY_EMAIL: Map<string, User> =
  global.__USERS_BY_EMAIL__ ?? (global.__USERS_BY_EMAIL__ = new Map());
export const USERS_BY_ID: Map<string, User> =
  global.__USERS_BY_ID__ ?? (global.__USERS_BY_ID__ = new Map());

function hashPassword(password: string, salt?: string) {
  const s = salt ?? crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, s, 64);
  return { salt: s, hash: key.toString("hex") };
}

export function upsertUser(params: { email: string; name?: string; password?: string }) {
  const email = params.email.trim().toLowerCase();
  let user = USERS_BY_EMAIL.get(email);
  const now = Date.now();
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      name: params.name,
      verified: false,
      createdAt: now,
      updatedAt: now,
    };
    if (params.password) {
      const { salt, hash } = hashPassword(params.password);
      user.passwordSalt = salt;
      user.passwordHash = hash;
    }
    USERS_BY_EMAIL.set(email, user);
    USERS_BY_ID.set(user.id, user);
    return user;
  }
  // update existing
  if (params.name !== undefined) user.name = params.name;
  if (params.password) {
    const { salt, hash } = hashPassword(params.password);
    user.passwordSalt = salt;
    user.passwordHash = hash;
  }
  user.updatedAt = now;
  USERS_BY_EMAIL.set(email, user);
  USERS_BY_ID.set(user.id, user);
  return user;
}

export function setVerified(email: string, verified: boolean) {
  const key = email.trim().toLowerCase();
  const u = USERS_BY_EMAIL.get(key);
  if (u) {
    u.verified = verified;
    u.updatedAt = Date.now();
    USERS_BY_EMAIL.set(key, u);
    USERS_BY_ID.set(u.id, u);
  }
  return u;
}

export function getUserByEmail(email: string) {
  return USERS_BY_EMAIL.get(email.trim().toLowerCase()) || null;
}

export function getUserById(id: string) {
  return USERS_BY_ID.get(id) || null;
}

export function verifyPassword(user: User, password: string) {
  if (!user.passwordSalt || !user.passwordHash) return false;
  const { hash } = hashPassword(password, user.passwordSalt);
  return hash === user.passwordHash;
}

export function publicUser(u: User) {
  if (!u) return null;
  const { passwordHash, passwordSalt, ...safe } = u as any;
  return safe as Omit<User, "passwordHash" | "passwordSalt">;
}