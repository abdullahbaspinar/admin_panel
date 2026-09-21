/**
 * Content hierarchy is always:
 *   exams → subjects → topics → (cheatsheets | flash_decks | questions)
 *
 * What those levels MEAN is exam-specific (CMS + future mobile apps).
 *
 * Tek seviye (flat_courses):
 *   subject = optional group ("HGMS Dersleri")
 *   topic   = Ders (Anayasa Hukuku) ← content hangs here
 *
 * İki seviye (course_topics):
 *   subject = Ders (Türkçe, Matematik)
 *   topic   = Konu (Sözcükte Anlam) ← content hangs here
 */

export type HierarchyMode = "flat_courses" | "course_topics";

export interface HierarchyLabels {
  mode: HierarchyMode;
  /** subjects collection UI name */
  subjectLabel: string;
  subjectLabelPlural: string;
  /** topics collection UI name */
  topicLabel: string;
  topicLabelPlural: string;
  /** short help under nav */
  topicHint: string;
  subjectHint: string;
}

export const DEFAULT_HIERARCHY: HierarchyLabels = {
  mode: "flat_courses",
  subjectLabel: "Ders grubu",
  subjectLabelPlural: "Ders grupları",
  topicLabel: "Ders",
  topicLabelPlural: "Dersler",
  topicHint: "Ana çalışma alanı",
  subjectHint: "İsteğe bağlı gruplama",
};

export const COURSE_TOPICS_HIERARCHY: HierarchyLabels = {
  mode: "course_topics",
  subjectLabel: "Ders",
  subjectLabelPlural: "Dersler",
  topicLabel: "Konu",
  topicLabelPlural: "Konular",
  topicHint: "Ders altı konu hub’ı",
  subjectHint: "Türkçe, Matematik…",
};

export function resolveHierarchy(config?: {
  hierarchyMode?: HierarchyMode | string | null;
  subjectLabel?: string | null;
  topicLabel?: string | null;
}): HierarchyLabels {
  const mode: HierarchyMode =
    config?.hierarchyMode === "course_topics" ? "course_topics" : "flat_courses";
  const base = mode === "course_topics" ? COURSE_TOPICS_HIERARCHY : DEFAULT_HIERARCHY;

  const subjectLabel = config?.subjectLabel?.trim() || base.subjectLabel;
  const topicLabel = config?.topicLabel?.trim() || base.topicLabel;

  return {
    ...base,
    mode,
    subjectLabel,
    subjectLabelPlural:
      subjectLabel === base.subjectLabel
        ? base.subjectLabelPlural
        : `${subjectLabel}ler`,
    topicLabel,
    topicLabelPlural:
      topicLabel === base.topicLabel ? base.topicLabelPlural : `${topicLabel}lar`,
  };
}

export function normalizeLabel(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function siblingTopicIds(
  topics: { id: string; name: string }[],
  topicId: string,
): string[] {
  const selected = topics.find((topic) => topic.id === topicId);
  if (!selected) return topicId ? [topicId] : [];
  const name = normalizeLabel(selected.name);
  const ids = topics
    .filter((topic) => normalizeLabel(topic.name) === name)
    .map((topic) => topic.id);
  return ids.length > 0 ? ids : [topicId];
}

export function expandTopicScope(
  topics: { id: string; name: string }[],
  selectedIds: string[],
): Set<string> {
  const names = new Set(
    selectedIds
      .map((id) => topics.find((topic) => topic.id === id)?.name)
      .filter((name): name is string => Boolean(name))
      .map(normalizeLabel),
  );
  const ids = new Set(selectedIds);
  for (const topic of topics) {
    if (names.has(normalizeLabel(topic.name))) ids.add(topic.id);
  }
  return ids;
}
