import type {
  Exam,
  FlashDeck,
  MiniTrial,
  Question,
  Subject,
  Topic,
  TopicCheatsheet,
} from "@/lib/domain/types";

export function examToMap(exam: Omit<Exam, "id">) {
  return {
    slug: exam.slug,
    name: exam.name,
    description: exam.description,
    iconUrl: exam.iconUrl ?? null,
    isActive: exam.isActive,
    sortOrder: exam.sortOrder,
    locale: exam.locale,
    config: {
      defaultQuestionCount: exam.config.defaultQuestionCount,
      defaultDurationSeconds: exam.config.defaultDurationSeconds ?? null,
      hierarchyMode: exam.config.hierarchyMode ?? "flat_courses",
      subjectLabel: exam.config.subjectLabel ?? null,
      topicLabel: exam.config.topicLabel ?? null,
    },
  };
}

export function examFromDoc(id: string, data: Record<string, unknown>): Exam {
  const config = (data.config as Record<string, unknown> | undefined) ?? {};
  const hierarchyMode =
    config.hierarchyMode === "course_topics" ? "course_topics" : "flat_courses";
  return {
    id,
    slug: String(data.slug ?? ""),
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    iconUrl: (data.iconUrl as string | null | undefined) ?? null,
    isActive: Boolean(data.isActive ?? true),
    sortOrder: Number(data.sortOrder ?? 0),
    locale: String(data.locale ?? "tr"),
    config: {
      defaultQuestionCount: Number(config.defaultQuestionCount ?? 10),
      defaultDurationSeconds:
        config.defaultDurationSeconds == null
          ? null
          : Number(config.defaultDurationSeconds),
      hierarchyMode,
      subjectLabel: (config.subjectLabel as string | null | undefined) ?? null,
      topicLabel: (config.topicLabel as string | null | undefined) ?? null,
    },
  };
}

export function subjectToMap(subject: Omit<Subject, "id">) {
  return {
    examId: subject.examId,
    name: subject.name,
    iconUrl: subject.iconUrl ?? null,
    isActive: subject.isActive,
    sortOrder: subject.sortOrder,
  };
}

export function subjectFromDoc(
  id: string,
  data: Record<string, unknown>,
): Subject {
  return {
    id,
    examId: String(data.examId ?? ""),
    name: String(data.name ?? ""),
    iconUrl: (data.iconUrl as string | null | undefined) ?? null,
    isActive: Boolean(data.isActive ?? true),
    sortOrder: Number(data.sortOrder ?? 0),
  };
}

export function topicToMap(topic: Omit<Topic, "id">) {
  return {
    examId: topic.examId,
    subjectId: topic.subjectId,
    name: topic.name,
    isActive: topic.isActive,
    sortOrder: topic.sortOrder,
  };
}

export function topicFromDoc(id: string, data: Record<string, unknown>): Topic {
  return {
    id,
    examId: String(data.examId ?? ""),
    subjectId: String(data.subjectId ?? ""),
    name: String(data.name ?? ""),
    isActive: Boolean(data.isActive ?? true),
    sortOrder: Number(data.sortOrder ?? 0),
  };
}

export function cheatsheetToMap(sheet: TopicCheatsheet) {
  return {
    topicId: sheet.topicId,
    title: sheet.title,
    summary: sheet.summary ?? null,
    version: sheet.version,
    isActive: sheet.isActive,
    sections: sheet.sections.map((section) => ({
      title: section.title,
      bullets: section.bullets,
      note: section.note ?? null,
    })),
  };
}

export function cheatsheetFromDoc(
  id: string,
  data: Record<string, unknown>,
): TopicCheatsheet {
  const rawSections = (data.sections as unknown[] | undefined) ?? [];
  return {
    topicId: String(data.topicId ?? id),
    title: String(data.title ?? ""),
    summary: (data.summary as string | null | undefined) ?? null,
    version: Number(data.version ?? 1),
    isActive: Boolean(data.isActive ?? true),
    sections: rawSections
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        title: String(item.title ?? ""),
        bullets: ((item.bullets as unknown[]) ?? []).map(String),
        note: (item.note as string | null | undefined) ?? null,
      })),
  };
}

export function flashDeckToMap(deck: Omit<FlashDeck, "id">) {
  return {
    topicId: deck.topicId,
    title: deck.title,
    subtitle: deck.subtitle ?? null,
    sortOrder: deck.sortOrder,
    isActive: deck.isActive,
    cards: deck.cards.map((card) => ({
      id: card.id,
      front: card.front,
      back: card.back,
      explanation: card.explanation ?? null,
    })),
  };
}

