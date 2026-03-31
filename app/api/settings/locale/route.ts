import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n";

export async function POST(request: Request) {
  const payload = (await request.json()) as { locale?: string };
  const locale = resolveLocale(payload.locale);
  const cookieStore = await cookies();

  cookieStore.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ data: { locale } });
}
