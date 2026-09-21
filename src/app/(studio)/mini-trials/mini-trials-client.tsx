"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";

import { useExamContext } from "@/components/providers/exam-context";
import { QuestionPreview } from "@/components/previews/question-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import { EmptyState, PageLoading } from "@/components/ui/states";
import {
  MINI_TRIAL_DIFFICULTY_LABELS,
  type MiniTrial,
  type Question,
  type Topic,
} from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import { listTopics, reorderByIds, slugifyId } from "@/lib/firebase/catalog-repo";
import {
  deleteMiniTrial,
  listMiniTrialsForExam,
  listQuestionsForExam,
  saveMiniTrial,
  saveQuestion,
} from "@/lib/firebase/content-repo";
import { expandTopicScope, normalizeLabel } from "@/lib/hierarchy";
import { FirestorePaths } from "@/lib/firebase/paths";

const OPTION_IDS = ["A", "B", "C", "D"] as const;

const emptyForm = {
  name: "",
  description: "",
  difficulty: 2,
  isActive: true,
  topicIds: [] as string[],
  questionIds: [] as string[],
};

const emptyDraft = {
  stem: "",
  options: OPTION_IDS.map((id) => ({ id, text: "" })),
  correct: "A",
  explanation: "",
  topicId: "",
};

export default function MiniTrialsClient() {
  const { examId, exam, hierarchy } = useExamContext();
  const [trials, setTrials] = useState<MiniTrial[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composer, setComposer] = useState<"pick" | "new">("pick");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const topicLabel = hierarchy.topicLabel.toLowerCase();

  const topicNameById = useMemo(
    () => new Map(topics.map((topic) => [topic.id, topic.name])),
    [topics],
  );

  const scopedQuestions = useMemo(() => {
    let list = questions.filter((question) => question.isActive);
    if (form.topicIds.length > 0) {
      const allowed = expandTopicScope(topics, form.topicIds);
      const names = new Set(
        [...allowed]
          .map((id) => topics.find((topic) => topic.id === id)?.name)
          .filter((name): name is string => Boolean(name))
          .map(normalizeLabel),
      );
      list = list.filter(
        (question) =>
          allowed.has(question.topicId) ||
          names.has(normalizeLabel(question.topicId)),
      );
    }
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (q) {
      list = list.filter(
        (question) =>
          question.stem.text.toLocaleLowerCase("tr-TR").includes(q) ||
          question.id.toLocaleLowerCase("tr-TR").includes(q),
      );
    }
    return list;
  }, [questions, form.topicIds, topics, search]);

  const selectedQuestions = useMemo(
    () =>
      form.questionIds
        .map((id) => questions.find((question) => question.id === id))
        .filter((question): question is Question => question != null),
    [form.questionIds, questions],
  );

  useEffect(() => {
    if (previewIndex >= selectedQuestions.length) setPreviewIndex(0);
  }, [previewIndex, selectedQuestions.length]);

  async function reload() {
    if (!examId) {
      setTrials([]);
      setTopics([]);
      setQuestions([]);
      setLoading(false);
      return;
    }
    const db = getClientDb();
    const [trialResult, topicResult, questionResult] = await Promise.allSettled([
      listMiniTrialsForExam(db, examId),
      listTopics(db, { examId }),
      listQuestionsForExam(db, examId),
    ]);

    setTrials(trialResult.status === "fulfilled" ? trialResult.value : []);
    setTopics(topicResult.status === "fulfilled" ? topicResult.value : []);
    setQuestions(questionResult.status === "fulfilled" ? questionResult.value : []);

    const errors = [trialResult, topicResult, questionResult]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) =>
        result.reason instanceof Error ? result.reason.message : "Yüklenemedi",
      );
    setError(errors.length > 0 ? errors.join(" · ") : null);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await reload();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Yüklenemedi");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  function startEdit(trial: MiniTrial) {
    setEditingId(trial.id);
    setComposer("pick");
    setForm({
      name: trial.name,
      description: trial.description ?? "",
      difficulty: trial.difficulty,
      isActive: trial.isActive,
      topicIds: [...trial.topicIds],
      questionIds: [...trial.questionIds],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setDraft({ ...emptyDraft, topicId: topics[0]?.id ?? "" });
    setSearch("");
  }

  function toggleTopic(topicId: string) {
    setForm((prev) => {
      const has = prev.topicIds.includes(topicId);
      return {
        ...prev,
        topicIds: has
          ? prev.topicIds.filter((id) => id !== topicId)
          : [...prev.topicIds, topicId],
      };
    });
  }

  function toggleQuestion(questionId: string) {
    setForm((prev) => {
      const has = prev.questionIds.includes(questionId);
      return {
        ...prev,
        questionIds: has
          ? prev.questionIds.filter((id) => id !== questionId)
          : [...prev.questionIds, questionId],
      };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!examId || busy) return;
    if (form.questionIds.length === 0) {
      setError("En az bir soru seç veya yeni soru ekle.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const id =
        editingId ||
        slugifyId(form.name, `${examId}_trial`).replace(/^top_/, "trial_");
      const sortOrder =
        editingId != null
          ? trials.find((t) => t.id === editingId)?.sortOrder ?? trials.length
          : trials.length;
      const trial: MiniTrial = {
        id,
        examId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        difficulty: Number(form.difficulty),
        questionCount: form.questionIds.length,
        sortOrder,
        isActive: form.isActive,
        topicIds: form.topicIds,
        questionIds: form.questionIds,
      };
      await saveMiniTrial(getClientDb(), trial);
      resetForm();
      await reload();
      setMessage(`Deneme kaydedildi (${trial.questionIds.length} soru).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function onReorder(next: MiniTrial[]) {
    setTrials(next);
    try {
      await reorderByIds(
        getClientDb(),
        FirestorePaths.miniTrials,
        next.map((t) => t.id),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sıralama kaydedilemedi");
      await reload();
    }
  }

  async function removeTrial(trial: MiniTrial) {
    if (!examId || busy) return;
    if (!window.confirm(`“${trial.name}” silinsin mi?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMiniTrial(getClientDb(), trial.id, examId);
      if (editingId === trial.id) resetForm();
      setMessage("Deneme silindi.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setBusy(false);
    }
  }

  async function addDraftQuestion() {
    if (!examId || busy) return;
    const topic =
      topics.find((item) => item.id === (draft.topicId || topics[0]?.id)) ?? null;
    if (!topic) {
      setError("Önce bir ders seç.");
      return;
    }
    const stem = draft.stem.trim();
    const options = draft.options
      .map((option) => ({ ...option, text: option.text.trim() }))
      .filter((option) => option.text);
    if (!stem || options.length < 2) {
      setError("Soru metni ve en az iki şık gerekli.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const question: Question = {
        id: slugifyId(stem.slice(0, 24), "q"),
        examId: topic.examId || examId,
        subjectId: topic.subjectId,
        topicId: topic.id,
        type: "multipleChoice",
        stem: { text: stem },
        payload: {
          options,
          correctOptionIds: [draft.correct],
        },
        explanation: draft.explanation.trim() || null,
        difficulty: form.difficulty,
        source: "mini-trial",
        year: null,
        isPremium: false,
        isActive: true,
        version: 1,
        tags: [],
      };
      await saveQuestion(getClientDb(), question);
      setQuestions((prev) => [question, ...prev.filter((item) => item.id !== question.id)]);
      setForm((prev) => ({
        ...prev,
        questionIds: prev.questionIds.includes(question.id)
          ? prev.questionIds
          : [...prev.questionIds, question.id],
      }));
      setDraft({ ...emptyDraft, topicId: topic.id });
      setComposer("pick");
      setMessage("Soru kaydedildi ve denemeye eklendi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Soru kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoading label="Mini denemeler yükleniyor…" />;

  if (!examId) {
    return (
      <EmptyState
        title="Sınav seçilmedi"
        description="Üst menüden bir sınav seç."
        action={
          <Link href="/exams">
            <Button type="button">Sınavlar</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Mini Denemeler"
        description={`${exam?.name ?? examId} · Var olan sorulardan seç veya burada yeni soru yaz.`}
      />

      {message ? (
        <Card className="mb-3 border-teal-200 bg-teal-50 text-sm text-teal-900">
          {message}
        </Card>
      ) : null}
      {error ? (
        <Card className="mb-3 border-red-200 bg-red-50 text-sm text-red-800">
          {error}
        </Card>
      ) : null}

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">
          {editingId ? "Denemeyi düzenle" : "Yeni mini deneme"}
        </h2>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <Field label="Deneme adı">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Karışık Deneme 1"
              required
              autoFocus
            />
          </Field>
          <Field label="Zorluk etiketi">
            <Select
              value={String(form.difficulty)}
              onChange={(e) =>
                setForm({ ...form, difficulty: Number(e.target.value) })
              }
            >
              {Object.entries(MINI_TRIAL_DIFFICULTY_LABELS).map(([level, label]) => (
                <option key={level} value={level}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Durum">
            <Select
              value={form.isActive ? "active" : "inactive"}
              onChange={(e) =>
                setForm({ ...form, isActive: e.target.value === "active" })
              }
            >
              <option value="active">Yayında (mobilde görünür)</option>
              <option value="inactive">Taslak</option>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Açıklama (opsiyonel)">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={`Filtre — ${topicLabel} (opsiyonel)`}>
              <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                {topics.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Henüz {topicLabel} yok.{" "}
                    <Link href="/topics" className="text-teal-800 underline">
                      {hierarchy.topicLabelPlural}
                    </Link>
                  </p>
                ) : (
                  topics.map((topic) => {
                    const selected = form.topicIds.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          selected
                            ? "bg-teal-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {topic.name}
                      </button>
                    );
                  })
                )}
              </div>
            </Field>
          </div>

          <div className="md:col-span-2">
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={composer === "pick" ? "primary" : "secondary"}
                onClick={() => setComposer("pick")}
              >
                Var olan sorulardan seç
              </Button>
              <Button
                type="button"
                variant={composer === "new" ? "primary" : "secondary"}
                onClick={() => {
                  setComposer("new");
                  setDraft((prev) => ({
                    ...prev,
                    topicId: prev.topicId || form.topicIds[0] || topics[0]?.id || "",
                  }));
                }}
              >
                <Plus className="h-4 w-4" />
                Yeni soru yaz
              </Button>
            </div>

            {composer === "pick" ? (
              <div className="space-y-3">
                <Field label={`Havuz (${scopedQuestions.length} soru)`}>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Soru metninde ara…"
                  />
                </Field>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {scopedQuestions.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-slate-500">
                      Listelenecek soru yok. “Yeni soru yaz” ile ekleyebilirsin.
                    </p>
                  ) : (
                    scopedQuestions.map((question) => {
                      const selected = form.questionIds.includes(question.id);
                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => toggleQuestion(question.id)}
                          className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                            selected
                              ? "bg-teal-50 ring-1 ring-teal-200"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              selected
                                ? "border-teal-600 bg-teal-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {selected ? "✓" : ""}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-slate-800">
                              {question.stem.text || question.id}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-400">
                              {topicNameById.get(question.topicId) ?? question.topicId}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                <Field label="Ders">
                  <Select
                    value={draft.topicId || topics[0]?.id || ""}
                    onChange={(e) => setDraft({ ...draft, topicId: e.target.value })}
                  >
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Soru metni">
                  <Textarea
                    rows={3}
                    value={draft.stem}
                    onChange={(e) => setDraft({ ...draft, stem: e.target.value })}
                    required={false}
                  />
                </Field>
                {draft.options.map((option, index) => (
                  <Field key={option.id} label={`Şık ${option.id}`}>
                    <Input
                      value={option.text}
                      onChange={(e) => {
                        const options = draft.options.map((item, i) =>
                          i === index ? { ...item, text: e.target.value } : item,
                        );
                        setDraft({ ...draft, options });
                      }}
                    />
                  </Field>
                ))}
                <Field label="Doğru şık">
                  <Select
                    value={draft.correct}
                    onChange={(e) => setDraft({ ...draft, correct: e.target.value })}
                  >
                    {draft.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.id}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Açıklama (opsiyonel)">
                  <Textarea
                    rows={2}
                    value={draft.explanation}
                    onChange={(e) =>
                      setDraft({ ...draft, explanation: e.target.value })
                    }
                  />
                </Field>
                <Button
                  type="button"
                  onClick={() => void addDraftQuestion()}
                  disabled={busy}
                >
                  Soruyu kaydet ve denemeye ekle
                </Button>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <h3 className="mb-2 text-sm font-medium text-slate-700">
              Denemedeki sorular ({form.questionIds.length})
            </h3>
            {selectedQuestions.length === 0 ? (
              <p className="text-sm text-slate-500">
                Yukarıdan işaretle veya yeni soru yaz. Seçilenler burada kalır.
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedQuestions.map((question, index) => (
                  <li
                    key={question.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <span className="min-w-0 text-sm text-slate-800">
                      <span className="mr-2 text-xs text-slate-400">{index + 1}.</span>
                      {question.stem.text || question.id}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => toggleQuestion(question.id)}
                    >
                      Çıkar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit" disabled={busy}>
              {editingId ? "Güncelle" : "Kaydet"}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" onClick={resetForm}>
                İptal
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">
            Denemeler ({trials.length})
          </h2>
          {trials.length === 0 ? (
            <EmptyState
              title="Henüz mini deneme yok"
              description="Adını yaz, soruları seç veya yeni soru ekle, kaydet."
            />
          ) : (
            <SortableList
              items={trials}
              onReorder={onReorder}
              renderItem={(trial) => (
                <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{trial.name}</span>
                      <Badge tone="neutral">
                        {MINI_TRIAL_DIFFICULTY_LABELS[trial.difficulty] ??
                          trial.difficulty}
                      </Badge>
                      <Badge tone={trial.isActive ? "success" : "warning"}>
                        {trial.isActive ? "Yayında" : "Taslak"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {trial.questionIds.length} soru
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(trial)}
                    >
                      Düzenle
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void removeTrial(trial)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            />
          )}
        </Card>
        <div className="xl:sticky xl:top-4">
          <QuestionPreview
            question={selectedQuestions[previewIndex] ?? selectedQuestions[0] ?? null}
            index={selectedQuestions.length ? Math.min(previewIndex, selectedQuestions.length - 1) : undefined}
            total={selectedQuestions.length || undefined}
            onPrev={
              previewIndex > 0
                ? () => setPreviewIndex((i) => i - 1)
                : undefined
            }
            onNext={
              previewIndex < selectedQuestions.length - 1
                ? () => setPreviewIndex((i) => i + 1)
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
