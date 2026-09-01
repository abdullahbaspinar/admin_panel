/** Mirrors hmgs_app packages/quiz_data FirestorePaths */
export const FirestorePaths = {
  exams: "exams",
  subjects: "subjects",
  topics: "topics",
  questions: "questions",
  questionPools: "question_pools",
  contentManifests: "content_manifest",
  users: "users",
  questionReports: "question_reports",
  topicCheatsheets: "topic_cheatsheets",
  flashDecks: "flash_decks",
  miniTrials: "mini_trials",
} as const;

export function examPath(examId: string) {
  return `${FirestorePaths.exams}/${examId}`;
}

export function topicCheatsheetPath(topicId: string) {
  return `${FirestorePaths.topicCheatsheets}/${topicId}`;
}

export function flashDeckPath(deckId: string) {
  return `${FirestorePaths.flashDecks}/${deckId}`;
}

export function miniTrialPath(trialId: string) {
  return `${FirestorePaths.miniTrials}/${trialId}`;
}

export function poolPath(examId: string, subjectId: string, topicId: string) {
  return `${FirestorePaths.questionPools}/${examId}__${subjectId}__${topicId}`;
}

export function contentManifestPath(examId: string) {
  return `${FirestorePaths.contentManifests}/${examId}`;
}
