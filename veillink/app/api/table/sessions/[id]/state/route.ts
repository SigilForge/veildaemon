import { NextResponse } from "next/server";
import { patchSessionState } from "@/lib/table/store";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await patchSessionState({
      sessionId: id,
      sessionOperatorStateId: body.sessionOperatorStateId || body.session_operator_state_id,
      patch: body.patch || body.state || {},
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
