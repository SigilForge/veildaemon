import { NextResponse } from "next/server";
import { leaveSession } from "@/lib/table/store";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const seat = await leaveSession(id, body.sessionOperatorStateId || body.session_operator_state_id);
    return NextResponse.json({ seat });
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
