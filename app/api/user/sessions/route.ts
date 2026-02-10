import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/session";
import { cookies } from "next/headers";
import { SESSION_TOKEN_COOKIE, setSessionTokenOnResponse } from "../../_utils/session";
import { randomBytes } from "crypto";

const HOURS_2 = 2 * 60 * 60 * 1000;

export async function GET() {
  try {
    const userId = await getUserIdFromRequest();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const jar: any = cookies() as any;
    const cookieJar = typeof jar?.then === "function" ? await jar : jar;
    let token = cookieJar?.get?.(SESSION_TOKEN_COOKIE)?.value || null;

    const sessions = await prisma.userSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeen: "desc" },
      select: {
        id: true,
        token: true,
        isPrimary: true,
        createdAt: true,
        lastSeen: true,
        ip: true,
        city: true,
        country: true,
        device: true,
        os: true,
        userAgent: true,
      },
    });

    // Ensure current session is first
    const sorted = [...sessions].sort((a, b) => {
      if (token && a.token === token) return -1;
      if (token && b.token === token) return 1;
      return b.lastSeen.getTime() - a.lastSeen.getTime();
    });

    let current = token ? sorted.find((s) => s.token === token) : null;
    if (!current) {
      try {
        const sessionToken = randomBytes(32).toString("hex");
        const isFirst = sessions.length === 0;
        const created = await prisma.userSession.create({
          data: {
            userId,
            token: sessionToken,
            isPrimary: isFirst,
          },
          select: {
            id: true,
            token: true,
            isPrimary: true,
            createdAt: true,
            lastSeen: true,
            ip: true,
            city: true,
            country: true,
            device: true,
            os: true,
            userAgent: true,
          },
        });
        token = sessionToken;
        current = created;
        sorted.unshift(created);
      } catch {
        // ignore bootstrap failure
      }
    }

    // Dedupe: keep only latest session per device+ip+ua, revoke older duplicates
    const seen = new Set<string>();
    const uniqueSessions: typeof sorted = [];
    const revokeIds: number[] = [];
    for (const s of sorted) {
      const key = [
        s.device || "unknown-device",
        s.os || "unknown-os",
        s.ip || "unknown-ip",
        (s.userAgent || "").slice(0, 120),
      ].join("|");
      if (seen.has(key)) {
        if (s.id !== (current as any)?.id) revokeIds.push(s.id);
        continue;
      }
      seen.add(key);
      uniqueSessions.push(s);
    }
    if (revokeIds.length) {
      prisma.userSession.updateMany({
        where: { id: { in: revokeIds } },
        data: { revokedAt: new Date() },
      }).catch(() => {});
    }
    const now = Date.now();
    const canRevokeOthers = current ? (current.isPrimary || (now - current.createdAt.getTime() >= HOURS_2)) : false;
    const cooldownMs = current && !current.isPrimary
      ? Math.max(0, HOURS_2 - (now - current.createdAt.getTime()))
      : 0;
    const cooldownHoursLeft = Math.ceil(cooldownMs / (60 * 60 * 1000));

    const res = NextResponse.json({
      success: true,
      sessions: uniqueSessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        lastSeen: s.lastSeen,
        ip: s.ip,
        city: s.city,
        country: s.country,
        device: s.device,
        os: s.os,
        userAgent: s.userAgent,
        isPrimary: s.isPrimary,
        isCurrent: token ? s.token === token : false,
      })),
      canRevokeOthers,
      cooldownHoursLeft,
    });
    if (token && !cookieJar?.get?.(SESSION_TOKEN_COOKIE)?.value) {
      setSessionTokenOnResponse(res, token);
    }
    return res;
  } catch (e) {
    console.error("[sessions] error", e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
