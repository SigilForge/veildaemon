import { NextRequest, NextResponse } from "next/server";
import { deleteRedirect, getOwnedRedirect, requireUser, updateRedirect } from "@/lib/store";

function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status: Number.isFinite(status) ? status : 500 });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await context.params;
    const redirect = await getOwnedRedirect(user.id, id);
    return NextResponse.json({ ok: true, redirect });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireUser();
    const { id } = await context.params;
    const redirect = await updateRedirect(user.id, profile.plan, id, await request.json());
    return NextResponse.json({ ok: true, redirect });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await context.params;
    await deleteRedirect(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
