"use client";

import { FormEvent, useEffect, useState } from "react";

import { useExamContext } from "@/components/providers/exam-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import { PageLoading } from "@/components/ui/states";
import type { Exam, HierarchyMode } from "@/lib/domain/types";
import { resolveHierarchy } from "@/lib/hierarchy";
import { getClientDb } from "@/lib/firebase/client";
import {
  listExams,
  reorderByIds,
  slugifyId,
  upsertExam,
} from "@/lib/firebase/catalog-repo";
import { FirestorePaths } from "@/lib/firebase/paths";

const emptyForm = {
  id: "",
  slug: "",
  name: "",
  description: "",
  defaultQuestionCount: 10,
  hierarchyMode: "flat_courses" as HierarchyMode,
  subjectLabel: "",
  topicLabel: "",
  isActive: true,
};

export default function ExamsPage() {
  const { refreshExams } = useExamContext();
  const [exams, setExams] = useState<Exam[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const db = getClientDb();
    setExams(await listExams(db));
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const db = getClientDb();
      const id = editingId || form.id || slugifyId(form.slug || form.name, "exam");
      const sortOrder =
        editingId != null
          ? exams.find((e) => e.id === editingId)?.sortOrder ?? exams.length
          : exams.length;
      await upsertExam(db, {
        id,
        slug: form.slug || id,
        name: form.name,
        description: form.description,
        isActive: form.isActive,
        sortOrder,
        locale: "tr",
        config: {
          defaultQuestionCount: form.defaultQuestionCount,
          hierarchyMode: form.hierarchyMode,
          subjectLabel: form.subjectLabel.trim() || null,
          topicLabel: form.topicLabel.trim() || null,
        },
      });
      setForm(emptyForm);
      setEditingId(null);
      setMessage("Sınav kaydedildi. Üstteki sınav seçiciyi yenile.");
      await reload();
      await refreshExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  }

  async function onReorder(next: Exam[]) {
    setExams(next);
    try {
      await reorderByIds(
        getClientDb(),
        FirestorePaths.exams,
        next.map((e) => e.id),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sıralama kaydedilemedi");
      await reload();
    }
  }

  function startEdit(exam: Exam) {
    setEditingId(exam.id);
    setForm({
      id: exam.id,
      slug: exam.slug,
      name: exam.name,
      description: exam.description,
      defaultQuestionCount: exam.config.defaultQuestionCount,
      hierarchyMode: exam.config.hierarchyMode ?? "flat_courses",
      subjectLabel: exam.config.subjectLabel ?? "",
      topicLabel: exam.config.topicLabel ?? "",
      isActive: exam.isActive,
    });
  }


  if (loading) return <PageLoading />;

  return (
    <div>
      <PageHeader
        title="Sınavlar"
        description="Sınav kataloğu. Hiyerarşi: tek seviye Ders, veya Ders → Konu."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_min(24rem,100%)]">
        <Card>
          {exams.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz sınav yok.</p>
          ) : (
            <SortableList
              items={exams}
              onReorder={onReorder}
              renderItem={(exam) => {
                const h = resolveHierarchy(exam.config);
                return (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{exam.name}</p>
                      <p className="text-xs text-slate-500">
                        {exam.id} · {h.subjectLabel} → {h.topicLabel}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          h.mode === "course_topics" ? "warning" : "neutral"
                        }
                      >
                        {h.mode === "course_topics" ? "Ders→Konu" : "Ders"}
                      </Badge>
                      <Badge tone={exam.isActive ? "success" : "neutral"}>
                        {exam.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => startEdit(exam)}
                      >
                        Düzenle
                      </Button>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">
            {editingId ? "Sınavı düzenle" : "Yeni sınav"}
          </h2>
          <form className="space-y-3" onSubmit={onSubmit}>
            {!editingId ? (
              <Field label="Document ID">
                <Input
                  value={form.id}
                  placeholder="hgms"
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
              </Field>
            ) : null}
            <Field label="Slug">
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
              />
            </Field>
            <Field label="Ad">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Açıklama">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
            <Field label="İçerik hiyerarşisi">
              <Select
                value={form.hierarchyMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hierarchyMode: e.target.value as HierarchyMode,
                  })
                }
              >
                <option value="flat_courses">
                  Tek seviye — topic = Ders (içerik derste)
                </option>
                <option value="course_topics">
                  İki seviye — subject = Ders, topic = Konu (içerik konuda)
                </option>
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Subject etiketi (opsiyonel)">
                <Input
                  value={form.subjectLabel}
                  placeholder={
                    form.hierarchyMode === "course_topics" ? "Ders" : "Ders grubu"
                  }
                  onChange={(e) =>
                    setForm({ ...form, subjectLabel: e.target.value })
                  }
                />
              </Field>
              <Field label="Topic etiketi (opsiyonel)">
                <Input
                  value={form.topicLabel}
                  placeholder={
                    form.hierarchyMode === "course_topics" ? "Konu" : "Ders"
                  }
                  onChange={(e) =>
                    setForm({ ...form, topicLabel: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Varsayılan soru sayısı">
              <Input
                type="number"
                min={1}
                value={form.defaultQuestionCount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultQuestionCount: Number(e.target.value || 10),
                  })
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Aktif
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? (
              <p className="text-sm text-emerald-700">{message}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{editingId ? "Güncelle" : "Oluştur"}</Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  İptal
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
