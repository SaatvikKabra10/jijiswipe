import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

const requestSchema = z.object({
  inviteCode: z.string().min(1).max(200),
  email: z.string().email().max(254),
  displayName: z.string().trim().min(1).max(40),
});

const genericMessage = "If this address can be invited, check its inbox for the next step.";

function matchesSecret(value: string, secret: string) {
  const input = Buffer.from(value);
  const expected = Buffer.from(secret);
  return input.length === expected.length && timingSafeEqual(input, expected);
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the name, email, and invite code." }, { status: 400 });
  }

  try {
    const input = parsed.data;
    const env = serverEnv();
    if (!matchesSecret(input.inviteCode, env.JIJISWIPE_INVITE_CODE)) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return NextResponse.json({ message: genericMessage }, { status: 202 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 6 });
    if (error) throw error;
    if (data.users.length >= 5) return NextResponse.json({ message: genericMessage }, { status: 202 });

    const alreadyExists = data.users.some((user) => user.email?.toLowerCase() === input.email.toLowerCase());
    if (!alreadyExists) {
      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email.toLowerCase(), {
        data: { display_name: input.displayName },
        redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      });
      if (inviteError) throw inviteError;
    }
    return NextResponse.json({ message: genericMessage }, { status: 202 });
  } catch (error) {
    console.error("Invitation request failed", error);
    return NextResponse.json({ error: "Invitations are temporarily unavailable." }, { status: 503 });
  }
}
