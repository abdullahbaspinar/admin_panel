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
import { contentManifestPath, FirestorePaths } from "@/lib/firebase/paths";

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
    snap = await getDocs(query(col, where("examId", "==", opts.examId)));
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