export function flashDeckFromDoc(
  id: string,
  data: Record<string, unknown>,
): FlashDeck {
  const rawCards = (data.cards as unknown[] | undefined) ?? [];
  return {
    id,
    topicId: String(data.topicId ?? ""),
    title: String(data.title ?? ""),
    subtitle: (data.subtitle as string | null | undefined) ?? null,
    sortOrder: Number(data.sortOrder ?? 0),
    isActive: Boolean(data.isActive ?? true),
    cards: rawCards
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item, index) => ({
        id: String(item.id ?? `card_${index}`),
        front: String(item.front ?? ""),
        back: String(item.back ?? ""),
        explanation: (item.explanation as string | null | undefined) ?? null,
      })),
  };
}

export function miniTrialToMap(trial: Omit<MiniTrial, "id">) {
  return {
    examId: trial.examId,
    name: trial.name,
    description: trial.description ?? null,
    difficulty: trial.difficulty,
    questionCount: trial.questionCount,
    sortOrder: trial.sortOrder,
    isActive: trial.isActive,
    topicIds: trial.topicIds,
    questionIds: trial.questionIds,
  };
}

export function miniTrialFromDoc(
  id: string,
  data: Record<string, unknown>,
): MiniTrial {
  return {
    id,
    examId: String(data.examId ?? ""),
    name: String(data.name ?? ""),
    description: (data.description as string | null | undefined) ?? null,
    difficulty: Number(data.difficulty ?? 2),
    questionCount: Number(data.questionCount ?? 10),
    sortOrder: Number(data.sortOrder ?? 0),
    isActive: Boolean(data.isActive ?? true),
    topicIds: ((data.topicIds as unknown[] | undefined) ?? []).map(String),
    questionIds: ((data.questionIds as unknown[] | undefined) ?? []).map(String),
  };
}

export function questionToMap(question: Omit<Question, "id">) {
  return {
    examId: question.examId,
    subjectId: question.subjectId,
    topicId: question.topicId,
    type: question.type,
    stem: {
      text: question.stem.text,
      imageUrl: question.stem.imageUrl ?? null,
    },
    payload: {
      options: question.payload.options.map((option) => ({
        id: option.id,
        text: option.text,
        imageUrl: option.imageUrl ?? null,
      })),
      correctOptionIds: question.payload.correctOptionIds,
    },
    explanation: question.explanation ?? null,
    difficulty: question.difficulty,
    source: question.source ?? null,
    year: question.year ?? null,
    isPremium: question.isPremium,
    isActive: question.isActive,
    version: question.version,
    tags: question.tags,
  };
}

export function questionFromDoc(
  id: string,
  data: Record<string, unknown>,
): Question {
  const rawStem = data.stem;
  const stem =
    rawStem && typeof rawStem === "object"
      ? (rawStem as Record<string, unknown>)
      : {};
  const payload = (data.payload as Record<string, unknown> | undefined) ?? {};
  const options = (payload.options as Record<string, unknown>[] | undefined) ?? [];
  const stemText =
    typeof rawStem === "string"
      ? rawStem
      : String(stem.text ?? data.text ?? data.question ?? "");
  return {
    id,
    examId: String(data.examId ?? ""),
    subjectId: String(data.subjectId ?? ""),
    topicId: String(data.topicId ?? ""),
    type: (data.type as Question["type"]) ?? "multipleChoice",
    stem: {
      text: stemText,
      imageUrl: (stem.imageUrl as string | null | undefined) ?? null,
    },
    payload: {
      options: options.map((option) => ({
        id: String(option.id ?? ""),
        text: String(option.text ?? ""),
        imageUrl: (option.imageUrl as string | null | undefined) ?? null,
      })),
      correctOptionIds: ((payload.correctOptionIds as unknown[]) ?? []).map(String),
    },
    explanation: (data.explanation as string | null | undefined) ?? null,
    difficulty: Number(data.difficulty ?? 1),
    source: (data.source as string | null | undefined) ?? null,
    year: data.year == null ? null : Number(data.year),
    isPremium: Boolean(data.isPremium ?? false),
    isActive: data.isActive === false ? false : true,
    version: Number(data.version ?? 1),
    tags: ((data.tags as unknown[]) ?? []).map(String),
  };
}

export function questionPoolToMap(ids: string[]) {
  return { ids, count: ids.length };
}
