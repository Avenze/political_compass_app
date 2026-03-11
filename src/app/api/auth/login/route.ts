import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, createAuthSessionToken } from "@/lib/auth";
import { getPublicAccountClient } from "@/lib/appwrite-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    const account = getPublicAccountClient();
    const session = await account.createEmailPasswordSession(email, password);
    const userId = session.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unable to establish Appwrite session" }, { status: 500 });
    }

    const authToken = createAuthSessionToken({ id: userId, email });

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: authToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid credentials";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
