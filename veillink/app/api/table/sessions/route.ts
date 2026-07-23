import { NextResponse } from "next/server";
import { createHandlerSession } from "@/lib/table/store";
import { product } from "@/lib/config";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await createHandlerSession({
      needlepoint: body.needlepoint,
      mission: body.mission,
    });
    const joinUrl = `${product.appUrl}/table/join?code=${session.join_code}`;
    return NextResponse.json({ session, joinUrl }, { status: 201 });
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
