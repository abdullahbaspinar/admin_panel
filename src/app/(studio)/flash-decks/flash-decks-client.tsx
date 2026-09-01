"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import { useExamContext } from "@/components/providers/exam-context";
import {
  FLASH_DECK_TARGET_CARDS,
  type FlashCard,
  type FlashDeck,
  type Topic,
} from "@/lib/domain/types";
import { getClientDb } from "@/lib/firebase/client";
import { listTopics } from "@/lib/firebase/catalog-repo";
import {
  listFlashDecksForTopic,
  saveFlashDeck,
} from "@/lib/firebase/content-repo";

export default function FlashDecksClient() {
  const search = useSearchParams();
  const initialTopicId = search.get("topicId") ?? "";
  const { examId } = useExamContext();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [decks, setDecks] = useState<FlashDeck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const topic = useMemo(
    () => topics.find((t) => t.id === topicId) ?? null,
    [topics, topicId],
  );
  const activeDeck = decks.find((d) => d.id === activeDeckId) ?? null;

  async function reload(nextTopicId = topicId) {
    const db = getClientDb();
    const list = await listTopics(db, examId ? { examId } : undefined);
    setTopics(list);
    const id =
      (nextTopicId && list.some((t) => t.id === nextTopicId) ? nextTopicId : null) ||
      list[0]?.id ||
      "";
    setTopicId(id);
    if (!id) return;
    const nextDecks = await listFlashDecksForTopic(db, id);
    setDecks(nextDecks);
    setActiveDeckId((current) =>
      current && nextDecks.some((d) => d.id === current)
        ? current
        : nextDecks[0]?.id ?? null,
    );
  }

  useEffect(() => {
    void reload(initialTopicId).catch((err) =>
      setError(err instanceof Error ? err.message : "Yüklenemedi"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  function updateActiveDeck(patch: Partial<FlashDeck>) {
    if (!activeDeck) return;
    setDecks((prev) =>
      prev.map((deck) => (deck.id === activeDeck.id ? { ...deck, ...patch } : deck)),
    );
  }

  function updateCard(index: number, patch: Partial<FlashCard>) {
    if (!activeDeck) return;
    const cards = activeDeck.cards.map((card, i) =>
      i === index ? { ...card, ...patch } : card,
    );
    updateActiveDeck({ cards });
  }

  async function createDeck() {
    if (!topic) return;
    const deck: FlashDeck = {
      id: `${topic.id}_deck_${decks.length + 1}`,
      topicId: topic.id,
      title: `Deste ${decks.length + 1}`,
      subtitle: `${topic.name} — ${FLASH_DECK_TARGET_CARDS} kart`,
      sortOrder: decks.length,
      isActive: true,
      cards: [],
    };
    setDecks([...decks, deck]);
    setActiveDeckId(deck.id);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!activeDeck || !topic) return;
    setError(null);
    setMessage(null);
    try {
      await saveFlashDeck(getClientDb(), activeDeck, topic.examId);
      setMessage("Deste kaydedildi.");
      await reload(topic.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  }

  const cardCount = activeDeck?.cards.length ?? 0;
  const missing = FLASH_DECK_TARGET_CARDS - cardCount;
  const previewCard = activeDeck?.cards[previewIndex];

  return (
    <div>
      <PageHeader
        title="Flashcard Desteleri"
        description={`flash_decks — kartlar deste dokümanında (cards[]). Hedef ${FLASH_DECK_TARGET_CARDS} kart.`}
      />
      <div className="mb-4 max-w-md">
        <Field label="Ders">
          <Select
            value={topicId}
            onChange={(e) => {
              void reload(e.target.value);
            }}
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {decks.map((deck) => (
          <Button
            key={deck.id}
            type="button"
            variant={deck.id === activeDeckId ? "primary" : "secondary"}
            onClick={() => {
              setActiveDeckId(deck.id);
              setPreviewIndex(0);
              setFlipped(false);
            }}
          >
            {deck.title} ({deck.cards.length})
          </Button>
        ))}
        <Button type="button" variant="ghost" onClick={() => void createDeck()}>
          + Yeni deste
        </Button>
      </div>

      {!activeDeck ? (
        <Card>
          <p className="text-sm text-slate-500">Deste seçin veya oluşturun.</p>
        </Card>
      ) : (
        <form onSubmit={onSave} className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card className="space-y-3">
              <Field label="Başlık">
                <Input
                  value={activeDeck.title}
                  onChange={(e) => updateActiveDeck({ title: e.target.value })}
                />
              </Field>
              <Field label="Alt başlık">
                <Input
                  value={activeDeck.subtitle ?? ""}
                  onChange={(e) => updateActiveDeck({ subtitle: e.target.value })}
                />
              </Field>
              <div className="flex items-center gap-3">
                <Badge tone={missing <= 0 ? "success" : "warning"}>
                  {missing <= 0
                    ? "Deste tamamlandı"
                    : `Bu destede ${cardCount} kart var. ${missing} kart daha eklemeniz önerilir.`}
                </Badge>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={activeDeck.isActive}
                    onChange={(e) =>
                      updateActiveDeck({ isActive: e.target.checked })
                    }
                  />
                  Aktif
                </label>
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">Kartlar</h3>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    updateActiveDeck({
                      cards: [
                        ...activeDeck.cards,
                        {
                          id: `c_${activeDeck.cards.length + 1}`,
                          front: "",
                          back: "",
                        },
                      ],
                    })
                  }
                >
                  Kart ekle
                </Button>
              </div>
              <SortableList
                items={activeDeck.cards}
                onReorder={(cards) => updateActiveDeck({ cards })}
                renderItem={(card) => {
                  const index = activeDeck.cards.findIndex((c) => c.id === card.id);
                  return (
                    <div className="space-y-2 py-1">
                      <p className="text-xs font-medium text-slate-500">
                        Kart {index + 1}
                      </p>
                      <Input
                        placeholder="Ön yüz"
                        value={card.front}
                        onChange={(e) => updateCard(index, { front: e.target.value })}
                      />
                      <Textarea
                        rows={2}
                        placeholder="Arka yüz"
                        value={card.back}
                        onChange={(e) => updateCard(index, { back: e.target.value })}
                      />
                      <Input
                        placeholder="Açıklama (opsiyonel)"
                        value={card.explanation ?? ""}
                        onChange={(e) =>
                          updateCard(index, { explanation: e.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          updateActiveDeck({
                            cards: activeDeck.cards.filter((c) => c.id !== card.id),
                          })
                        }
                      >
                        Kartı sil
                      </Button>
                    </div>
                  );
                }}
              />
            </Card>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            <Button type="submit">Desteyi kaydet</Button>
          </div>

          <Card className="h-fit">
            <h3 className="mb-3 font-medium">Önizleme</h3>
            {previewCard ? (
              <button
                type="button"
                onClick={() => setFlipped((v) => !v)}
                className="flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-teal-50 px-4 py-8 text-center shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {flipped ? "Arka yüz" : "Ön yüz"}
                </p>
                <p className="mt-3 text-lg font-medium text-slate-900">
                  {flipped ? previewCard.back : previewCard.front}
                </p>
                <p className="mt-6 text-sm text-teal-700">Çevir</p>
              </button>
            ) : (
              <p className="text-sm text-slate-500">Kart yok.</p>
            )}
            <div className="mt-3 flex justify-between">
              <Button
                type="button"
                variant="secondary"
                disabled={previewIndex <= 0}
                onClick={() => {
                  setPreviewIndex((i) => Math.max(0, i - 1));
                  setFlipped(false);
                }}
              >
                Önceki
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!activeDeck.cards.length || previewIndex >= activeDeck.cards.length - 1}
                onClick={() => {
                  setPreviewIndex((i) =>
                    Math.min(activeDeck.cards.length - 1, i + 1),
                  );
                  setFlipped(false);
                }}
              >
                Sonraki
              </Button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
