import { NextResponse } from "next/server";
import { z } from "zod";

// Same schema as LeadForm — keep in sync (react-hook-form + zod per spec)
const leadSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().max(20).optional().or(z.literal("")),
  portfolioSize: z.string().min(1),
  message: z.string().max(500).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Option A: no persistence required yet — log and optionally email.
  // Replace this console.log with a transactional email (e.g. Resend, Postmark)
  // or write to Supabase leads table if Option B is chosen later.
  console.info("[api/leads] new submission:", {
    ...parsed.data,
    receivedAt: new Date().toISOString(),
    ua: req.headers.get("user-agent") ?? undefined,
  });

  // Simulate a small processing delay so the UI spinner is visible in dev
  await new Promise((r) => setTimeout(r, 300));

  return NextResponse.json({ ok: true });
}

// Optional: disallow GET to make the contract clear
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
