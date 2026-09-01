/**
 * Seeds HGMS catalog into quiz-apps-a4b59 from the mobile app seed
 * (packages/quiz_data HgmsContent). Uses Firebase CLI OAuth (IAM), not client rules.
 *
 * Run: node scripts/seed-hgms-catalog.mjs
 */
import fs from "node:fs";
import os from "node:os";

const PROJECT_ID = "quiz-apps-a4b59";
const EXAM_ID = "hgms";
const SUBJECT_ID = "sub_hgms";
const CONTENT_VERSION = 4;

const DERSLER = [
  ["top_medeni", "Medeni Hukuk"],
  ["top_borclar", "Borçlar Hukuku"],
  ["top_ticaret", "Ticaret Hukuku"],
  ["top_hmk", "Hukuk Yargılama Usulü (HMK)"],
  ["top_icra", "İcra ve İflas Hukuku"],
  ["top_ceza", "Ceza Hukuku"],
  ["top_cmk", "Ceza Yargılama Usulü (CMK)"],
  ["top_anayasa", "Anayasa Hukuku"],
  ["top_anayasa_yargisi", "Anayasa Yargısı"],
  ["top_idare", "İdare Hukuku"],
  ["top_idari_yargilama", "İdari Yargılama Usulü"],
  ["top_is", "İş Hukuku"],
  ["top_sosyal_guvenlik", "Sosyal Güvenlik Hukuku"],
  ["top_vergi", "Vergi Hukuku"],
  ["top_vergi_usul", "Vergi Usul Hukuku"],
  ["top_avukatlik", "Avukatlık Hukuku"],
  ["top_hukuk_felsefesi", "Hukuk Felsefesi ve Sosyolojisi"],
  ["top_hukuk_tarihi", "Türk Hukuk Tarihi"],
  ["top_genel_kamu", "Genel Kamu Hukuku"],
  ["top_milletlerarasi", "Milletlerarası Hukuk"],
  ["top_milletlerarasi_ozel", "Milletlerarası Özel Hukuk"],
];

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
    return { arrayValue: { values: value.map(toFirestoreValue) } };
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
  const fields = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, toFirestoreValue(v)]),
  );
  return {
    update: {
      name: docPath(collection, id),
      fields,
    },
  };
}

function getAccessToken() {
  const path = `${os.homedir()}/.config/configstore/firebase-tools.json`;
  const conf = JSON.parse(fs.readFileSync(path, "utf8"));
  return conf.tokens.access_token;
}

async function commit(writes) {
  const token = getAccessToken();
  // Firestore commit max 500 writes
  const chunkSize = 400;
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
    console.log(`Committed ${chunk.length} writes (${i + chunk.length}/${writes.length})`);
  }
}

function mcQuestion({ id, topicId, text, options, correctIndex, explanation }) {
  const ids = ["A", "B", "C", "D"];
  return {
    id,
    examId: EXAM_ID,
    subjectId: SUBJECT_ID,
    topicId,
    type: "multipleChoice",
    stem: { text, imageUrl: null },
    payload: {
      options: options.map((t, i) => ({
        id: ids[i],
        text: t,
        imageUrl: null,
      })),
      correctOptionIds: [ids[correctIndex]],
    },
    explanation,
    difficulty: 2,
    source: "hgms-sample",
    year: null,
    isPremium: false,
    isActive: true,
    version: 1,
    tags: [],
  };
}

