import type { NextRequest } from "next/server";

/** Vercel cron sends `Authorization: Bearer <CRON_SECRET>` when the secret is set. */
export function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // refuse to run unsecured
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
