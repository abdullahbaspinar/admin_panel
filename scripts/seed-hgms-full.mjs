/**
 * Uploads scripts/hgms-full-seed.json (exported from mobile Hgms* seeds)
 * into quiz-apps-a4b59 Firestore.
 *
 * Generate JSON first (from hmgs_app):
 *   cd ../flutter_apps/hmgs_app/packages/quiz_data && flutter test test/dump_full_seed_test.dart
 *
 * Then:
 *   npm run seed:hgms:full
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "quiz-apps-a4b59";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, "hgms-full-seed.json");

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.length ? value.map(toFirestoreValue) : [],
      },
    };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, toFirestoreValue(v)]),
        ),
      },
    };
  }
  throw new Error(`Unsupported value: ${typeof value}`);
}

function docPath(collection, id) {
  return `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${id}`;
}

function writeUpdate(collection, id, data) {
  return {
    update: {
      name: docPath(collection, id),
      fields: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, toFirestoreValue(v)]),
      ),
    },
  };
}

function getAccessToken() {
  const conf = JSON.parse(
    fs.readFileSync(
      `${os.homedir()}/.config/configstore/firebase-tools.json`,
      "utf8",
    ),
  );
  return conf.tokens.access_token;
}

async function commit(writes) {
  const token = getAccessToken();
  const chunkSize = 200;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const chunk = writes.slice(i, i + chunkSize);
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ writes: chunk }),
      },
    );
    const body = await res.json();
    if (!res.ok) {
      throw new Error(JSON.stringify(body, null, 2));
    }
    console.log(
      `Committed ${chunk.length} writes (${i + chunk.length}/${writes.length})`,
    );
  }
}

if (!fs.existsSync(SEED_PATH)) {
  console.error(`Missing ${SEED_PATH}`);
  console.error(
    "Run: cd ../flutter_apps/hmgs_app/packages/quiz_data && flutter test test/dump_full_seed_test.dart",
  );
  process.exit(1);
}

const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
const writes = [];

const { id: examId, ...examData } = seed.exam;
writes.push(writeUpdate("exams", examId, examData));

for (const subject of seed.subjects) {
  const { id, ...data } = subject;
  writes.push(writeUpdate("subjects", id, data));
}

for (const topic of seed.topics) {
  const { id, ...data } = topic;
  writes.push(writeUpdate("topics", id, data));
}

for (const question of seed.questions) {
  const { id, ...data } = question;
  writes.push(writeUpdate("questions", id, data));
}

for (const topic of seed.topics) {
  const ids = seed.questions
    .filter((q) => q.topicId === topic.id)
    .map((q) => q.id);
  writes.push(
    writeUpdate(
      "question_pools",
      `${topic.examId}__${topic.subjectId}__${topic.id}`,
      { ids, count: ids.length },
    ),
  );
}

for (const sheet of seed.cheatsheets) {
  writes.push(writeUpdate("topic_cheatsheets", sheet.topicId, sheet));
}

for (const deck of seed.flashDecks) {
  const { id, ...data } = deck;
  writes.push(writeUpdate("flash_decks", id, data));
}

writes.push(
  writeUpdate("content_manifest", examId, {
    schemaVersion: 1,
    questionsVersion: seed.contentVersion ?? 4,
    updatedAt: new Date().toISOString(),
    seededBy: "admin_panel/scripts/seed-hgms-full.mjs",
    counts: {
      topics: seed.topics.length,
      questions: seed.questions.length,
      cheatsheets: seed.cheatsheets.length,
      flashDecks: seed.flashDecks.length,
      flashCards: seed.flashDecks.reduce((n, d) => n + d.cards.length, 0),
    },
  }),
);

console.log(
  `Uploading: ${seed.topics.length} topics, ${seed.cheatsheets.length} cheatsheets, ${seed.flashDecks.length} decks, ${seed.questions.length} questions (${writes.length} writes)…`,
);
await commit(writes);
console.log("Done. Refresh the CMS.");
