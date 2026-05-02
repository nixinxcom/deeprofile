import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import * as XLSX from "xlsx";
import { getDb, getProfileDocPath } from "./firebase-env.mjs";

const WORKBOOK_PATH = resolve(process.cwd(), "data/master-profile-history.xlsx");
const PROFILE_DOC_PATH = getProfileDocPath();
const MASTER_SHEET_NAME = "Master_History";
const LEGEND_SHEET_NAME = "Legend";

const REQUIRED_MASTER_COLUMNS = [
  "Code",
  "Area",
  "Title",
  "Start",
  "End",
  "Date Status",
  "Organization",
  "Formal Role / Position",
  "Functional Role",
  "Objective",
  "Activities / Scope",
  "Results / Impact",
  "Key Contacts / Stakeholders",
  "Notes / Basis",
];

function normalizeHeader(value) {
  return String(value || "").trim();
}

function normalizeId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function toNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function parseMonthYear(value) {
  const raw = toNullableString(value);

  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return { raw, iso: null, year: null, month: null };
  }

  const month = Number(match[1]);
  const year = Number(match[2]);

  if (month < 1 || month > 12) {
    return { raw, iso: null, year: null, month: null };
  }

  return {
    raw,
    iso: `${year}-${String(month).padStart(2, "0")}-01`,
    year,
    month,
  };
}

function splitContacts(value) {
  const raw = toNullableString(value);

  if (!raw) {
    return [];
  }

  return raw
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Missing sheet: ${sheetName}`);
  }

  return sheet;
}

function getRows(workbook, sheetName) {
  const sheet = requireSheet(workbook, sheetName);
  return XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
  });
}

function validateColumns(rows) {
  if (rows.length === 0) {
    throw new Error(`${MASTER_SHEET_NAME} has no rows.`);
  }

  const columns = Object.keys(rows[0]).map(normalizeHeader);
  const missing = REQUIRED_MASTER_COLUMNS.filter((column) => !columns.includes(column));

  if (missing.length > 0) {
    throw new Error(`Missing required columns in ${MASTER_SHEET_NAME}: ${missing.join(", ")}`);
  }
}

function mapHistoryItem(row, index) {
  const code = toNullableString(row.Code);

  if (!code) {
    throw new Error(`Row ${index + 2} is missing Code.`);
  }

  const start = parseMonthYear(row.Start);
  const end = parseMonthYear(row.End);

  return {
    id: normalizeId(code),
    code,
    order: index + 1,
    area: toNullableString(row.Area),
    title: toNullableString(row.Title),
    start,
    end,
    dateStatus: toNullableString(row["Date Status"]),
    organization: toNullableString(row.Organization),
    formalRole: toNullableString(row["Formal Role / Position"]),
    functionalRole: toNullableString(row["Functional Role"]),
    objective: toNullableString(row.Objective),
    activitiesScope: toNullableString(row["Activities / Scope"]),
    resultsImpact: toNullableString(row["Results / Impact"]),
    keyContacts: splitContacts(row["Key Contacts / Stakeholders"]),
    notesBasis: toNullableString(row["Notes / Basis"]),
    source: {
      workbook: "Alain_Master_Professional_History.xlsx",
      sheet: MASTER_SHEET_NAME,
      rowNumber: index + 2,
    },
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function mapLegend(rows) {
  return rows
    .map((row, index) => ({
      id: normalizeId(row["Date Status"] || `legend-${index + 1}`),
      dateStatus: toNullableString(row["Date Status"]),
      meaning: toNullableString(row.Meaning),
      order: index + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }))
    .filter((row) => row.dateStatus && row.meaning);
}

async function deleteCollection(batch, collectionRef) {
  const snapshot = await collectionRef.get();

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
}

const workbook = XLSX.read(readFileSync(WORKBOOK_PATH), {
  type: "buffer",
  cellDates: false,
});

const masterRows = getRows(workbook, MASTER_SHEET_NAME);
validateColumns(masterRows);

const legendRows = getRows(workbook, LEGEND_SHEET_NAME);
const historyItems = masterRows.map(mapHistoryItem);
const legendItems = mapLegend(legendRows);

const db = getDb();
const profileRef = db.doc(PROFILE_DOC_PATH);
const historyRef = profileRef.collection("historyItems");
const legendRef = profileRef.collection("legend");
const batch = db.batch();

await deleteCollection(batch, historyRef);
await deleteCollection(batch, legendRef);

batch.set(
  profileRef,
  {
    name: "Alain Rivera",
    headline: "Operations & Business Transformation",
    sourceWorkbook: "Alain_Master_Professional_History.xlsx",
    masterHistory: {
      totalItems: historyItems.length,
      sourceSheet: MASTER_SHEET_NAME,
      importedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);

for (const item of historyItems) {
  batch.set(historyRef.doc(item.id), item, { merge: false });
}

for (const item of legendItems) {
  batch.set(legendRef.doc(item.id), item, { merge: false });
}

await batch.commit();

console.log(`Imported ${historyItems.length} history items to ${PROFILE_DOC_PATH}/historyItems`);
console.log(`Imported ${legendItems.length} legend items to ${PROFILE_DOC_PATH}/legend`);
