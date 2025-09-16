import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const secret = process.env.ULTRA_WEBHOOK_SECRET || '';
  if (!secret) return NextResponse.json({ ok:false, error:'Missing ULTRA_WEBHOOK_SECRET' }, { status: 400 });
  const body = await req.text();
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return NextResponse.json({ ok:true, signature: sig });
}
