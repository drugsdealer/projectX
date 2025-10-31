import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/logAction';

type AuditRecord = {
  timestamp: string;
  action: string;
  user: string;
  details?: Record<string, any>;
};

// Простое in-memory хранилище (при перезапуске сервера очищается)
const auditLog: AuditRecord[] = [];

function sanitizeDetails(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, any>;
  const out: Record<string, any> = {};
  const sensitiveKeys = ['password', 'pass', 'token', 'secret', 'authorization', 'auth', 'cookie'];

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((k) => lowerKey.includes(k))) {
      out[key] = '[redacted]';
    } else {
      out[key] = value;
    }
  }
  return out;
}

// POST — добавление записи в журнал (только для авторизованных)
export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Не авторизован' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.action !== 'string' || !body.action.trim()) {
      return NextResponse.json({ success: false, message: 'Не указано действие' }, { status: 400 });
    }

    const action = body.action.trim().slice(0, 128);
    const safeDetails = sanitizeDetails(body.details || {});

    const record: AuditRecord = {
      timestamp: new Date().toISOString(),
      action,
      user: String(userId),
      details: safeDetails,
    };

    // Локальный in-memory лог для быстрой отладки
    auditLog.push(record);

    // Пытаемся также записать в централизованный AuditLog в БД (если он сконфигурирован)
    try {
      await logAction(userId, 'USER_AUDIT', action, safeDetails);
    } catch (e) {
      console.error('[audit.POST] failed to persist audit in DB', e);
    }

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('[audit.POST] error', error);
    return NextResponse.json({ success: false, message: 'Ошибка при записи аудита' }, { status: 500 });
  }
}

// GET — просмотр всех записей (только для администраторов)
export async function GET() {
  try {
    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Не авторизован' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Доступ запрещён' }, { status: 403 });
    }

    return NextResponse.json({ success: true, audit: auditLog });
  } catch (error) {
    console.error('[audit.GET] error', error);
    return NextResponse.json({ success: false, message: 'Ошибка при получении аудита' }, { status: 500 });
  }
}