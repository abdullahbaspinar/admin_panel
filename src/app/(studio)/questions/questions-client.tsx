"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";

import { QuestionPreview } from "@/components/previews/question-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useExamContext } from "@/components/providers/exam-context";
import type { Question, Topic } from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import { listTopics, slugifyId } from "@/lib/firebase/catalog-repo";
import {
  deleteQuestion,
  listQuestionsForExam,
  saveQuestion,
} from "@/lib/firebase/content-repo";
import { siblingTopicIds } from "@/lib/hierarchy";

const OPTION_IDS = ["A", "B", "C", "D", "E"] as const;

function blankQuestion(topic: Topic): Question {
  return {
    id: "",
    examId: topic.examId,
    subjectId: topic.subjectId,
    topicId: topic.id,
    type: "multipleChoice",
    stem: { text: "" },
    payload: {
      options: OPTION_IDS.slice(0, 4).map((id) => ({ id, text: "" })),
      correctOptionIds: ["A"],
    },
    explanation: "",
    difficulty: 2,
    source: "",
    year: null,
    isPremium: false,
    isActive: true,
    version: 1,
    tags: [],
  };
}

export default function QuestionsClient() {
  const search = useSearchParams();
  const initialTopicId = search.get("topicId") ?? "";
  const { examId } = useExamContext();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const topic = useMemo(
    () => topics.find((t) => t.id === topicId) ?? null,
    [topics, topicId],
  );

  const relatedTopicIds = useMemo(
    () => new Set(siblingTopicIds(topics, topicId)),
    [topics, topicId],
  );

  const questions = useMemo(
    () => allQuestions.filter((question) => relatedTopicIds.has(question.topicId)),
    [allQuestions, relatedTopicIds],
  );

  const duplicateTopicCount = relatedTopicIds.size;

  async function reload(nextTopicId?: string, keepFormId?: string) {
    const db = getClientDb();
    const list = await listTopics(db, examId ? { examId } : undefined);
    setTopics(list);
    const id =
      (nextTopicId && list.some((t) => t.id === nextTopicId) ? nextTopicId : null) ||
      topicId ||
      list[0]?.id ||
      "";
    setTopicId(id);
    if (!examId && !id) {
      setAllQuestions([]);
      return;
    }
    const qs = examId ? await listQuestionsForExam(db, examId) : [];
    setAllQuestions((prev) => {
      const merged = new Map(qs.map((question) => [question.id, question]));
      if (keepFormId) {
        const local = prev.find((question) => question.id === keepFormId);
        if (local && !merged.has(keepFormId)) merged.set(local.id, local);
      }
      return [...merged.values()];
    });
    const selected = list.find((t) => t.id === id);
    if (keepFormId) {
      const saved = qs.find((question) => question.id === keepFormId);
      if (saved) setForm(saved);
      return;
    }
    if (selected) setForm(blankQuestion(selected));
  }

  useEffect(() => {
    void reload(initialTopicId).catch((err) =>
      setError(err instanceof Error ? err.message : "Yüklenemedi"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form || !topic || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const id = form.id || slugifyId(form.stem.text.slice(0, 24), "q");
      const question: Question = {
        ...form,
        id,
        examId: topic.examId || examId || "",
        subjectId: topic.subjectId,
        topicId: topic.id,
        payload: {
          ...form.payload,
          options: form.payload.options.filter((o) => o.text.trim()),
        },
      };
      await saveQuestion(getClientDb(), question);
      setAllQuestions((prev) => {
        const index = prev.findIndex((item) => item.id === question.id);
        if (index === -1) return [question, ...prev];
        return prev.map((item) => (item.id === question.id ? question : item));
      });
      setForm(question);
      setMessage("Soru kaydedildi.");
      await reload(topic.id, question.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(question: Question) {
    if (busy) return;
    const preview = question.stem.text.trim().slice(0, 80) || question.id;
    if (!window.confirm(`“${preview}” silinsin mi?\n\nBu soru mini denemelerden de çıkarılır.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await deleteQuestion(getClientDb(), question);
      setAllQuestions((prev) => prev.filter((item) => item.id !== question.id));
      if (form?.id === question.id && topic) {
        setForm(blankQuestion(topic));
      }
      setMessage("Soru silindi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sorular"
        description="Firestore questions + question_pools. Named Test entity yok; mobil QuizSpec topicId ile çeker."
      />
      <div className="mb-4 max-w-md">
        <Field label="Ders">
          <Select
            value={topicId}
            onChange={(e) => void reload(e.target.value)}
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        {duplicateTopicCount > 1 ? (
          <p className="mt-2 text-xs text-amber-800">
            Aynı adda {duplicateTopicCount} ders var. Sorular birlikte listelenir.
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)_minmax(280px,360px)]">
        <Card>
          <h2 className="mb-3 font-semibold">
            Sorular ({questions.length})
          </h2>
          <div className="space-y-2">
            {questions.map((q) => (
              <div
                key={q.id}
                className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 hover:border-teal-200"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setForm(q)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-800 line-clamp-2">{q.stem.text}</p>
                    <div className="flex shrink-0 gap-1">
                      {q.isPremium ? <Badge tone="warning">Premium</Badge> : null}
                      <Badge tone={q.isActive ? "success" : "neutral"}>
                        {q.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{q.id}</p>
                </button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  className="shrink-0 px-2.5"
                  onClick={() => void removeQuestion(q)}
                  aria-label="Soruyu sil"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {questions.length === 0 ? (
              <p className="text-sm text-slate-500">Bu derste soru yok.</p>
            ) : null}
          </div>
        </Card>

        {form ? (
          <Card>
            <h2 className="mb-4 font-semibold">
              {form.id ? "Soruyu düzenle" : "Yeni soru"}
            </h2>
            <form className="space-y-3" onSubmit={onSubmit}>
              <Field label="Soru metni">
                <Textarea
                  rows={3}
                  value={form.stem.text}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      stem: { ...form.stem, text: e.target.value },
                    })
                  }
                  required
                />
              </Field>
              {form.payload.options.map((option, index) => (
                <Field key={option.id} label={`Şık ${option.id}`}>
                  <Input
                    value={option.text}
                    onChange={(e) => {
                      const options = form.payload.options.map((o, i) =>
                        i === index ? { ...o, text: e.target.value } : o,
                      );
                      setForm({
                        ...form,
                        payload: { ...form.payload, options },
                      });
                    }}
                  />
                </Field>
              ))}
              <Field label="Doğru şık">
                <Select
                  value={form.payload.correctOptionIds[0] ?? "A"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      payload: {
                        ...form.payload,
                        correctOptionIds: [e.target.value],
                      },
                    })
                  }
                >
                  {form.payload.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Açıklama">
                <Textarea
                  rows={2}
                  value={form.explanation ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, explanation: e.target.value })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Zorluk (1–5)">
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        difficulty: Number(e.target.value || 1),
                      })
                    }
                  />
                </Field>
                <Field label="Yıl">
                  <Input
                    type="number"
                    value={form.year ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        year: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Kaynak">
                <Input
                  value={form.source ?? ""}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                />
              </Field>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isPremium}
                    onChange={(e) =>
                      setForm({ ...form, isPremium: e.target.checked })
                    }
                  />
                  Premium
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.checked })
                    }
                  />
                  Aktif
                </label>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {message ? (
                <p className="text-sm text-emerald-700">{message}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  Kaydet
                </Button>
                {topic ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setForm(blankQuestion(topic))}
                  >
                    Yeni
                  </Button>
                ) : null}
                {form.id ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={busy}
                    onClick={() => void removeQuestion(form)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Sil
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        ) : null}

        <div className="xl:sticky xl:top-4">
          <QuestionPreview question={form} />
        </div>
      </div>
    </div>
  );
}
