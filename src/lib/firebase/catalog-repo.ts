import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";

import type { Exam, Subject, Topic } from "@/lib/domain/types";
import {
  examFromDoc,
  examToMap,
  subjectFromDoc,
  subjectToMap,
  topicFromDoc,
  topicToMap,
} from "@/lib/firebase/mappers";
import { contentManifestPath, FirestorePaths, poolPath, topicCheatsheetPath } from "@/lib/firebase/paths";

function sortByOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listExams(db: Firestore): Promise<Exam[]> {
  const snap = await getDocs(collection(db, FirestorePaths.exams));
  return sortByOrder(
    snap.docs.map((d) => examFromDoc(d.id, d.data() as Record<string, unknown>)),
  );
}

export async function upsertExam(
  db: Firestore,
  exam: Exam,
): Promise<void> {
  const { id, ...rest } = exam;
  await setDoc(doc(db, FirestorePaths.exams, id), examToMap(rest), { merge: true });
  await bumpManifest(db, id);
}

export async function listSubjects(
  db: Firestore,
  examId?: string,
): Promise<Subject[]> {
  const col = collection(db, FirestorePaths.subjects);
  const snap = examId
    ? await getDocs(query(col, where("examId", "==", examId)))
    : await getDocs(col);
  return sortByOrder(
    snap.docs.map((d) => subjectFromDoc(d.id, d.data() as Record<string, unknown>)),
  );
}

export async function upsertSubject(db: Firestore, subject: Subject): Promise<void> {
  const { id, ...rest } = subject;
  await setDoc(doc(db, FirestorePaths.subjects, id), subjectToMap(rest), {
    merge: true,
  });
  await bumpManifest(db, subject.examId);
}

/** flat_courses: invisible default bucket so topics always have a subjectId. */
export async function ensureDefaultSubject(
  db: Firestore,
  examId: string,
  name?: string,
): Promise<Subject> {
  const existing = await listSubjects(db, examId);
  if (existing.length > 0) return existing[0];

  const subject: Subject = {
    id: `sub_${examId}`,
    examId,
    name: name?.trim() || "Dersler",
    isActive: true,
    sortOrder: 0,
  };
  await upsertSubject(db, subject);
  return subject;
}

export async function listTopics(
  db: Firestore,
  opts?: { examId?: string; subjectId?: string },
): Promise<Topic[]> {
  const col = collection(db, FirestorePaths.topics);
  let snap;
  if (opts?.examId && opts?.subjectId) {
    snap = await getDocs(
      query(
        col,
        where("examId", "==", opts.examId),
        where("subjectId", "==", opts.subjectId),
      ),
    );
  } else if (opts?.examId) {
    try {
      snap = await getDocs(query(col, where("examId", "==", opts.examId)));
    } catch {
      snap = await getDocs(col);
      return sortByOrder(
        snap.docs
          .map((d) => topicFromDoc(d.id, d.data() as Record<string, unknown>))
          .filter((topic) => topic.examId === opts.examId),
      );
    }
  } else {
    snap = await getDocs(col);
  }
  return sortByOrder(
    snap.docs.map((d) => topicFromDoc(d.id, d.data() as Record<string, unknown>)),
  );
}

export async function upsertTopic(db: Firestore, topic: Topic): Promise<void> {
  const { id, ...rest } = topic;
  await setDoc(doc(db, FirestorePaths.topics, id), topicToMap(rest), { merge: true });
  await bumpManifest(db, topic.examId);
}

async function commitDeletes(db: Firestore, refs: DocumentReference[]): Promise<void> {
  const chunkSize = 400;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + chunkSize)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

export async function deleteTopic(db: Firestore, topic: Topic): Promise<void> {
  const { id: topicId, examId, subjectId } = topic;

  const [decks, questions] = await Promise.all([
    getDocs(
      query(collection(db, FirestorePaths.flashDecks), where("topicId", "==", topicId)),
    ),
    getDocs(
      query(collection(db, FirestorePaths.questions), where("topicId", "==", topicId)),
    ),
  ]);

  const questionIds = new Set(questions.docs.map((d) => d.id));
  const refs: DocumentReference[] = [
    ...questions.docs.map((d) => d.ref),
    ...decks.docs.map((d) => d.ref),
    doc(db, topicCheatsheetPath(topicId)),
    doc(db, poolPath(examId, subjectId, topicId)),
    doc(db, FirestorePaths.topics, topicId),
  ];

  await commitDeletes(db, refs);
  await stripDeletedQuestionsFromMiniTrials(db, examId, questionIds, topicId);
  await bumpManifest(db, examId);
}

export async function deleteSubject(db: Firestore, subject: Subject): Promise<void> {
  const topics = await listTopics(db, {
    examId: subject.examId,
    subjectId: subject.id,
  });
  for (const topic of topics) {
    await deleteTopic(db, topic);
  }
  await commitDeletes(db, [doc(db, FirestorePaths.subjects, subject.id)]);
  await bumpManifest(db, subject.examId);
}

async function stripDeletedQuestionsFromMiniTrials(
  db: Firestore,
  examId: string,
  deletedQuestionIds: Set<string>,
  deletedTopicId?: string,
): Promise<void> {
  if (deletedQuestionIds.size === 0 && !deletedTopicId) return;
  try {
    const snap = await getDocs(
      query(collection(db, FirestorePaths.miniTrials), where("examId", "==", examId)),
    );
    for (const trial of snap.docs) {
      const data = trial.data() as Record<string, unknown>;
      const ids = Array.isArray(data.questionIds) ? (data.questionIds as string[]) : [];
      const topicIds = Array.isArray(data.topicIds) ? (data.topicIds as string[]) : [];
      const nextIds = ids.filter((id) => !deletedQuestionIds.has(id));
      const nextTopicIds = deletedTopicId
        ? topicIds.filter((id) => id !== deletedTopicId)
        : topicIds;
      if (nextIds.length === ids.length && nextTopicIds.length === topicIds.length) {
        continue;
      }
      await updateDoc(trial.ref, {
        questionIds: nextIds,
        topicIds: nextTopicIds,
        questionCount: nextIds.length || Number(data.questionCount ?? 0),
      });
    }
  } catch {
    // Mini deneme temizliği en iyi çaba; ders/soru belgeleri zaten silindi.
  }
}

export async function setTopicActive(
  db: Firestore,
  topicId: string,
  examId: string,
  isActive: boolean,
): Promise<void> {
  await updateDoc(doc(db, FirestorePaths.topics, topicId), { isActive });
  await bumpManifest(db, examId);
}

export async function reorderByIds(
  db: Firestore,
  collectionName: string,
  orderedIds: string[],
): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, collectionName, id), { sortOrder: index });
  });
  await batch.commit();
}

export async function setActiveFlag(
  db: Firestore,
  collectionName: string,
  id: string,
  isActive: boolean,
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), { isActive });
}

export async function bumpManifest(db: Firestore, examId: string): Promise<void> {
  const ref = doc(db, contentManifestPath(examId));
  const current = await getDoc(ref);
  const questionsVersion = current.exists()
    ? Number(current.data()?.questionsVersion ?? 0) + 1
    : 1;

  await setDoc(
    ref,
    {
      schemaVersion: 1,
      questionsVersion,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export function slugifyId(input: string, prefix: string): string {
  const base = input
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${prefix}_${base || Date.now()}`;
}
