"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileQuestion,
  Lightbulb,
  SquareStack,
  Trash2,
} from "lucide-react";

import { useExamContext } from "@/components/providers/exam-context";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, SectionTitle } from "@/components/ui/card";
import { EmptyState, PageLoading } from "@/components/ui/states";
import {
  FLASH_DECK_TARGET_CARDS,
  type FlashDeck,
  type Question,
  type Topic,
  type TopicCheatsheet,
} from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import { deleteTopic, listTopics } from "@/lib/firebase/catalog-repo";
import {
  deleteQuestion,
  getCheatsheet,
  listFlashDecksForTopic,
  listQuestionsForExam,
} from "@/lib/firebase/content-repo";
import { siblingTopicIds } from "@/lib/hierarchy";

export default function TopicHubPage() {
  const params = useParams<{ topicId: string }>();
  const topicId = params.topicId;
  const router = useRouter();
  const { hierarchy, examId } = useExamContext();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [sheet, setSheet] = useState<TopicCheatsheet | null>(null);
  const [decks, setDecks] = useState<FlashDeck[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const db = getClientDb();
        const topics = await listTopics(db, examId ? { examId } : undefined);
        const found = topics.find((t) => t.id === topicId) ?? null;
        setTopic(found);
        const related = new Set(siblingTopicIds(topics, topicId));
        const [cheatsheet, flashDecks, examQuestions] = await Promise.all([
          getCheatsheet(db, topicId),
          listFlashDecksForTopic(db, topicId),
          examId ? listQuestionsForExam(db, examId) : Promise.resolve([]),
        ]);
        setSheet(cheatsheet);
        setDecks(flashDecks);
        setQuestions(
          examQuestions.filter((question) => related.has(question.topicId)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [topicId, examId]);

  const bulletCount =
    sheet?.sections.reduce((sum, s) => sum + s.bullets.length, 0) ?? 0;

  async function removeTopic() {
    if (!topic || busy) return;
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
    try {
      await deleteTopic(getClientDb(), topic);
      router.push("/topics");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
      setBusy(false);
    }
  }

  async function removeQuestion(question: Question) {
    if (busy) return;
    const preview = question.stem.text.trim().slice(0, 80) || question.id;
    if (!window.confirm(`“${preview}” silinsin mi?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteQuestion(getClientDb(), question);
      setQuestions((prev) => prev.filter((item) => item.id !== question.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Soru silinemedi");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <PageLoading label={`${hierarchy.topicLabel} hub yükleniyor…`} />
    );
  }

  if (!topic && error) {
    return <Card className="border-red-200 bg-red-50 text-red-800">{error}</Card>;
  }

  return (
    <div>
      {error ? (
        <Card className="mb-4 border-red-200 bg-red-50 text-red-800">{error}</Card>
      ) : null}
      <Breadcrumbs
        items={[
          { label: hierarchy.topicLabelPlural, href: "/topics" },
          { label: topic?.name ?? topicId },
        ]}
      />
      <PageHeader
        title={topic?.name ?? topicId}
        description={`Bu ${hierarchy.topicLabel.toLowerCase()}nun tüm mobil içeriği. Hap, flash ve soruları buradan yönet.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/topics">
              <Button variant="secondary" type="button">
                <ArrowLeft className="h-4 w-4" />
                {hierarchy.topicLabel} listesi
              </Button>
            </Link>
            {topic ? (
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                onClick={() => void removeTopic()}
              >
                <Trash2 className="h-4 w-4" />
                {hierarchy.topicLabel} sil
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatChip
          icon={<Lightbulb className="h-4 w-4" />}
          label="Hap madde"
          value={bulletCount}
        />
        <StatChip
          icon={<SquareStack className="h-4 w-4" />}
          label="Flash deste"
          value={decks.length}
        />
        <StatChip
          icon={<FileQuestion className="h-4 w-4" />}
          label="Soru"
          value={questions.length}
        />
      </div>

      <div className="space-y-4">
        <Card>
          <SectionTitle
            title="Hap Bilgiler"
            description={`topic_cheatsheets/${topicId}`}
            action={
              <Link href={`/cheatsheets?topicId=${topicId}`}>
                <Button type="button">Düzenle</Button>
              </Link>
            }
          />
          {sheet ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={sheet.isActive ? "success" : "neutral"}>
                  {sheet.isActive ? "Aktif" : "Pasif"} · v{sheet.version}
                </Badge>
                <span className="text-sm text-slate-500">
                  {sheet.sections.length} bölüm · {bulletCount} madde
                </span>
              </div>
              {sheet.summary ? (
                <p className="text-sm text-slate-600">{sheet.summary}</p>
              ) : null}
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {sheet.sections.slice(0, 4).map((section) => (
                  <li key={section.title} className="truncate">
                    • {section.title} ({section.bullets.length})
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              title="Hap bilgi yok"
              description="Mobilde boş görünür. CMS’ten ekle."
              action={
                <Link href={`/cheatsheets?topicId=${topicId}`}>
                  <Button type="button">Oluştur</Button>
                </Link>
              }
            />
          )}
        </Card>

        <Card>
          <SectionTitle
            title="Flashcard Desteleri"
            description={`Hedef ${FLASH_DECK_TARGET_CARDS} kart / deste`}
            action={
              <Link href={`/flash-decks?topicId=${topicId}`}>
                <Button type="button">Yönet</Button>
              </Link>
            }
          />
          {decks.length === 0 ? (
            <EmptyState
              title="Deste yok"
              description="Yeni deste ekleyip kartları doldur."
              action={
                <Link href={`/flash-decks?topicId=${topicId}`}>
                  <Button type="button">Deste ekle</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {decks.map((deck) => {
                const complete = deck.cards.length >= FLASH_DECK_TARGET_CARDS;
                const missing = FLASH_DECK_TARGET_CARDS - deck.cards.length;
                return (
                  <div
                    key={deck.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{deck.title}</p>
                      <p className="text-xs text-slate-500">
                        {deck.cards.length} / {FLASH_DECK_TARGET_CARDS} kart
                      </p>
                    </div>
                    <Badge tone={complete ? "success" : "warning"}>
                      {complete
                        ? "Tamamlandı"
                        : `${Math.max(missing, 0)} kart daha`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="Sorular"
            description="Named test yok — mobil bu dersten soru çeker."
            action={
              <Link href={`/questions?topicId=${topicId}`}>
                <Button type="button">Soruları yönet</Button>
              </Link>
            }
          />
          {questions.length === 0 ? (
            <EmptyState
              title="Soru yok"
              description="Test motoru için soru ekle."
              action={
                <Link href={`/questions?topicId=${topicId}`}>
                  <Button type="button">Soru ekle</Button>
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {questions.slice(0, 6).map((q) => (
                <li
                  key={q.id}
                  className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2">{q.stem.text}</span>
                      <Badge tone={q.isActive ? "success" : "neutral"}>
                        {q.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>
                  </div>
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
                </li>
              ))}
              {questions.length > 6 ? (
                <li className="text-sm text-slate-400">
                  +{questions.length - 6} soru daha
                </li>
              ) : null}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex items-center gap-3 py-3">
      <div className="rounded-xl bg-slate-100 p-2 text-slate-600">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      </div>
    </Card>
  );
}
