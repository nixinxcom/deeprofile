import { NextResponse } from "next/server";
import { getAdminDb } from "@/app/lib/firebase/admin";

export const runtime = "nodejs";

const PROFILE_DOC_PATH = process.env.PROFILE_DOC_PATH || "professionalProfiles/alain-rivera";

export async function GET() {
  try {
    const db = getAdminDb();
    const profileRef = db.doc(PROFILE_DOC_PATH);
    const [profileSnapshot, publicProfileSnapshot] = await Promise.all([
      profileRef.get(),
      profileRef.collection("publicProfile").doc("main").get(),
    ]);

    if (!profileSnapshot.exists) {
      return NextResponse.json(
        { error: "Professional profile context not found." },
        { status: 404 },
      );
    }

    if (publicProfileSnapshot.exists) {
      return NextResponse.json({
        id: profileSnapshot.id,
        profile: profileSnapshot.data(),
        publicProfile: {
          id: publicProfileSnapshot.id,
          ...publicProfileSnapshot.data(),
        },
      });
    }

    const [historySnapshot, legendSnapshot] = await Promise.all([
      profileRef.collection("historyItems").orderBy("order", "asc").get(),
      profileRef.collection("legend").orderBy("order", "asc").get(),
    ]);

    return NextResponse.json({
      id: profileSnapshot.id,
      ...profileSnapshot.data(),
      warning: "publicProfile/main has not been generated yet. Run npm run profile:build-public.",
      historyItems: historySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
      legend: legendSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
    });
  } catch (error) {
    console.error("Failed to read professional profile context", error);

    return NextResponse.json(
      { error: "Failed to read professional profile context." },
      { status: 500 },
    );
  }
}