const QUESTIONS = [
  mcQuestion({
    id: "q_medeni_1",
    topicId: "top_medeni",
    text: "Türk Medeni Kanunu’na göre fiil ehliyetinin tam olması için kural olarak aranan durum hangisidir?",
    options: [
      "Ayırt etme gücüne sahip ve ergin olmak",
      "Yalnızca ergin olmak",
      "Yalnızca ayırt etme gücüne sahip olmak",
      "Evli olmak",
    ],
    correctIndex: 0,
    explanation:
      "Tam fiil ehliyeti için ayırt etme gücü + erginlik gerekir; kısıtlı olmamak da şarttır.",
  }),
  mcQuestion({
    id: "q_borclar_1",
    topicId: "top_borclar",
    text: "Borçlar Hukuku’nda sözleşmenin kurulması kural olarak ne ile olur?",
    options: [
      "Tek taraflı irade beyanı",
      "Karşılıklı ve birbirine uygun irade beyanları (icap-kabul)",
      "Yalnızca noter işlemi",
      "Mahkeme kararı",
    ],
    correctIndex: 1,
    explanation: "Sözleşme, icap ve kabulün birbirine uygun olmasıyla kurulur.",
  }),
  mcQuestion({
    id: "q_hmk_1",
    topicId: "top_hmk",
    text: "HMK’da görev, kural olarak ne tür bir husustur?",
    options: [
      "Taraflarca ileri sürülmedikçe incelenemeyen",
      "Kamu düzenine ilişkin ve mahkemece re’sen gözetilen",
      "Yalnızca temyiz aşamasında ileri sürülebilen",
      "Sadece davalının itirazına bağlı",
    ],
    correctIndex: 1,
    explanation: "Görev kamu düzenindendir; mahkeme re’sen gözetir.",
  }),
  mcQuestion({
    id: "q_ceza_1",
    topicId: "top_ceza",
    text: "Ceza Hukuku’nda suçun kanuni tanımındaki unsurların gerçekleşmesi hangisine karşılık gelir?",
    options: ["Kusurluluk", "Tipiklik", "Hukuka aykırılık engeli", "Cezanın şahsiliği"],
    correctIndex: 1,
    explanation: "Tipiklik, fiilin kanundaki suç tanımına uygunluğudur.",
  }),
  mcQuestion({
    id: "q_anayasa_1",
    topicId: "top_anayasa",
    text: "1982 Anayasası’na göre egemenliğin kullanılışında bağlayıcı temel ilke hangisidir?",
    options: [
      "Egemenlik kayıtsız şartsız milletindir",
      "Egemenlik yalnızca TBMM’ye aittir",
      "Egemenlik Cumhurbaşkanına aittir",
      "Egemenlik Anayasa Mahkemesine aittir",
    ],
    correctIndex: 0,
    explanation: "Anayasa md. 6: Egemenlik kayıtsız şartsız Milletindir.",
  }),
  mcQuestion({
    id: "q_avukatlik_1",
    topicId: "top_avukatlik",
    text: "Avukatlık Kanunu’na göre avukatlık mesleğinin amacı aşağıdakilerden hangisidir?",
    options: [
      "Yalnızca ücret karşılığı dava takip etmek",
      "Hukuki ilişkilerin düzenlenmesine ve uyuşmazlıkların adalet ve hakkaniyete uygun çözülmesine çalışmak",
      "Yalnızca ceza davalarında müdafilik yapmak",
      "Devlet adına soruşturma yürütmek",
    ],
    correctIndex: 1,
    explanation: "Avukatlık Kanunu md. 2 avukatlığın amacını düzenler.",
  }),
];

const writes = [];

writes.push(
  writeUpdate("exams", EXAM_ID, {
    slug: "hgms",
    name: "HGMS",
    description:
      "HGMS hukuk sınavına hazırlık. Medeni hukuktan milletlerarası hukuka tüm dersler.",
    iconUrl: null,
    isActive: true,
    sortOrder: 0,
    locale: "tr",
    config: {
      defaultQuestionCount: 5,
      defaultDurationSeconds: null,
      hierarchyMode: "flat_courses",
      subjectLabel: "Ders grubu",
      topicLabel: "Ders",
    },
  }),
);

writes.push(
  writeUpdate("subjects", SUBJECT_ID, {
    examId: EXAM_ID,
    name: "HGMS Dersleri",
    iconUrl: null,
    isActive: true,
    sortOrder: 0,
  }),
);

DERSLER.forEach(([id, name], index) => {
  writes.push(
    writeUpdate("topics", id, {
      examId: EXAM_ID,
      subjectId: SUBJECT_ID,
      name,
      isActive: true,
      sortOrder: index,
    }),
  );
});

for (const q of QUESTIONS) {
  const { id, ...data } = q;
  writes.push(writeUpdate("questions", id, data));
}

for (const [topicId] of DERSLER) {
  const ids = QUESTIONS.filter((q) => q.topicId === topicId).map((q) => q.id);
  writes.push(
    writeUpdate("question_pools", `${EXAM_ID}__${SUBJECT_ID}__${topicId}`, {
      ids,
      count: ids.length,
    }),
  );
}

writes.push(
  writeUpdate("content_manifest", EXAM_ID, {
    schemaVersion: 1,
    questionsVersion: CONTENT_VERSION,
    updatedAt: new Date().toISOString(),
    seededBy: "admin_panel/scripts/seed-hgms-catalog.mjs",
  }),
);

console.log(`Seeding ${writes.length} documents…`);
await commit(writes);
console.log("Done. Refresh CMS Dersler page.");
