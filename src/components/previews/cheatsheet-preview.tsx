"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { TopicCheatsheet } from "@/lib/domain/types";

const ACCENTS = [
  "bg-teal-100 text-teal-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
];

export function CheatsheetPreview({ sheet }: { sheet: TopicCheatsheet | null }) {
  const sections = useMemo(
    () =>
      (sheet?.sections ?? []).filter(
        (section) =>
          section.title.trim() ||
          section.bullets.some((b) => b.trim()) ||
          Boolean(section.note?.trim()),
      ),
    [sheet],
  );

  const [open, setOpen] = useState<Set<number>>(() => new Set([0, 1, 2]));

  useEffect(() => {
    setOpen(new Set([0, 1, 2]));
  }, [sheet?.topicId]);

  function toggle(index: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const hasContent =
    Boolean(sheet?.title.trim() || sheet?.summary?.trim()) || sections.length > 0;

  return (
    <Card className="h-fit">
      <h3 className="mb-3 font-medium text-slate-900">Mobil önizleme</h3>
      {!sheet || !hasContent ? (
        <p className="text-sm text-slate-500">
          Başlık, özet veya madde yazılınca hap bilgi burada görünür.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {sheet.title.trim() || "Hap bilgiler"}
            </p>
            {sheet.summary?.trim() ? (
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {sheet.summary}
              </p>
            ) : null}
          </div>

          {sections.map((section, index) => {
            const expanded = open.has(index);
            const bullets = section.bullets.map((b) => b.trim()).filter(Boolean);
            return (
              <div
                key={`${section.title}-${index}`}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      ACCENTS[index % ACCENTS.length],
                    )}
                  >
                    <Lightbulb className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-slate-900">
                    {section.title.trim() || `Bölüm ${index + 1}`}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-slate-400 transition",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                {expanded ? (
                  <div className="space-y-2 border-t border-slate-100 px-3 py-3">
                    {bullets.length === 0 ? (
                      <p className="text-sm text-slate-400">Madde yok.</p>
                    ) : (
                      bullets.map((bullet, bulletIndex) => (
                        <div key={bulletIndex} className="flex gap-2 text-sm text-slate-700">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                          <span className="leading-relaxed">{bullet}</span>
                        </div>
                      ))
                    )}
                    {section.note?.trim() ? (
                      <p className="rounded-lg bg-teal-50 px-2.5 py-2 text-sm text-teal-900">
                        {section.note}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
