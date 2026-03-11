import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = "app-auth-session";

type AuthUser = {
  id: string;
  email: string;
};

function getAuthSigningSecret() {
  return process.env.APP_AUTH_SECRET ?? process.env.APPWRITE_API_KEY ?? process.env.NEXT_BACKEND_APPWRITE_API_KEY ?? "local-dev-secret";
}

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function signPayload(payloadBase64Url: string) {
  return createHmac("sha256", getAuthSigningSecret()).update(payloadBase64Url).digest("base64url");
}

export function createAuthSessionToken(user: AuthUser, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const payload = {
    id: user.id,
    email: user.email,
    exp: Date.now() + maxAgeSeconds * 1000,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

function verifyAuthSessionToken(token: string): AuthUser | null {
  const [encoded, providedSig] = token.split(".");

  if (!encoded || !providedSig) {
    return null;
  }

  const expectedSig = signPayload(encoded);
  const expected = Buffer.from(expectedSig, "utf8");
  const provided = Buffer.from(providedSig, "utf8");

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { id?: string; email?: string; exp?: number };

    if (!parsed.id || !parsed.email || !parsed.exp) {
      return null;
    }

    if (Date.now() > parsed.exp) {
      return null;
    }

    return { id: parsed.id, email: parsed.email };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyAuthSessionToken(token);
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/stats");
  }

  return user;
}
