import { NextResponse } from "next/server";
import { closeSession, getSessionBundle } from "@/lib/table/store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const bundle = await getSessionBundle(id);
    return NextResponse.json(bundle);
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const options = await request
      .json()
      .catch(() => ({}))
      .then((body) => ({
        oneShot: Boolean(body?.oneShot),
        resetVitals: Boolean(body?.resetVitals),
        groupAward: body?.groupAward || undefined,
        perOperatorAwards: body?.perOperatorAwards || undefined,
      }));
    const result = await closeSession(id, options);
    return NextResponse.json(result);
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
