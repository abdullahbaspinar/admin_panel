"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useExamContext } from "@/components/providers/exam-context";
import type { Question, Topic } from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import { listTopics, slugifyId } from "@/lib/firebase/catalog-repo";
import {
  listQuestionsForTopic,
  saveQuestion,
} from "@/lib/firebase/content-repo";

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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const topic = useMemo(
    () => topics.find((t) => t.id === topicId) ?? null,
    [topics, topicId],
  );

  async function reload(nextTopicId?: string) {
    const db = getClientDb();
    const list = await listTopics(db, examId ? { examId } : undefined);
    setTopics(list);
    const id =
      (nextTopicId && list.some((t) => t.id === nextTopicId) ? nextTopicId : null) ||
      topicId ||
      list[0]?.id ||
      "";
    setTopicId(id);
    if (!id) return;
    const qs = await listQuestionsForTopic(db, id);
    setQuestions(qs);
    const selected = list.find((t) => t.id === id);
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
    if (!form || !topic) return;
    setError(null);
    setMessage(null);
    try {
      const id = form.id || slugifyId(form.stem.text.slice(0, 24), "q");
      const question: Question = {
        ...form,
        id,
        examId: topic.examId,
        subjectId: topic.subjectId,
        topicId: topic.id,
        payload: {
          ...form.payload,
          options: form.payload.options.filter((o) => o.text.trim()),
        },
      };
      await saveQuestion(getClientDb(), question);
      setMessage("Soru kaydedildi · question_pool güncellendi.");
      await reload(topic.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <h2 className="mb-3 font-semibold">
            Sorular ({questions.length})
          </h2>
          <div className="space-y-2">
            {questions.map((q) => (
              <button
                key={q.id}
                type="button"
                className="w-full rounded-lg border border-slate-100 px-3 py-2 text-left hover:border-teal-200"
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
              <div className="flex gap-2">
                <Button type="submit">Kaydet</Button>
                {topic ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setForm(blankQuestion(topic))}
                  >
                    Yeni
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
