"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, GraduationCap, LogOut } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useExamContext } from "@/components/providers/exam-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveHierarchy } from "@/lib/hierarchy";
import { EmptyState, PageLoading } from "@/components/ui/states";

export function AppSelectScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { exams, loading, setExamId, refreshExams } = useExamContext();

  function pickApp(examId: string) {
    setExamId(examId);
    router.replace("/dashboard");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950">
        <PageLoading label="Uygulamalar yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(13,148,136,0.28),transparent_42%),radial-gradient(circle_at_85%_80%,rgba(30,64,175,0.22),transparent_40%)]" />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-teal-300/90">
            Quiz App Studio
          </p>
          <p className="mt-1 text-sm text-slate-400">{user?.email}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" />
          Çıkış
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 pb-16 pt-6 sm:px-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Hangi uygulamayı yönetmek istiyorsun?
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Her sınav kendi içerik paneline sahip. Şimdilik HGMS var; yeni
          uygulamalar eklendikçe burada listelenir.
        </p>

        {exams.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="Henüz uygulama yok"
              description="Firestore’da aktif bir exams kaydı bulunamadı. Önce bir sınav oluştur."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void refreshExams()}
                  >
                    Yenile
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      router.push("/exams");
                    }}
                  >
                    Sınavlar
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {exams.map((exam) => {
              const h = resolveHierarchy(exam.config);
              return (
                <li key={exam.id}>
                  <button
                    type="button"
                    onClick={() => pickApp(exam.id)}
                    className="group flex w-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-teal-400/50 hover:bg-white/[0.08]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                        <GraduationCap className="h-5 w-5" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-teal-300" />
                    </div>
                    <p className="mt-4 text-lg font-semibold text-white">
                      {exam.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                      {exam.description?.trim() ||
                        `${h.subjectLabel} → ${h.topicLabel} içerik modeli`}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{exam.id}</Badge>
                      <Badge tone="success">
                        {h.mode === "course_topics" ? "Ders → Konu" : "Ders"}
                      </Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
