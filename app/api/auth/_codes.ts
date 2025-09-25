// app/api/auth/_codes.ts

// Храним данные по каждому отправленному коду
export type CodeRecord = { 
  code: string;        // сам код подтверждения
  expires: number;     // время (ms), когда код перестанет быть действителен
  attempts: number;    // количество попыток ввода
  sentAt: number;      // время (ms), когда код был отправлен (для кулдауна)
};

declare global {
  // eslint-disable-next-line no-var
  var __EMAIL_CODES__: Map<string, CodeRecord> | undefined;
}

// Single shared Map across route modules and hot-reloads in dev
export const CODES: Map<string, CodeRecord> =
  global.__EMAIL_CODES__ ?? (global.__EMAIL_CODES__ = new Map<string, CodeRecord>());