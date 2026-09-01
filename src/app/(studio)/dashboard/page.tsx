"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Lightbulb,
  ListChecks,
  Plus,
  SquareStack,
  FileQuestion,
} from "lucide-react";

import { useExamContext } from "@/components/providers/exam-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, SectionTitle } from "@/components/ui/card";
import { EmptyState, PageLoading } from "@/components/ui/states";
import type { Topic } from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import { listTopics } from "@/lib/firebase/catalog-repo";
import {
  countCollection,
  listMiniTrialsForExam,
} from "@/lib/firebase/content-repo";
import { FirestorePaths } from "@/lib/firebase/paths";

export default function DashboardPage() {
  const { exam, examId, hierarchy, loading: examLoading } = useExamContext();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [counts, setCounts] = useState({
    cheatsheets: 0,
    flashDecks: 0,
    questions: 0,
    miniTrials: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) {
      setTopics([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const db = getClientDb();
        const [topicList, cheatsheets, flashDecks, questions, miniTrials] =
          await Promise.all([
          listTopics(db, { examId }),
          countCollection(db, FirestorePaths.topicCheatsheets),
          countCollection(db, FirestorePaths.flashDecks),
          countCollection(db, FirestorePaths.questions),
          listMiniTrialsForExam(db, examId),
        ]);
        setTopics(topicList);
        setCounts({
          cheatsheets,
          flashDecks,
          questions,
          miniTrials: miniTrials.length,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Dashboard yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  const activeTopics = useMemo(
    () => topics.filter((t) => t.isActive).length,
    [topics],
  );

  if (examLoading || loading) return <PageLoading label="Özet hazırlanıyor…" />;

  if (!examId) {
    return (
      <EmptyState
        title="Önce bir sınav oluştur"
        description={`CMS’te içerik sınav bazlı yönetilir. Sınav ekledikten sonra ${hierarchy.topicLabelPlural.toLowerCase()}i yönetebilirsin.`}
        action={
          <Link href="/exams">
            <Button type="button">Sınavlara git</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={exam?.name ? `${exam.name} özeti` : "Özet"}
        description={
          hierarchy.mode === "course_topics"
            ? `${hierarchy.subjectLabel} → ${hierarchy.topicLabel} → hap / flash / soru. Üstten sınav değiştir.`
            : "Günlük iş akışı: bir derse gir → hap / flash / soru yönet. Üstten sınav değiştir."
        }
        actions={
          <Link href="/topics">
            <Button type="button">
              {hierarchy.topicLabelPlural}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {error ? (
        <Card className="mb-4 border-red-200 bg-red-50 text-red-800">{error}</Card>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: hierarchy.topicLabel,
            value: topics.length,
            sub: `${activeTopics} aktif`,
            href: "/topics",
            icon: BookOpen,
          },
          {
            label: "Mini deneme",
            value: counts.miniTrials,
            href: "/mini-trials",
            icon: ListChecks,
          },
          {
            label: "Hap bilgi",
            value: counts.cheatsheets,
            href: "/cheatsheets",
            icon: Lightbulb,
          },
          {
            label: "Flash deste",
            value: counts.flashDecks,
            href: "/flash-decks",
            icon: SquareStack,
          },
          {
            label: "Soru",
            value: counts.questions,
            href: "/questions",
            icon: FileQuestion,
          },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.label} href={tile.href}>
              <Card className="h-full transition hover:border-teal-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-500">{tile.label}</p>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
                  {tile.value}
                </p>
                {"sub" in tile && tile.sub ? (
                  <p className="mt-1 text-xs text-slate-400">{tile.sub}</p>
                ) : null}
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/topics"
          title={`${hierarchy.topicLabel} hub`}
          text={
            hierarchy.mode === "course_topics"
              ? "Konunun tüm içeriğini tek ekrandan yönet"
              : "Bir dersin tüm içeriğini tek ekrandan yönet"
          }
        />
        <QuickLink
          href="/mini-trials"
          title="Mini denemeler"
          text="Karışık deneme oluştur, soru havuzunu yönet"
        />
        <QuickLink
          href={`/cheatsheets`}
          title="Hap bilgi düzenle"
          text="Bölüm ve maddeleri güncelle"
        />
        <QuickLink
          href="/flash-decks"
          title="Flashcard desteleri"
          text="25 kart hedefi ve önizleme"
        />
      </div>

      <SectionTitle
        title={hierarchy.topicLabelPlural}
        description="Hub’a tıkla — hap, flash ve sorular orada."
        action={
          <Link href="/topics">
            <Button type="button" variant="secondary">
              <Plus className="h-4 w-4" />
              Yönet
            </Button>
          </Link>
        }
      />

      {topics.length === 0 ? (
        <EmptyState
          title="Bu sınavda ders yok"
          description="Ders ekledikten sonra mobilde görünür."
          action={
            <Link href="/topics">
              <Button type="button">Ders ekle</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {topics.slice(0, 9).map((topic) => (
            <Link key={topic.id} href={`/topics/${topic.id}`}>
              <Card className="h-full transition hover:border-teal-300">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{topic.name}</p>
                  <Badge tone={topic.isActive ? "success" : "neutral"}>
                    {topic.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-slate-400">{topic.id}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {topics.length > 9 ? (
        <div className="mt-3 text-center">
          <Link
            href="/topics"
            className="text-sm font-medium text-teal-800 hover:underline"
          >
            Tüm {topics.length} dersi gör
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function QuickLink({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:border-teal-300">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </Card>
    </Link>
  );
}
