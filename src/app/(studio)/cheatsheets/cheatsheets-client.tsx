"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PageLoading } from "@/components/ui/states";
import { useExamContext } from "@/components/providers/exam-context";
import type { CheatsheetSection, Topic, TopicCheatsheet } from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import { listTopics } from "@/lib/firebase/catalog-repo";
import { getCheatsheet, saveCheatsheet } from "@/lib/firebase/content-repo";

function emptySheet(topicId: string, title: string): TopicCheatsheet {
  return {
    topicId,
    title,
    summary: "",
    version: 1,
    isActive: true,
    sections: [{ title: "Bölüm 1", bullets: [""], note: "" }],
  };
}

export default function CheatsheetsClient() {
  const search = useSearchParams();
  const initialTopicId = search.get("topicId") ?? "";
  const { examId } = useExamContext();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [sheet, setSheet] = useState<TopicCheatsheet | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === topicId) ?? null,
    [topics, topicId],
  );

  useEffect(() => {
    void (async () => {
      const db = getClientDb();
      const list = await listTopics(db, examId ? { examId } : undefined);
      setTopics(list);
      const nextId =
        (initialTopicId && list.some((t) => t.id === initialTopicId)
          ? initialTopicId
          : null) ||
        list[0]?.id ||
        "";
      setTopicId(nextId);
      setLoading(false);
    })().catch((err) => {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
      setLoading(false);
    });
  }, [initialTopicId, examId]);

  useEffect(() => {
    if (!topicId) return;
    void (async () => {
      const db = getClientDb();
      const existing = await getCheatsheet(db, topicId);
      const topic = topics.find((t) => t.id === topicId);
      setSheet(existing ?? emptySheet(topicId, topic?.name ?? topicId));
    })().catch((err) =>
      setError(err instanceof Error ? err.message : "Hap bilgi yüklenemedi"),
    );
  }, [topicId, topics]);

  function updateSection(index: number, patch: Partial<CheatsheetSection>) {
    if (!sheet) return;
    const sections = sheet.sections.map((section, i) =>
      i === index ? { ...section, ...patch } : section,
    );
    setSheet({ ...sheet, sections });
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!sheet || !selectedTopic) return;
    setError(null);
    setMessage(null);
    try {
      const cleaned: TopicCheatsheet = {
        ...sheet,
        topicId,
        sections: sheet.sections.map((section) => ({
          ...section,
          bullets: section.bullets.map((b) => b.trim()).filter(Boolean),
        })),
      };
      await saveCheatsheet(getClientDb(), cleaned, selectedTopic.examId);
      setSheet(cleaned);
      setMessage("Hap bilgiler kaydedildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  }

  return (
    <div>
      <PageHeader
        title="Hap Bilgiler"
        description="topic_cheatsheets/{topicId} — sections + bullets (mobil model)."
      />
      <div className="mb-4 max-w-md">
        <Field label="Ders">
          <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {loading || !sheet ? (
        <PageLoading label="Hap bilgiler yükleniyor…" />
      ) : (
        <form onSubmit={onSave} className="space-y-4">
          <Card className="space-y-3">
            <Field label="Başlık">
              <Input
                value={sheet.title}
                onChange={(e) => setSheet({ ...sheet, title: e.target.value })}
                required
              />
            </Field>
            <Field label="Özet">
              <Textarea
                rows={2}
                value={sheet.summary ?? ""}
                onChange={(e) => setSheet({ ...sheet, summary: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap gap-4">
              <Field label="Version">
                <Input
                  type="number"
                  min={1}
                  value={sheet.version}
                  onChange={(e) =>
                    setSheet({ ...sheet, version: Number(e.target.value || 1) })
                  }
                />
              </Field>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sheet.isActive}
                  onChange={(e) =>
                    setSheet({ ...sheet, isActive: e.target.checked })
                  }
                />
                Aktif
              </label>
            </div>
          </Card>

          {sheet.sections.map((section, index) => (
            <Card key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Bölüm {index + 1}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setSheet({
                      ...sheet,
                      sections: sheet.sections.filter((_, i) => i !== index),
                    })
                  }
                >
                  Sil
                </Button>
              </div>
              <Field label="Başlık">
                <Input
                  value={section.title}
                  onChange={(e) => updateSection(index, { title: e.target.value })}
                />
              </Field>
              <Field label="Maddeler (satır başına bir bullet)">
                <Textarea
                  rows={6}
                  value={section.bullets.join("\n")}
                  onChange={(e) =>
                    updateSection(index, {
                      bullets: e.target.value.split("\n"),
                    })
                  }
                />
              </Field>
              <Field label="Not">
                <Input
                  value={section.note ?? ""}
                  onChange={(e) => updateSection(index, { note: e.target.value })}
                />
              </Field>
            </Card>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setSheet({
                  ...sheet,
                  sections: [
                    ...sheet.sections,
                    { title: `Bölüm ${sheet.sections.length + 1}`, bullets: [""] },
                  ],
                })
              }
            >
              Bölüm ekle
            </Button>
            <Button type="submit">Kaydet</Button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        </form>
      )}
    </div>
  );
}
