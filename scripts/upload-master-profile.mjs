import { readFile } from "node:fs/promises";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROFILE_DOC_PATH = "professionalProfiles/alain-rivera";
const MASTER_FILE_PATH = new URL("../data/master-profile.json", import.meta.url);

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function initAdmin() {
  if (getApps().length > 0) {
    return;
  }

  initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

initAdmin();

const rawProfile = await readFile(MASTER_FILE_PATH, "utf8");
const profile = JSON.parse(rawProfile);

await getFirestore()
  .doc(PROFILE_DOC_PATH)
  .set(
    {
      ...profile,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );

console.log(`Uploaded master profile to Firestore: ${PROFILE_DOC_PATH}`);
