import { Suspense } from "react";

import QuestionsClient from "./questions-client";

export default function QuestionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Yükleniyor…</p>}>
      <QuestionsClient />
    </Suspense>
  );
}
