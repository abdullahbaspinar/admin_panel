"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Exam } from "@/lib/domain/types";
import { resolveHierarchy, type HierarchyLabels } from "@/lib/hierarchy";
import { getClientDb } from "@/lib/firebase/client";
import { listExams } from "@/lib/firebase/catalog-repo";

const STORAGE_KEY = "qas.selectedExamId";

interface ExamContextValue {
  exams: Exam[];
  examId: string | null;
  exam: Exam | null;
  hierarchy: HierarchyLabels;
  loading: boolean;
  /** True after first load; false until user picks an app (or restores a valid one). */
  hasSelection: boolean;
  setExamId: (id: string) => void;
  clearExamId: () => void;
  refreshExams: () => Promise<void>;
}

const ExamContext = createContext<ExamContextValue | null>(null);

export function ExamProvider({ children }: { children: ReactNode }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const refreshExams = useCallback(async () => {
    const list = await listExams(getClientDb());
    const active = list.filter((e) => e.isActive);
    const catalog = active.length > 0 ? active : list;
    setExams(catalog);

    setExamIdState((current) => {
      if (current && catalog.some((e) => e.id === current)) return current;
      const stored =
        typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored && catalog.some((e) => e.id === stored)) return stored;
      // Do not auto-pick the first exam — user must choose on the app screen.
      return null;
    });
    setLoading(false);
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refreshExams();
      } catch {
        if (!cancelled) {
          setLoading(false);
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshExams]);

  const setExamId = useCallback((id: string) => {
    setExamIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const clearExamId = useCallback(() => {
    setExamIdState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const exam = useMemo(
    () => exams.find((e) => e.id === examId) ?? null,
    [exams, examId],
  );

  const hierarchy = useMemo(
    () => resolveHierarchy(exam?.config),
    [exam],
  );

  const value = useMemo(
    () => ({
      exams,
      examId,
      exam,
      hierarchy,
      loading: loading || !hydrated,
      hasSelection: Boolean(examId),
      setExamId,
      clearExamId,
      refreshExams,
    }),
    [
      exams,
      examId,
      exam,
      hierarchy,
      loading,
      hydrated,
      setExamId,
      clearExamId,
      refreshExams,
    ],
  );

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}

export function useExamContext() {
  const ctx = useContext(ExamContext);
  if (!ctx) throw new Error("useExamContext must be used within ExamProvider");
  return ctx;
}
