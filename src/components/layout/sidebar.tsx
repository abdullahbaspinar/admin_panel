"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileQuestion,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Lightbulb,
  ListChecks,
  LogOut,
  Settings,
  SquareStack,
  X,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useExamContext } from "@/components/providers/exam-context";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  hint?: string;
};

function NavGroup({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-teal-600 text-white shadow-sm shadow-teal-900/20"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.label}</span>
                {item.hint ? (
                  <span
                    className={cn(
                      "block text-[11px]",
                      active ? "text-teal-100/80" : "text-slate-500",
                    )}
                  >
                    {item.hint}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  const { hierarchy } = useExamContext();

  const primaryNav: NavItem[] =
    hierarchy.mode === "course_topics"
      ? [
          { href: "/dashboard", label: "Özet", icon: LayoutDashboard },
          {
            href: "/subjects",
            label: hierarchy.subjectLabelPlural,
            icon: FolderTree,
            hint: hierarchy.subjectHint,
          },
          {
            href: "/topics",
            label: hierarchy.topicLabelPlural,
            icon: BookOpen,
            hint: hierarchy.topicHint,
          },
        ]
      : [
          { href: "/dashboard", label: "Özet", icon: LayoutDashboard },
          {
            href: "/topics",
            label: hierarchy.topicLabelPlural,
            icon: BookOpen,
            hint: hierarchy.topicHint,
          },
        ];

  const contentNav: NavItem[] = [
    { href: "/cheatsheets", label: "Hap Bilgiler", icon: Lightbulb },
    { href: "/flash-decks", label: "Flashcard", icon: SquareStack },
    { href: "/mini-trials", label: "Mini Denemeler", icon: ListChecks },
    { href: "/questions", label: "Sorular", icon: FileQuestion },
  ];

  const structureNav: NavItem[] = [
    { href: "/exams", label: "Sınavlar", icon: GraduationCap },
    ...(hierarchy.mode === "course_topics"
      ? []
      : [
          {
            href: "/subjects",
            label: hierarchy.subjectLabelPlural,
            icon: FolderTree,
            hint: hierarchy.subjectHint,
          },
        ]),
  ];

  const systemNav: NavItem[] = [
    { href: "/reports", label: "Raporlar", icon: Layers },
    { href: "/settings", label: "Sistem", icon: Settings },
  ];

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col bg-slate-950 text-slate-100 transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-4 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-teal-300/90">
              Quiz App Studio
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight">CMS</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {hierarchy.mode === "course_topics"
                ? "Ders → Konu modeli"
                : "Ders modeli"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <NavGroup
            title="Çalışma"
            items={primaryNav}
            pathname={pathname}
            onNavigate={onClose}
          />
          <NavGroup
            title="İçerik"
            items={contentNav}
            pathname={pathname}
            onNavigate={onClose}
          />
          <NavGroup
            title="Yapı"
            items={structureNav}
            pathname={pathname}
            onNavigate={onClose}
          />
          <NavGroup
            title="Sistem"
            items={systemNav}
            pathname={pathname}
            onNavigate={onClose}
          />
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
          <p className="mt-0.5 text-xs capitalize text-teal-300/80">{role ?? "—"}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Çıkış
          </button>
        </div>
      </aside>
    </>
  );
}
