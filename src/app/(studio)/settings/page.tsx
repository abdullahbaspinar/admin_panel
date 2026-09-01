"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { getClientDb } from "@/lib/firebase/client";
import { listExams } from "@/lib/firebase/catalog-repo";
import { contentManifestPath } from "@/lib/firebase/paths";
import type { Exam } from "@/lib/domain/types";

export default function SettingsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("hgms");
  const [manifest, setManifest] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const db = getClientDb();
    const examList = await listExams(db);
    setExams(examList);
    const id = examId || examList[0]?.id || "hgms";
    setExamId(id);
    const snap = await getDoc(doc(db, contentManifestPath(id)));
    setManifest(snap.exists() ? snap.data() ?? null : null);
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Yüklenemedi"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bumpPublish() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const db = getClientDb();
      const ref = doc(db, contentManifestPath(examId));
      const current = await getDoc(ref);
      const questionsVersion = current.exists()
        ? Number(current.data()?.questionsVersion ?? 0) + 1
        : 1;
      await setDoc(
        ref,
        {
          schemaVersion: 1,
          questionsVersion,
          updatedAt: new Date().toISOString(),
          publishedBy: "cms-settings",
        },
        { merge: true },
      );
      setMessage(`Yayın sürümü güncellendi → v${questionsVersion}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yayın başarısız");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sistem / İçerik kontrolü"
        description="Quiz App Studio CMS, mobil uygulamanın tek içerik kaynağıdır."
      />
      <div className="space-y-4">
        <Card className="space-y-3 text-sm text-slate-700">
          <h2 className="font-semibold text-slate-900">Kaynak gerçeği</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Tüm ders / hap bilgi / flashcard / soru içeriği yalnızca bu CMS ve
              Firestore üzerinden yönetilir.
            </li>
            <li>
              Mobil uygulama Firestore’u okur; paket içi seed ile CMS içeriğini
              ezmez.
            </li>
            <li>
              Mobil istemci Firestore’a katalog yazmaz (`ContentSeeder` kapalı).
            </li>
            <li>
              <code>isActive: false</code> yaptığın içerik uygulamada görünmez.
            </li>
          </ul>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold text-slate-900">Yayın (content_manifest)</h2>
          <p className="text-sm text-slate-600">
            İçerik kaydettiğinde sürüm otomatik artar. İstersen buradan da
            manuel bump yapabilirsin.
          </p>
          <div className="max-w-xs">
            <Field label="Sınav">
              <Select
                value={examId}
                onChange={(e) => {
                  setExamId(e.target.value);
                  void (async () => {
                    const snap = await getDoc(
                      doc(getClientDb(), contentManifestPath(e.target.value)),
                    );
                    setManifest(snap.exists() ? snap.data() ?? null : null);
                  })();
                }}
              >
                {(exams.length > 0
                  ? exams
                  : [
                      {
                        id: "hgms",
                        slug: "hgms",
                        name: "HGMS",
                        description: "",
                        isActive: true,
                        sortOrder: 0,
                        locale: "tr",
                        config: { defaultQuestionCount: 5 },
                      } satisfies Exam,
                    ]
                ).map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
            {manifest
              ? JSON.stringify(manifest, null, 2)
              : "Manifest yok — içerik kaydedince oluşur."}
          </pre>
          <Button type="button" disabled={busy} onClick={() => void bumpPublish()}>
            {busy ? "Yayınlanıyor…" : "Yayın sürümünü artır"}
          </Button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        </Card>

        <Card className="space-y-2 text-sm text-slate-700">
          <h2 className="font-semibold text-slate-900">Custom claims</h2>
          <p>
            Yazma yetkisi Firestore rules ile korunur. Claim:{" "}
            <code>{`{ "role": "editor" }`}</code> veya{" "}
            <code>admin</code>.
          </p>
        </Card>

        <Card className="space-y-2 text-sm text-slate-700">
          <h2 className="font-semibold text-slate-900">Toplu seed</h2>
          <p>
            İlk yükleme (CLI): <code>npm run seed:hgms:full</code>
          </p>
          <p className="text-slate-500">
            Sonrasında tüm değişiklikler CMS ekranlarından yapılmalı.
          </p>
        </Card>
      </div>
    </div>
  );
}
