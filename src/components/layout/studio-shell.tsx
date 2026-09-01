"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppSelectScreen } from "@/components/layout/app-select-screen";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { useAuth } from "@/components/providers/auth-provider";
import { ExamProvider, useExamContext } from "@/components/providers/exam-context";
import { Spinner } from "@/components/ui/states";

function StudioChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, hasSelection } = useExamContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const onSelectAppRoute = pathname === "/select-app";
  /** Bootstrap routes usable before an app is chosen (create first exam, etc.). */
  const allowWithoutSelection =
    onSelectAppRoute ||
    pathname === "/exams" ||
    pathname.startsWith("/settings");

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (loading) return;
    if (!hasSelection && !allowWithoutSelection) {
      router.replace("/select-app");
    }
  }, [loading, hasSelection, allowWithoutSelection, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300">
        <Spinner className="h-7 w-7" />
        <p className="text-sm">Hazırlanıyor…</p>
      </div>
    );
  }

  // Always show picker on /select-app (even if one is already selected).
  if (onSelectAppRoute) {
    return <AppSelectScreen />;
  }

  if (!hasSelection && !allowWithoutSelection) {
    return <AppSelectScreen />;
  }

  // No app selected but on /exams or /settings — minimal chrome to bootstrap.
  if (!hasSelection) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <p className="text-sm font-semibold text-slate-900">Quiz App Studio</p>
          <button
            type="button"
            className="text-sm font-medium text-teal-800 hover:underline"
            onClick={() => router.push("/select-app")}
          >
            Uygulama seçimine dön
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMenuOpen(true)} />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated" || status === "misconfigured") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
        <Spinner className="h-7 w-7" />
        <p className="text-sm">Oturum kontrol ediliyor…</p>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Yetkisiz erişim</h1>
        <p className="max-w-md text-sm text-slate-600">
          Bu hesapta <code className="rounded bg-slate-200 px-1">role</code> custom
          claim yok. Gerekli:{" "}
          <code className="rounded bg-slate-200 px-1">{`{ "role": "editor" }`}</code>
          veya <code className="rounded bg-slate-200 px-1">admin</code>.
        </p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <ExamProvider>
      <StudioChrome>{children}</StudioChrome>
    </ExamProvider>
  );
}
