import { getDb, getProfileDocPath, requireEnv } from "./firebase-env.mjs";

const db = getDb();
const profileDocPath = getProfileDocPath();
const snapshot = await db.doc(profileDocPath).get();
const historySnapshot = await db.doc(profileDocPath).collection("historyItems").count().get();

console.log(`Firebase project: ${requireEnv("FIREBASE_PROJECT_ID")}`);
console.log(`Profile doc: ${profileDocPath}`);
console.log(`Document exists: ${snapshot.exists ? "yes" : "no"}`);
console.log(`History items: ${historySnapshot.data().count}`);
