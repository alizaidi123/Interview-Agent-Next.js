import { NextRequest, NextResponse } from "next/server";
import { planStore } from "@/lib/planStore";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !planStore[id]) {
    return NextResponse.json(
      { error: "Interview plan not found." },
      { status: 404 }
    );
  }
  return NextResponse.json(planStore[id]);
}

