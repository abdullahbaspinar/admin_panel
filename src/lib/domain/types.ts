/**
 * Firestore document shapes — keep in sync with
 * hmgs_app/packages/quiz_domain + quiz_data mappers.
 */

export type StaffRole = "super_admin" | "admin" | "editor" | "moderator";

/** How subjects/topics are presented for this exam product. */
export type HierarchyMode = "flat_courses" | "course_topics";

export interface ExamRuntimeConfig {
  defaultQuestionCount: number;
  defaultDurationSeconds?: number | null;
  /**
   * flat_courses (Ders): topic = Ders, subject = optional group
   * course_topics (Ders→Konu): subject = Ders, topic = Konu
   */
  hierarchyMode?: HierarchyMode;
  /** Override UI label for subjects (default depends on mode) */
  subjectLabel?: string | null;
  /** Override UI label for topics (default depends on mode) */
  topicLabel?: string | null;
}

export interface Exam {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
  locale: string;
  config: ExamRuntimeConfig;
}

export interface Subject {
  id: string;
  examId: string;
  name: string;
  iconUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
}

/** Content always attaches here. Label = Ders veya Konu (sınav moduna göre). */
export interface Topic {
  id: string;
  examId: string;
  subjectId: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CheatsheetSection {
  title: string;
  bullets: string[];
  note?: string | null;
}

export interface TopicCheatsheet {
  topicId: string;
  title: string;
  summary?: string | null;
  version: number;
  isActive: boolean;
  sections: CheatsheetSection[];
}

export interface FlashCard {
  id: string;
  front: string;
  back: string;
  explanation?: string | null;
}

export interface FlashDeck {
  id: string;
  topicId: string;
  title: string;
  subtitle?: string | null;
  sortOrder: number;
  /** Rules expect isActive; domain entity may omit — CMS always writes it */
  isActive: boolean;
  cards: FlashCard[];
}

/** Admin-authored mini deneme (Mini denemeler list in app). */
export interface MiniTrial {
  id: string;
  examId: string;
  name: string;
  description?: string | null;
  /** 1 = Kolay, 2 = Orta, 3 = Zor */
  difficulty: number;
  questionCount: number;
  sortOrder: number;
  isActive: boolean;
  /** Optional topic scope when rebuilding questionIds */
  topicIds: string[];
  /** Question pool for this trial — rebuilt on save */
  questionIds: string[];
}

export const MINI_TRIAL_DIFFICULTY_LABELS: Record<number, string> = {
  1: "Kolay",
  2: "Orta",
  3: "Zor",
};

export const FLASH_DECK_TARGET_CARDS = 25;

export type QuestionType = "multipleChoice" | "trueFalse";

export interface QuestionStem {
  text: string;
  imageUrl?: string | null;
}

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string | null;
}

export interface QuestionPayload {
  options: QuestionOption[];
  correctOptionIds: string[];
}

export interface Question {
  id: string;
  examId: string;
  subjectId: string;
  topicId: string;
  type: QuestionType;
  stem: QuestionStem;
  payload: QuestionPayload;
  explanation?: string | null;
  difficulty: number;
  source?: string | null;
  year?: number | null;
  isPremium: boolean;
  isActive: boolean;
  version: number;
  tags: string[];
}

export interface QuestionReport {
  id: string;
  userId: string;
  questionId?: string;
  contentType?: string;
  contentId?: string;
  message?: string;
  status?: string;
  createdAt?: unknown;
}

export interface DashboardCounts {
  exams: number;
  subjects: number;
  topics: number;
  cheatsheets: number;
  flashDecks: number;
  flashCards: number;
  miniTrials: number;
  questions: number;
  premiumQuestions: number;
  inactiveTopics: number;
  openReports: number;
}
