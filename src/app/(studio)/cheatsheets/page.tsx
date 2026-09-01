import { Suspense } from "react";

import CheatsheetsClient from "./cheatsheets-client";

export default function CheatsheetsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Yükleniyor…</p>}>
      <CheatsheetsClient />
    </Suspense>
  );
}
