import { NextResponse } from "next/server";
import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";
import { listCollectionDocsRest } from "@/lib/firebase/firestore-rest-admin";

export async function GET(request: Request) {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid) {
    return NextResponse.json({ ok: false, error: "Nepřihlášen." }, { status: 401 });
  }

  const rows = await listCollectionDocsRest("team_join_requests", 400);
  const mine = rows
    .filter((row) => String(row.captainId ?? "") === user.uid)
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  return NextResponse.json({
    ok: true,
    requests: mine,
    pendingCount: mine.filter((row) => String(row.status ?? "") === "pending").length,
  });
}
