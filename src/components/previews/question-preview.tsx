"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { Question } from "@/lib/domain/types";

export function QuestionPreview({
  question,
  index,
  total,
  onPrev,
  onNext,
}: {
  question: Question | null;
  index?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setSelected(null);
    setRevealed(false);
  }, [question?.id]);

  const progress = useMemo(() => {
    if (index == null || !total || total <= 0) return null;
    return (index + 1) / total;
  }, [index, total]);

  const options = question?.payload.options.filter((o) => o.text.trim()) ?? [];
  const correct = new Set(question?.payload.correctOptionIds ?? []);
  const canConfirm = Boolean(selected) && !revealed;

  return (
    <Card className="h-fit">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-medium text-slate-900">Mobil önizleme</h3>
        {index != null && total != null ? (
          <p className="text-xs text-slate-400">
            Soru {index + 1} / {total}
          </p>
        ) : null}
      </div>

      {!question || !question.stem.text.trim() ? (
        <p className="text-sm text-slate-500">
          Soru metni yazılınca burada mobil görünüm oluşur.
        </p>
      ) : (
        <div className="space-y-4">
          {progress != null ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
          ) : null}

          <p className="text-base font-semibold leading-snug text-slate-900">
            {question.stem.text}
          </p>

          <div className="space-y-2">
            {options.length === 0 ? (
              <p className="text-sm text-slate-500">Şık ekleyince seçenekler görünür.</p>
            ) : (
              options.map((option) => {
                const isSelected = selected === option.id;
                const isCorrect = correct.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={revealed}
                    onClick={() => setSelected(option.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                      revealed && isCorrect && "border-emerald-300 bg-emerald-50 text-emerald-900",
                      revealed && isSelected && !isCorrect && "border-red-300 bg-red-50 text-red-900",
                      !revealed && isSelected && "border-teal-400 bg-teal-50 text-slate-900",
                      !revealed && !isSelected && "border-slate-200 bg-white text-slate-800 hover:border-teal-200",
                    )}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold shadow-sm">
                      {option.id}
                    </span>
                    <span className="min-w-0 flex-1">{option.text}</span>
                  </button>
                );
              })
            )}
          </div>

          {revealed && question.explanation?.trim() ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {question.explanation}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {revealed ? (
              <Button type="button" variant="secondary" onClick={() => {
                setSelected(null);
                setRevealed(false);
              }}>
                Sıfırla
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!canConfirm}
                onClick={() => setRevealed(true)}
              >
                Onayla
              </Button>
            )}
            {question.isPremium ? <Badge tone="warning">Premium</Badge> : null}
            <Badge tone={question.isActive ? "success" : "neutral"}>
              {question.isActive ? "Aktif" : "Pasif"}
            </Badge>
          </div>
        </div>
      )}

      {onPrev || onNext ? (
        <div className="mt-3 flex justify-between">
          <Button type="button" variant="secondary" disabled={!onPrev} onClick={onPrev}>
            Önceki
          </Button>
          <Button type="button" variant="secondary" disabled={!onNext} onClick={onNext}>
            Sonraki
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
