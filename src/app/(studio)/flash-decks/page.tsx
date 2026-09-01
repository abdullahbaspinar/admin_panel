import { Suspense } from "react";

import FlashDecksClient from "./flash-decks-client";

export default function FlashDecksPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Yükleniyor…</p>}>
      <FlashDecksClient />
    </Suspense>
  );
}
