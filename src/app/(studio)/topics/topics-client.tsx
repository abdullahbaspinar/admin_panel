"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { useExamContext } from "@/components/providers/exam-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import { EmptyState, PageLoading } from "@/components/ui/states";
import type { Subject, Topic } from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import {
  ensureDefaultSubject,
  deleteTopic,
  listSubjects,
  listTopics,
  reorderByIds,
  setTopicActive,
  slugifyId,
  upsertTopic,
} from "@/lib/firebase/catalog-repo";
import { FirestorePaths } from "@/lib/firebase/paths";

export default function TopicsClient() {
  const search = useSearchParams();
  const initialSubjectId = search.get("subjectId") ?? "";
  const { examId, exam, hierarchy } = useExamContext();

  const [defaultSubjectId, setDefaultSubjectId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjectFilter, setSubjectFilter] = useState(initialSubjectId);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [quickName, setQuickName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const addSubjectId =
    hierarchy.mode === "flat_courses"
      ? defaultSubjectId
      : (subjectFilter && subjects.some((s) => s.id === subjectFilter)
          ? subjectFilter
          : null) ||
        subjects[0]?.id ||
        "";

  async function reload() {
    if (!examId) {
      setDefaultSubjectId("");
      setSubjects([]);
      setTopics([]);
      setLoading(false);
      return;
    }
    const db = getClientDb();

    if (hierarchy.mode === "flat_courses") {
      const subject = await ensureDefaultSubject(db, examId, exam?.name);
      setDefaultSubjectId(subject.id);
      setSubjects([]);
    } else {
      const subjectList = await listSubjects(db, examId);
      setSubjects(subjectList);
      const preferred =
        (initialSubjectId &&
        subjectList.some((s) => s.id === initialSubjectId)
          ? initialSubjectId
          : null) ||
        subjectFilter ||
        subjectList[0]?.id ||
        "";
      if (preferred && preferred !== subjectFilter) {
        setSubjectFilter(preferred);
      }
    }

    setTopics(await listTopics(db, { examId }));
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
  }, [examId, initialSubjectId, hierarchy.mode]);

  const subjectName = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s.id, s.name])),
    [subjects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((t) => {
      if (
        hierarchy.mode === "course_topics" &&
        subjectFilter &&
        t.subjectId !== subjectFilter
      ) {
        return false;
      }
      if (statusFilter === "active" && !t.isActive) return false;
      if (statusFilter === "inactive" && t.isActive) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      );
    });
  }, [topics, query, subjectFilter, statusFilter, hierarchy.mode]);

  const activeCount = useMemo(
    () => topics.filter((t) => t.isActive).length,
    [topics],
  );

  async function quickAdd(event?: FormEvent) {
    event?.preventDefault();
    const name = quickName.trim();
    if (!examId || !name || !addSubjectId || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await upsertTopic(getClientDb(), {
        id: slugifyId(name, "top"),
        examId,
        subjectId: addSubjectId,
        name,
        isActive: true,
        sortOrder: topics.length,
      });
      setQuickName("");
      setMessage(`“${name}” eklendi.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(topic: Topic) {
    const name = editName.trim();
    if (!name || name === topic.name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertTopic(getClientDb(), { ...topic, name });
      setEditingId(null);
      setTopics((prev) =>
        prev.map((t) => (t.id === topic.id ? { ...t, name } : t)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  function onEditKey(event: KeyboardEvent<HTMLInputElement>, topic: Topic) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveRename(topic);
    } else if (event.key === "Escape") {
      setEditingId(null);
    }
  }

  async function setActive(topic: Topic, isActive: boolean) {
    if (!examId || busy || topic.isActive === isActive) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await setTopicActive(getClientDb(), topic.id, examId, isActive);
      setTopics((prev) =>
        prev.map((t) => (t.id === topic.id ? { ...t, isActive } : t)),
      );
      setMessage(
        isActive
          ? `“${topic.name}” yayında — mobilde görünür.`
          : `“${topic.name}” pasif — mobilde gizlendi.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Durum güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  async function removeTopic(topic: Topic) {
    if (busy) return;
    const label = hierarchy.topicLabel.toLowerCase();
    if (
      !window.confirm(
        `“${topic.name}” silinsin mi?\n\nBu ${label}in hap bilgisi, flashcard desteleri ve soruları da kalıcı olarak silinir.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (editingId === topic.id) setEditingId(null);
      await deleteTopic(getClientDb(), topic);
      setTopics((prev) => prev.filter((t) => t.id !== topic.id));
      setMessage(`“${topic.name}” silindi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setBusy(false);
    }
  }

  async function onReorder(next: Topic[]) {
    if (query.trim()) {
      setError("Sıralama için aramayı temizle.");
      return;
    }
    const orderedIds = next.map((t) => t.id);
    const visible = new Set(orderedIds);
    const merged = [
      ...orderedIds,
      ...topics.filter((t) => !visible.has(t.id)).map((t) => t.id),
    ];
    const byId = new Map([...topics, ...next].map((t) => [t.id, t] as const));
    setTopics(
      merged
        .map((id, index) => {
          const t = byId.get(id);
          return t ? { ...t, sortOrder: index } : null;
        })
        .filter(Boolean) as Topic[],
    );
    await reorderByIds(getClientDb(), FirestorePaths.topics, merged);
  }

  if (loading) {
    return <PageLoading label={`${hierarchy.topicLabelPlural} yükleniyor…`} />;
  }

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

  const showSubjectFilter = hierarchy.mode === "course_topics";

  return (
    <div>
      <PageHeader
        title={hierarchy.topicLabelPlural}
        description={`${exam?.name ?? examId} · ${activeCount} aktif / ${topics.length} toplam. Pasif dersler mobilde görünmez; sil kalıcıdır.`}
      />

      <Card className="mb-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={quickAdd}
        >
          {showSubjectFilter ? (
            <div className="w-full sm:max-w-[14rem]">
              <Field label={hierarchy.subjectLabel}>
                <Select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <Field label={`Yeni ${hierarchy.topicLabel.toLowerCase()}`}>
              <Input
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="Ad yaz, Enter’a bas"
                disabled={busy || !addSubjectId}
                autoFocus
              />
            </Field>
          </div>
          <Button
            type="submit"
            disabled={busy || !quickName.trim() || !addSubjectId}
          >
            <Plus className="h-4 w-4" />
            Ekle
          </Button>
        </form>
        {message ? <p className="mt-2 text-sm text-teal-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Listede ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-auto sm:min-w-[10rem]">
          <Field label="Durum">
            <Select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "inactive")
              }
            >
              <option value="all">Tümü</option>
              <option value="active">Yayında</option>
              <option value="inactive">Pasif</option>
            </Select>
          </Field>
        </div>
        <p className="pb-2 text-sm tabular-nums text-slate-500">
          {filtered.length} / {topics.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            query
              ? "Sonuç yok"
              : `Henüz ${hierarchy.topicLabel.toLowerCase()} yok`
          }
          description={
            query
              ? "Aramayı temizle."
              : `Yukarıya ad yazıp Enter’a bas — ${hierarchy.topicLabel.toLowerCase()} anında eklenir.`
          }
        />
      ) : (
        <SortableList
          items={filtered}
          onReorder={(next) => {
            void onReorder(next);
          }}
          renderItem={(topic) => (
            <div className="flex flex-col gap-2 py-0.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {editingId === topic.id ? (
                  <div className="flex max-w-lg items-center gap-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => onEditKey(e, topic)}
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void saveRename(topic)}
                      disabled={busy}
                      aria-label="Kaydet"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      aria-label="İptal"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="group inline-flex max-w-full items-center gap-1.5 text-left font-medium text-slate-900 hover:text-teal-800"
                      onClick={() => {
                        setEditingId(topic.id);
                        setEditName(topic.name);
                      }}
                      title="Yeniden adlandırmak için tıkla"
                    >
                      <span className="truncate">{topic.name}</span>
                      <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-50" />
                    </button>
                    <p className="truncate text-xs text-slate-500">
                      {topic.id}
                      {showSubjectFilter
                        ? ` · ${subjectName[topic.subjectId] ?? topic.subjectId}`
                        : ""}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={topic.isActive ? "success" : "neutral"}>
                  {topic.isActive ? "Yayında" : "Pasif"}
                </Badge>
                {topic.isActive ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void setActive(topic, false)}
                  >
                    Pasif yap
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void setActive(topic, true)}
                  >
                    Yayınla
                  </Button>
                )}
                <Link href={`/topics/${topic.id}`}>
                  <Button type="button" variant="secondary">
                    Hub
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void removeTopic(topic)}
                  disabled={busy}
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
