import { NextResponse } from "next/server";
import { importOperator } from "@/lib/table/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const operator = await importOperator(body.payload ?? body);
    return NextResponse.json({ operator }, { status: 201 });
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
