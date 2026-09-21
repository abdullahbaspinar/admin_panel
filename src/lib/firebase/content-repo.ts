import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";

import type { FlashDeck, MiniTrial, Question, TopicCheatsheet } from "@/lib/domain/types";
import {
  cheatsheetFromDoc,
  cheatsheetToMap,
  flashDeckFromDoc,
  flashDeckToMap,
  miniTrialFromDoc,
  miniTrialToMap,
  questionFromDoc,
  questionPoolToMap,
  questionToMap,
} from "@/lib/firebase/mappers";
import {
  flashDeckPath,
  FirestorePaths,
  poolPath,
  topicCheatsheetPath,
} from "@/lib/firebase/paths";
import { bumpManifest, listTopics } from "@/lib/firebase/catalog-repo";
import { expandTopicScope, normalizeLabel } from "@/lib/hierarchy";

export async function getCheatsheet(
  db: Firestore,
  topicId: string,
): Promise<TopicCheatsheet | null> {
  const snap = await getDoc(doc(db, topicCheatsheetPath(topicId)));
  if (!snap.exists()) return null;
  return cheatsheetFromDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function saveCheatsheet(
  db: Firestore,
  sheet: TopicCheatsheet,
  examId: string,
): Promise<void> {
  await setDoc(doc(db, topicCheatsheetPath(sheet.topicId)), cheatsheetToMap(sheet), {
    merge: true,
  });
  await bumpManifest(db, examId);
}

export async function listFlashDecksForTopic(
  db: Firestore,
  topicId: string,
): Promise<FlashDeck[]> {
  const snap = await getDocs(
    query(collection(db, FirestorePaths.flashDecks), where("topicId", "==", topicId)),
  );
  return snap.docs
    .map((d) => flashDeckFromDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getFlashDeck(
  db: Firestore,
  deckId: string,
): Promise<FlashDeck | null> {
  const snap = await getDoc(doc(db, flashDeckPath(deckId)));
  if (!snap.exists()) return null;
  return flashDeckFromDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function saveFlashDeck(
  db: Firestore,
  deck: FlashDeck,
  examId: string,
): Promise<void> {
  const { id, ...rest } = deck;
  await setDoc(doc(db, FirestorePaths.flashDecks, id), flashDeckToMap(rest), {
    merge: true,
  });
  await bumpManifest(db, examId);
}

export async function listMiniTrialsForExam(
  db: Firestore,
  examId: string,
): Promise<MiniTrial[]> {
  const snap = await getDocs(
    query(collection(db, FirestorePaths.miniTrials), where("examId", "==", examId)),
  );
  return snap.docs
    .map((d) => miniTrialFromDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveMiniTrial(
  db: Firestore,
  trial: MiniTrial,
): Promise<void> {
  const questionIds =
    trial.questionIds.length > 0
      ? trial.questionIds
      : await rebuildMiniTrialPool(db, trial);
  const payload: MiniTrial = {
    ...trial,
    questionIds,
    questionCount: questionIds.length || trial.questionCount,
  };
  const { id, ...rest } = payload;
  await setDoc(doc(db, FirestorePaths.miniTrials, id), miniTrialToMap(rest), {
    merge: true,
  });
  await bumpManifest(db, trial.examId);
}

export async function refreshMiniTrialPool(
  db: Firestore,
  trial: MiniTrial,
): Promise<string[]> {
  const questionIds = await rebuildMiniTrialPool(db, trial);
  const { id, ...rest } = {
    ...trial,
    questionIds,
    questionCount: questionIds.length || trial.questionCount,
  };
  await setDoc(doc(db, FirestorePaths.miniTrials, id), miniTrialToMap(rest), {
    merge: true,
  });
  await bumpManifest(db, trial.examId);
  return questionIds;
}

export async function deleteMiniTrial(
  db: Firestore,
  trialId: string,
  examId: string,
): Promise<void> {
  await deleteDoc(doc(db, FirestorePaths.miniTrials, trialId));
  await bumpManifest(db, examId);
}

export async function rebuildMiniTrialPool(
  db: Firestore,
  trial: MiniTrial,
): Promise<string[]> {
  const all = await listQuestionsForExam(db, trial.examId);
  let available = all.filter((q) => q.isActive);
  if (trial.topicIds.length > 0) {
    const topics = await listTopics(db, { examId: trial.examId });
    const allowed = expandTopicScope(topics, trial.topicIds);
    const names = new Set(
      [...allowed]
        .map((id) => topics.find((topic) => topic.id === id)?.name)
        .filter((name): name is string => Boolean(name))
        .map(normalizeLabel),
    );
    available = available.filter(
      (q) => allowed.has(q.topicId) || names.has(normalizeLabel(q.topicId)),
    );
  }

  const count = Math.max(1, trial.questionCount);
  const availableIds = new Set(available.map((q) => q.id));
  const selected = trial.questionIds.filter((id) => availableIds.has(id));
  if (selected.length > 0) return selected;

  const preferred = available.filter((q) => q.difficulty === trial.difficulty);
  const pool =
    preferred.length >= count
      ? preferred
      : preferred.length > 0
        ? [...preferred, ...available.filter((q) => q.difficulty !== trial.difficulty)]
        : available;
  return shuffleQuestions(pool).slice(0, count).map((q) => q.id);
}

function shuffleQuestions<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export async function listQuestionsForTopic(
  db: Firestore,
  topicId: string,
): Promise<Question[]> {
  const snap = await getDocs(
    query(collection(db, FirestorePaths.questions), where("topicId", "==", topicId)),
  );
  return snap.docs.map((d) =>
    questionFromDoc(d.id, d.data() as Record<string, unknown>),
  );
}

export async function listQuestionsForExam(
  db: Firestore,
  examId: string,
): Promise<Question[]> {
  const byId = new Map<string, Question>();

  try {
    const snap = await getDocs(
      query(collection(db, FirestorePaths.questions), where("examId", "==", examId)),
    );
    for (const d of snap.docs) {
      byId.set(d.id, questionFromDoc(d.id, d.data() as Record<string, unknown>));
    }
  } catch {
    // Query may fail without a composite index; fall back to per-topic reads.
  }

  if (byId.size > 0) return [...byId.values()];

  const topics = await listTopics(db, { examId });
  const results = await Promise.allSettled(
    topics.map((topic) =>
      getDocs(
        query(
          collection(db, FirestorePaths.questions),
          where("topicId", "==", topic.id),
        ),
      ),
    ),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const d of result.value.docs) {
      byId.set(d.id, questionFromDoc(d.id, d.data() as Record<string, unknown>));
    }
  }

  return [...byId.values()];
}

export async function listQuestionsByIds(
  db: Firestore,
  ids: string[],
): Promise<Question[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  const snaps = await Promise.all(
    unique.map((id) => getDoc(doc(db, FirestorePaths.questions, id))),
  );

  const byId = new Map<string, Question>();
  for (const snap of snaps) {
    if (!snap.exists()) continue;
    byId.set(
      snap.id,
      questionFromDoc(snap.id, snap.data() as Record<string, unknown>),
    );
  }

  return unique
    .map((id) => byId.get(id))
    .filter((q): q is Question => q != null);
}

export async function listCheatsheetsForTopics(
  db: Firestore,
  topicIds: string[],
): Promise<TopicCheatsheet[]> {
  if (topicIds.length === 0) return [];
  const sheets = await Promise.all(topicIds.map((id) => getCheatsheet(db, id)));
  return sheets.filter((sheet): sheet is TopicCheatsheet => sheet != null);
}

export async function listFlashDecksForTopics(
  db: Firestore,
  topicIds: string[],
): Promise<FlashDeck[]> {
  if (topicIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < topicIds.length; i += 30) {
    chunks.push(topicIds.slice(i, i + 30));
  }

  const snaps = await Promise.all(
    chunks.map((chunk) =>
      getDocs(
        query(
          collection(db, FirestorePaths.flashDecks),
          where("topicId", "in", chunk),
        ),
      ),
    ),
  );

  return snaps
    .flatMap((snap) =>
      snap.docs.map((d) =>
        flashDeckFromDoc(d.id, d.data() as Record<string, unknown>),
      ),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveQuestion(
  db: Firestore,
  question: Question,
): Promise<void> {
  const { id, ...rest } = question;
  await setDoc(doc(db, FirestorePaths.questions, id), questionToMap(rest), {
    merge: true,
  });
  await rebuildPool(db, question.examId, question.subjectId, question.topicId);
  await bumpManifest(db, question.examId);
}

export async function deleteQuestion(
  db: Firestore,
  question: Question,
): Promise<void> {
  await deleteDoc(doc(db, FirestorePaths.questions, question.id));
  await rebuildPool(db, question.examId, question.subjectId, question.topicId);
  await stripQuestionIdsFromMiniTrials(db, question.examId, [question.id]);
  await bumpManifest(db, question.examId);
}

async function stripQuestionIdsFromMiniTrials(
  db: Firestore,
  examId: string,
  questionIds: string[],
): Promise<void> {
  if (questionIds.length === 0) return;
  const remove = new Set(questionIds);
  const trials = await listMiniTrialsForExam(db, examId);
  await Promise.all(
    trials.map(async (trial) => {
      if (!trial.questionIds.some((id) => remove.has(id))) return;
      const nextIds = trial.questionIds.filter((id) => !remove.has(id));
      const { id, ...rest } = {
        ...trial,
        questionIds: nextIds,
        questionCount: nextIds.length || trial.questionCount,
      };
      await setDoc(doc(db, FirestorePaths.miniTrials, id), miniTrialToMap(rest), {
        merge: true,
      });
    }),
  );
}

export async function rebuildPool(
  db: Firestore,
  examId: string,
  subjectId: string,
  topicId: string,
): Promise<void> {
  const questions = await listQuestionsForTopic(db, topicId);
  const ids = questions.filter((q) => q.isActive).map((q) => q.id);
  await setDoc(doc(db, poolPath(examId, subjectId, topicId)), questionPoolToMap(ids), {
    merge: true,
  });
}
