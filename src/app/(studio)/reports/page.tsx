"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";

import { Card, PageHeader } from "@/components/ui/card";
import { getClientDb } from "@/lib/firebase/client";
import { FirestorePaths } from "@/lib/firebase/paths";

interface ReportRow {
  id: string;
  userId?: string;
  questionId?: string;
  message?: string;
  status?: string;
}

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const db = getClientDb();
        const snap = await getDocs(
          query(collection(db, FirestorePaths.questionReports)),
        );
        setRows(
          snap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              userId: data.userId as string | undefined,
              questionId: data.questionId as string | undefined,
              message: (data.message ?? data.description) as string | undefined,
              status: data.status as string | undefined,
            };
          }),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? `${err.message} (rules: read yalnızca admin claim)`
            : "Raporlar yüklenemedi",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="İçerik raporları"
        description="question_reports — mobil henüz UI göndermiyor olabilir; collection ve rules hazır."
      />
      <Card>
        {loading ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : error ? (
          <p className="text-sm text-amber-800">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">Bekleyen rapor yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Kullanıcı</th>
                  <th className="py-2 pr-3">Soru</th>
                  <th className="py-2 pr-3">Mesaj</th>
                  <th className="py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-mono text-xs">{row.id}</td>
                    <td className="py-2 pr-3">{row.userId ?? "—"}</td>
                    <td className="py-2 pr-3">{row.questionId ?? "—"}</td>
                    <td className="py-2 pr-3">{row.message ?? "—"}</td>
                    <td className="py-2">{row.status ?? "open"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
