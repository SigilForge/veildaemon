import { NextResponse } from "next/server";
import { joinSession } from "@/lib/table/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await joinSession({
      joinCode: body.joinCode || body.code || body.join_code,
      operatorProfileId: body.operatorProfileId || body.operator_profile_id,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
