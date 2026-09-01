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
import { bumpManifest } from "@/lib/firebase/catalog-repo";

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
  const questionIds = await rebuildMiniTrialPool(db, trial);
  const payload: MiniTrial = { ...trial, questionIds };
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
  const { id, ...rest } = { ...trial, questionIds };
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
  const snap = await getDocs(
    query(
      collection(db, FirestorePaths.questions),
      where("examId", "==", trial.examId),
      where("isActive", "==", true),
    ),
  );
  let questions = snap.docs.map((d) =>
    questionFromDoc(d.id, d.data() as Record<string, unknown>),
  );
  if (trial.topicIds.length > 0) {
    const allowed = new Set(trial.topicIds);
    questions = questions.filter((q) => allowed.has(q.topicId));
  }
  const count = Math.max(1, trial.questionCount);
  const preferred = questions.filter((q) => q.difficulty === trial.difficulty);
  const pool =
    preferred.length >= count
      ? preferred
      : preferred.length > 0
        ? [...preferred, ...questions.filter((q) => q.difficulty !== trial.difficulty)]
        : questions;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((q) => q.id);
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

export async function countCollection(db: Firestore, name: string): Promise<number> {
  const snap = await getDocs(collection(db, name));
  return snap.size;
}
