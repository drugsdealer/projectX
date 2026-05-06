import crypto from "node:crypto";
import { requireAdminApi } from "@/lib/admin";
import { privateJson } from "@/lib/api-hardening";
import { getImageKitConfigStatus } from "@/lib/imagekit-config";

export const runtime = "nodejs";

function getUploadAuthParams(privateKey: string) {
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 30 * 60;
  const signature = crypto
    .createHmac("sha1", privateKey)
    .update(token + String(expire))
    .digest("hex");

  return { token, expire, signature };
}

export async function GET(req: Request) {
  const guard = await requireAdminApi({ require2FA: true, req });
  if (!guard.ok) return guard.response;

  const { publicKey, privateKey, urlEndpoint, configured } = getImageKitConfigStatus();
  if (!configured) {
    return privateJson(
      {
        success: false,
        message:
          "ImageKit не настроен. Добавь IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY и NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT.",
      },
      { status: 503 }
    );
  }

  const auth = getUploadAuthParams(privateKey);
  return privateJson({
    success: true,
    publicKey,
    urlEndpoint,
    ...auth,
  });
}
