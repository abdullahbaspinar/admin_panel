"use client";

import { Menu, Shuffle } from "lucide-react";

import { useExamContext } from "@/components/providers/exam-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/states";
import { useRouter } from "next/navigation";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { exam, loading, clearExamId } = useExamContext();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
          aria-label="Menüyü aç"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">
            {exam?.name ?? "İçerik yönetimi"}
          </p>
          <p className="hidden truncate text-xs text-slate-500 sm:block">
            Seçili uygulama · hub’dan içerik yönet
          </p>
        </div>

        <div className="flex items-center gap-2">
          {loading ? (
            <Spinner />
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                clearExamId();
                router.push("/select-app");
              }}
            >
              <Shuffle className="h-4 w-4" />
              <span className="hidden sm:inline">Uygulama değiştir</span>
              <span className="sm:hidden">Değiştir</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
