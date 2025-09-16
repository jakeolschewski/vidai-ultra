import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok:true, mode: process.env.MODE || 'strict_local' });
}
