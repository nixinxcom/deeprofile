import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, getProfileDocPath } from "./firebase-env.mjs";

const CONFIG_PATH = resolve(process.cwd(), "data/public-profile-config.json");
const PROFILE_DOC_PATH = getProfileDocPath();

function readConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

function toPlainFirestoreData(data) {
  return JSON.parse(JSON.stringify(data));
}

async function getHistoryItemsByCode(profileRef) {
  const snapshot = await profileRef.collection("historyItems").get();
  const itemsByCode = new Map();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (data.code) {
      itemsByCode.set(data.code, {
        id: doc.id,
        ...toPlainFirestoreData(data),
      });
    }
  }

  return itemsByCode;
}

function pickSources(itemsByCode, sourceCodes) {
  return sourceCodes
    .map((code) => itemsByCode.get(code))
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      code: item.code,
      title: item.title,
      organization: item.organization,
      start: item.start,
      end: item.end,
      area: item.area,
      objective: item.objective,
      activitiesScope: item.activitiesScope,
      resultsImpact: item.resultsImpact,
    }));
}

function findMissingSourceCodes(itemsByCode, sourceCodes) {
  return sourceCodes.filter((code) => !itemsByCode.has(code));
}

const config = readConfig();
const db = getDb();
const profileRef = db.doc(PROFILE_DOC_PATH);
const profileSnapshot = await profileRef.get();

if (!profileSnapshot.exists) {
  throw new Error(`Profile doc does not exist: ${PROFILE_DOC_PATH}`);
}

const itemsByCode = await getHistoryItemsByCode(profileRef);
const allSourceCodes = [
  ...config.selectedProjects.flatMap((project) => project.sourceCodes || []),
  ...config.timeline.flatMap((item) => item.sourceCodes || []),
];
const missingSourceCodes = [...new Set(findMissingSourceCodes(itemsByCode, allSourceCodes))];

if (missingSourceCodes.length > 0) {
  throw new Error(`Missing source history codes: ${missingSourceCodes.join(", ")}`);
}

const publicProfile = {
  profileId: config.profileId,
  hero: config.hero,
  selectedProjects: config.selectedProjects.map((project, index) => ({
    ...project,
    order: index + 1,
    sourceHistoryItems: pickSources(itemsByCode, project.sourceCodes || []),
  })),
  timeline: config.timeline.map((item, index) => ({
    ...item,
    order: index + 1,
    sourceHistoryItems: pickSources(itemsByCode, item.sourceCodes || []),
  })),
  capabilities: config.capabilities.map((capability, index) => ({
    ...capability,
    order: index + 1,
  })),
  aiContextSummary: config.aiContextSummary,
  source: {
    configFile: "data/public-profile-config.json",
    profileDocPath: PROFILE_DOC_PATH,
    historyItemsUsed: [...new Set(allSourceCodes)].length,
  },
  updatedAt: FieldValue.serverTimestamp(),
};

await profileRef.collection("publicProfile").doc("main").set(publicProfile, { merge: false });
await profileRef.set(
  {
    publicProfile: {
      generatedAt: FieldValue.serverTimestamp(),
      sourceConfig: "data/public-profile-config.json",
      historyItemsUsed: publicProfile.source.historyItemsUsed,
    },
    updatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);

console.log(`Built public profile at ${PROFILE_DOC_PATH}/publicProfile/main`);
console.log(`Selected projects: ${publicProfile.selectedProjects.length}`);
console.log(`Timeline items: ${publicProfile.timeline.length}`);
console.log(`Capabilities: ${publicProfile.capabilities.length}`);
console.log(`Source history items used: ${publicProfile.source.historyItemsUsed}`);
