"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Trash2 } from "lucide-react";

import { useExamContext } from "@/components/providers/exam-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import { EmptyState, PageLoading } from "@/components/ui/states";
import type { Subject } from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import {
  deleteSubject,
  listSubjects,
  reorderByIds,
  slugifyId,
  upsertSubject,
} from "@/lib/firebase/catalog-repo";
import { FirestorePaths } from "@/lib/firebase/paths";

export default function SubjectsPage() {
  const router = useRouter();
  const { examId, exam, hierarchy, loading: examLoading } = useExamContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState({ id: "", name: "", isActive: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (examLoading) return;
    if (hierarchy.mode === "flat_courses") {
      router.replace("/topics");
    }
  }, [examLoading, hierarchy.mode, router]);

  async function reload() {
    if (!examId) {
      setSubjects([]);
      setLoading(false);
      return;
    }
    setSubjects(await listSubjects(getClientDb(), examId));
    setLoading(false);
  }

  useEffect(() => {
    if (examLoading || hierarchy.mode === "flat_courses") return;
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
  }, [examId, examLoading, hierarchy.mode]);

  async function saveSubject(event: React.FormEvent) {
    event.preventDefault();
    if (!examId || !form.name.trim()) return;
    setError(null);
    try {
      const id = editingId || form.id || slugifyId(form.name, "sub");
      const sortOrder =
        editingId != null
          ? subjects.find((s) => s.id === editingId)?.sortOrder ?? subjects.length
          : subjects.length;
      await upsertSubject(getClientDb(), {
        id,
        examId,
        name: form.name.trim(),
        isActive: form.isActive,
        sortOrder,
      });
      setEditingId(null);
      setForm({ id: "", name: "", isActive: true });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  }

  async function removeSubject(subject: Subject) {
    if (busy) return;
    const label = hierarchy.subjectLabel.toLowerCase();
    if (
      !window.confirm(
        `“${subject.name}” silinsin mi?\n\nBu ${label}in tüm konuları, hap bilgileri, flashcard desteleri ve soruları da kalıcı olarak silinir.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteSubject(getClientDb(), subject);
      if (editingId === subject.id) {
        setEditingId(null);
        setForm({ id: "", name: "", isActive: true });
      }
      setSubjects((prev) => prev.filter((item) => item.id !== subject.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setBusy(false);
    }
  }

  if (examLoading || hierarchy.mode === "flat_courses" || loading) {
    return <PageLoading />;
  }

  if (!examId) {
    return (
      <EmptyState
        title="Sınav seç"
        description="Üst menüden sınav seç."
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
        title={hierarchy.subjectLabelPlural}
        description={`${exam?.name ?? ""} · Ders ekle, sonra konularını yönet.`}
      />

      <Card className="mb-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={saveSubject}
        >
          <div className="min-w-0 flex-1">
            <Field
              label={
                editingId
                  ? `${hierarchy.subjectLabel} düzenle`
                  : `Yeni ${hierarchy.subjectLabel.toLowerCase()}`
              }
            >
              <Input
                value={form.name}
                placeholder="Ad yaz, Enter’a bas"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Aktif
          </label>
          <Button type="submit">{editingId ? "Güncelle" : "Ekle"}</Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm({ id: "", name: "", isActive: true });
              }}
            >
              İptal
            </Button>
          ) : null}
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </Card>

      {subjects.length === 0 ? (
        <EmptyState
          title={`${hierarchy.subjectLabel} yok`}
          description="Yukarıya ad yazıp Enter’a bas."
        />
      ) : (
        <SortableList
          items={subjects}
          onReorder={async (next) => {
            setSubjects(next);
            await reorderByIds(
              getClientDb(),
              FirestorePaths.subjects,
              next.map((s) => s.id),
            );
          }}
          renderItem={(subject) => (
            <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">{subject.name}</p>
                <p className="text-xs text-slate-500">{subject.id}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={subject.isActive ? "success" : "neutral"}>
                  {subject.isActive ? "Aktif" : "Pasif"}
                </Badge>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(subject.id);
                    setForm({
                      id: subject.id,
                      name: subject.name,
                      isActive: subject.isActive,
                    });
                  }}
                >
                  Düzenle
                </Button>
                <Link href={`/topics?subjectId=${subject.id}`}>
                  <Button type="button">
                    {hierarchy.topicLabelPlural}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() => void removeSubject(subject)}
                >
                  <Trash2 className="h-4 w-4" />
                  Sil
                </Button>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
