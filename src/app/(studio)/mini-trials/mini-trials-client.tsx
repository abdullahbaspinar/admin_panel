"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Trash2 } from "lucide-react";

import { useExamContext } from "@/components/providers/exam-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import { EmptyState, PageLoading } from "@/components/ui/states";
import {
  MINI_TRIAL_DIFFICULTY_LABELS,
  type MiniTrial,
  type Topic,
} from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import { listTopics, reorderByIds, slugifyId } from "@/lib/firebase/catalog-repo";
import {
  deleteMiniTrial,
  listMiniTrialsForExam,
  refreshMiniTrialPool,
  saveMiniTrial,
} from "@/lib/firebase/content-repo";
import { FirestorePaths } from "@/lib/firebase/paths";

const emptyForm = {
  name: "",
  description: "",
  difficulty: 2,
  questionCount: 10,
  isActive: true,
  topicIds: [] as string[],
};

export default function MiniTrialsClient() {
  const { examId, exam, hierarchy } = useExamContext();
  const [trials, setTrials] = useState<MiniTrial[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const topicLabel = hierarchy.topicLabel.toLowerCase();

  const selectedTopicLabels = useMemo(() => {
    const map = new Map(topics.map((t) => [t.id, t.name]));
    return form.topicIds.map((id) => map.get(id) ?? id);
  }, [form.topicIds, topics]);

  async function reload() {
    if (!examId) {
      setTrials([]);
      setTopics([]);
      setLoading(false);
      return;
    }
    const db = getClientDb();
    const [trialList, topicList] = await Promise.all([
      listMiniTrialsForExam(db, examId),
      listTopics(db, { examId }),
    ]);
    setTrials(trialList);
    setTopics(topicList);
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
    setForm({
      name: trial.name,
      description: trial.description ?? "",
      difficulty: trial.difficulty,
      questionCount: trial.questionCount,
      isActive: trial.isActive,
      topicIds: [...trial.topicIds],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!examId || busy) return;
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
        questionCount: Number(form.questionCount),
        sortOrder,
        isActive: form.isActive,
        topicIds: form.topicIds,
        questionIds: editingId
          ? (trials.find((t) => t.id === editingId)?.questionIds ?? [])
          : [],
      };
      await saveMiniTrial(getClientDb(), trial);
      resetForm();
      await reload();
      const poolSize =
        (await listMiniTrialsForExam(getClientDb(), examId)).find(
          (t) => t.id === id,
        )?.questionIds.length ?? 0;
      if (poolSize < trial.questionCount) {
        setMessage(
          `Deneme kaydedildi. Uyarı: havuzda yalnızca ${poolSize} soru var (hedef ${trial.questionCount}). Sorular sayfasından daha fazla soru ekle.`,
        );
      } else {
        setMessage("Deneme kaydedildi. Soru havuzu güncellendi.");
      }
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

  async function refreshPool(trial: MiniTrial) {
    if (!examId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const questionIds = await refreshMiniTrialPool(getClientDb(), trial);
      setMessage(`“${trial.name}” havuzu yenilendi (${questionIds.length} soru).`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Havuz yenilenemedi");
    } finally {
      setBusy(false);
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
        description={`${exam?.name ?? examId} · Mobilde “Mini denemeler” listesi. Kayıtta soru havuzu otomatik seçilir.`}
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
              {Object.entries(MINI_TRIAL_DIFFICULTY_LABELS).map(
                ([level, label]) => (
                  <option key={level} value={level}>
                    {label}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Soru sayısı">
            <Input
              type="number"
              min={1}
              max={100}
              value={form.questionCount}
              onChange={(e) =>
                setForm({ ...form, questionCount: Number(e.target.value) })
              }
              required
            />
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
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              label={`Kapsam — hangi ${topicLabel}lerden soru çekilsin? (boş = hepsi)`}
            >
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
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
              {selectedTopicLabels.length > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Seçili: {selectedTopicLabels.join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Tüm {hierarchy.topicLabelPlural.toLowerCase()}den karışık
                </p>
              )}
            </Field>
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

      <Card>
        <h2 className="mb-3 text-lg font-semibold">
          Denemeler ({trials.length})
        </h2>
        {trials.length === 0 ? (
          <EmptyState
            title="Henüz mini deneme yok"
            description="Yukarıdan ad ve soru sayısı girip kaydet. Mobilde anında listelenir."
          />
        ) : (
          <SortableList
            items={trials}
            onReorder={onReorder}
            renderItem={(trial) => (
              <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {trial.name}
                    </span>
                    <Badge tone="neutral">
                      {MINI_TRIAL_DIFFICULTY_LABELS[trial.difficulty] ??
                        trial.difficulty}
                    </Badge>
                    <Badge tone={trial.isActive ? "success" : "warning"}>
                      {trial.isActive ? "Yayında" : "Taslak"}
                    </Badge>
                    {trial.questionIds.length < trial.questionCount ? (
                      <Badge tone="danger">Eksik havuz</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {trial.questionCount} soru hedefi · havuzda{" "}
                    {trial.questionIds.length} id
                    {trial.topicIds.length > 0
                      ? ` · ${trial.topicIds.length} ${topicLabel}`
                      : ""}
                  </p>
                  {trial.description ? (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {trial.description}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-slate-400">{trial.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void refreshPool(trial)}
                    title="Soru havuzunu yeniden karıştır"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Havuz
                  </Button>
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
    </div>
  );
}
