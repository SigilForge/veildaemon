import { NextResponse } from "next/server";
import { createOperator, listMyOperators } from "@/lib/table/store";

export async function GET() {
  try {
    const operators = await listMyOperators();
    return NextResponse.json({ operators });
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const operator = await createOperator({
      displayName: body.displayName || body.display_name,
      designation: body.designation,
    });
    return NextResponse.json({ operator }, { status: 201 });
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
