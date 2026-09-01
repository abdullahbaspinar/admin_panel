import { Suspense } from "react";

import TopicsClient from "./topics-client";

export default function TopicsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Yükleniyor…</p>}>
      <TopicsClient />
    </Suspense>
  );
}
