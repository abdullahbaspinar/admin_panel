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
import { ArrowUpRight, Check, Pencil, Plus, Search, X } from "lucide-react";

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
  listSubjects,
  listTopics,
  reorderByIds,
  setActiveFlag,
  slugifyId,
  upsertTopic,
} from "@/lib/firebase/catalog-repo";
import { FirestorePaths } from "@/lib/firebase/paths";

export default function TopicsClient() {
  const search = useSearchParams();
  const initialSubjectId = search.get("subjectId") ?? "";
  const { examId, exam, hierarchy } = useExamContext();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjectFilter, setSubjectFilter] = useState(initialSubjectId);
  const [query, setQuery] = useState("");
  const [quickName, setQuickName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const addSubjectId =
    (subjectFilter && subjects.some((s) => s.id === subjectFilter)
      ? subjectFilter
      : null) ||
    subjects[0]?.id ||
    "";

  async function reload() {
    if (!examId) {
      setSubjects([]);
      setTopics([]);
      setLoading(false);
      return;
    }
    const db = getClientDb();
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
  }, [examId, initialSubjectId]);

  const subjectName = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s.id, s.name])),
    [subjects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((t) => {
      if (subjectFilter && t.subjectId !== subjectFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      );
    });
  }, [topics, query, subjectFilter]);

  async function quickAdd(event?: FormEvent) {
    event?.preventDefault();
    const name = quickName.trim();
    if (!examId || !name || !addSubjectId || busy) return;
    setBusy(true);
    setError(null);
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

  async function toggleActive(topic: Topic) {
    setBusy(true);
    setError(null);
    try {
      await setActiveFlag(
        getClientDb(),
        FirestorePaths.topics,
        topic.id,
        !topic.isActive,
      );
      setTopics((prev) =>
        prev.map((t) =>
          t.id === topic.id ? { ...t, isActive: !t.isActive } : t,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Durum güncellenemedi");
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

  const showSubjectFilter =
    hierarchy.mode === "course_topics" || subjects.length > 1;

  return (
    <div>
      <PageHeader
        title={hierarchy.topicLabelPlural}
        description={`${exam?.name ?? examId} · Ad yaz → Enter. İsme tıkla → yeniden adlandır. Rozete tıkla → aktif/pasif.`}
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
                  {hierarchy.mode === "flat_courses" ? (
                    <option value="">Tümü</option>
                  ) : null}
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
        {!addSubjectId ? (
          <p className="mt-2 text-sm text-amber-700">
            Önce bir {hierarchy.subjectLabel.toLowerCase()} ekle →{" "}
            <Link href="/subjects" className="underline">
              {hierarchy.subjectLabelPlural}
            </Link>
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Listede ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="text-sm tabular-nums text-slate-500">
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
                <button
                  type="button"
                  onClick={() => void toggleActive(topic)}
                  disabled={busy}
                  title="Aktif / pasif"
                >
                  <Badge tone={topic.isActive ? "success" : "neutral"}>
                    {topic.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </button>
                <Link href={`/topics/${topic.id}`}>
                  <Button type="button" variant="secondary">
                    Hub
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
