"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FileQuestion,
  Lightbulb,
  ListChecks,
  SquareStack,
  Trash2,
} from "lucide-react";

import { useExamContext } from "@/components/providers/exam-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, SectionTitle } from "@/components/ui/card";
import { EmptyState, PageLoading } from "@/components/ui/states";
import {
  MINI_TRIAL_DIFFICULTY_LABELS,
  type MiniTrial,
  type Question,
  type Topic,
} from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import { deleteTopic, listTopics } from "@/lib/firebase/catalog-repo";
import {
  listMiniTrialsForExam,
  listQuestionsForExam,
} from "@/lib/firebase/content-repo";

async function settled<T>(promise: Promise<T>, fallback: T) {
  try {
    return { value: await promise, error: null as string | null };
  } catch (err) {
    return {
      value: fallback,
      error: err instanceof Error ? err.message : "Yüklenemedi",
    };
  }
}

export default function DashboardPage() {
  const { exam, examId, hierarchy, loading: examLoading } = useExamContext();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [trials, setTrials] = useState<MiniTrial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) {
      setTopics([]);
      setQuestions([]);
      setTrials([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const db = getClientDb();
      const [topicResult, questionResult, trialResult] = await Promise.all([
        settled(listTopics(db, { examId }), [] as Topic[]),
        settled(listQuestionsForExam(db, examId), [] as Question[]),
        settled(listMiniTrialsForExam(db, examId), [] as MiniTrial[]),
      ]);
      if (cancelled) return;

      setTopics(topicResult.value);
      setQuestions(questionResult.value);
      setTrials(trialResult.value);
      const errors = [topicResult.error, questionResult.error, trialResult.error].filter(
        Boolean,
      );
      setError(errors.length > 0 ? errors.join(" · ") : null);
      setLoading(false);
    })().catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Özet yüklenemedi");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [examId]);

  const questionCountByTopic = useMemo(() => {
    const map = new Map<string, number>();
    for (const question of questions) {
      map.set(question.topicId, (map.get(question.topicId) ?? 0) + 1);
    }
    return map;
  }, [questions]);

  const rows = useMemo(
    () =>
      topics.map((topic) => ({
        topic,
        questions: questionCountByTopic.get(topic.id) ?? 0,
      })),
    [topics, questionCountByTopic],
  );

  const activeTopics = topics.filter((topic) => topic.isActive).length;
  const activeQuestions = questions.filter((question) => question.isActive).length;
  const publishedTrials = trials.filter((trial) => trial.isActive).length;
  const topicsWithoutQuestions = rows.filter((row) => row.questions === 0).length;

  async function removeTopic(topic: Topic) {
    if (busyId) return;
    const label = hierarchy.topicLabel.toLowerCase();
    if (
      !window.confirm(
        `“${topic.name}” silinsin mi?\n\nBu ${label}in hap bilgisi, flashcard desteleri ve soruları da kalıcı olarak silinir.`,
      )
    ) {
      return;
    }
    setBusyId(topic.id);
    setError(null);
    try {
      await deleteTopic(getClientDb(), topic);
      setTopics((prev) => prev.filter((item) => item.id !== topic.id));
      setQuestions((prev) => prev.filter((item) => item.topicId !== topic.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setBusyId(null);
    }
  }

  if (examLoading || loading) return <PageLoading label="Özet hazırlanıyor…" />;

  if (!examId) {
    return (
      <EmptyState
        title="Önce bir sınav seç"
        description="Sınav seçtikten sonra ders, soru ve mini deneme özeti burada görünür."
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
        title={exam?.name ? `${exam.name}` : "Özet"}
        description={`${activeTopics} aktif ${hierarchy.topicLabel.toLowerCase()} · ${activeQuestions} soru · ${publishedTrials} yayındaki mini deneme`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/questions">
              <Button type="button" variant="secondary">
                Soru ekle
              </Button>
            </Link>
            <Link href="/mini-trials">
              <Button type="button">
                Mini deneme
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      {error ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 text-sm text-amber-900">
          Bazı veriler yüklenemedi: {error}
        </Card>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatLink
          href="/topics"
          label={hierarchy.topicLabelPlural}
          value={topics.length}
          hint={`${activeTopics} aktif`}
          icon={BookOpen}
        />
        <StatLink
          href="/questions"
          label="Sorular"
          value={questions.length}
          hint={`${activeQuestions} yayında`}
          icon={FileQuestion}
        />
        <StatLink
          href="/mini-trials"
          label="Mini denemeler"
          value={trials.length}
          hint={`${publishedTrials} yayında`}
          icon={ListChecks}
        />
        <StatLink
          href="/questions"
          label="Sorusuz ders"
          value={topicsWithoutQuestions}
          hint={`soru eklenmesi gereken ${hierarchy.topicLabel.toLowerCase()}`}
          icon={Lightbulb}
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction href="/topics" title={hierarchy.topicLabelPlural} text="Ders ekle, sırala, yayına al" />
        <QuickAction href="/questions" title="Sorular" text="Ders seçip soru yaz" />
        <QuickAction href="/mini-trials" title="Mini denemeler" text="Havuzdan seç veya yeni soru ekle" />
        <QuickAction href="/flash-decks" title="Flashcard" text="Desteleri yönet" />
      </div>

      <SectionTitle
        title={hierarchy.topicLabelPlural}
        description="Soru sayısı derse göre."
        action={
          <Link href="/topics">
            <Button type="button" variant="secondary">
              Tümünü gör
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={`Bu sınavda ${hierarchy.topicLabel.toLowerCase()} yok`}
          description={`${hierarchy.topicLabel} ekledikten sonra özet dolacak.`}
          action={
            <Link href="/topics">
              <Button type="button">{hierarchy.topicLabel} ekle</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{hierarchy.topicLabel}</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3 font-medium">Soru</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.topic.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.topic.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={row.topic.isActive ? "success" : "neutral"}>
                      {row.topic.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{row.questions}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/questions?topicId=${row.topic.id}`}
                        className="text-sm font-medium text-teal-800 hover:underline"
                      >
                        Sorular
                      </Link>
                      <Button
                        type="button"
                        variant="danger"
                        className="px-2.5"
                        disabled={busyId != null}
                        onClick={() => void removeTopic(row.topic)}
                        aria-label={`${row.topic.name} sil`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Sil
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <SectionTitle
          title="Mini denemeler"
          action={
            <Link href="/mini-trials">
              <Button type="button" variant="secondary">
                Yönet
              </Button>
            </Link>
          }
        />
        {trials.length === 0 ? (
          <EmptyState
            title="Mini deneme yok"
            description="Var olan sorulardan seçerek veya yeni soru yazarak deneme oluştur."
            action={
              <Link href="/mini-trials">
                <Button type="button">Mini deneme ekle</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {trials.map((trial) => (
              <Link key={trial.id} href="/mini-trials">
                <Card className="h-full transition hover:border-teal-300">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{trial.name}</p>
                    <Badge tone={trial.isActive ? "success" : "warning"}>
                      {trial.isActive ? "Yayında" : "Taslak"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {MINI_TRIAL_DIFFICULTY_LABELS[trial.difficulty] ?? trial.difficulty}
                    {" · "}
                    {trial.questionIds.length} soru
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatLink({
  href,
  label,
  value,
  hint,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  icon: typeof BookOpen;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:border-teal-300 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-slate-500">{label}</p>
          <Icon className="h-4 w-4 text-slate-400" />
        </div>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      </Card>
    </Link>
  );
}

function QuickAction({
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
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-slate-900">{title}</p>
          {href === "/flash-decks" ? (
            <SquareStack className="h-4 w-4 text-slate-400" />
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </Card>
    </Link>
  );
}
