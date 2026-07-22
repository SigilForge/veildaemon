import { NextRequest, NextResponse } from "next/server";
import { createRedirect, listUserRedirects, requireUser } from "@/lib/store";

function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
}

export async function GET() {
  try {
    const { user } = await requireUser();
    const redirects = await listUserRedirects(user.id);
    return NextResponse.json({ ok: true, redirects });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireUser();
    const redirect = await createRedirect(user.id, profile.plan, await request.json());
    return NextResponse.json({ ok: true, redirect }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
