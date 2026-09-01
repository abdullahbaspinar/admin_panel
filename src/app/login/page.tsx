"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/states";

export default function LoginPage() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/select-app");
  }, [status, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/select-app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setPending(false);
    }
  }

  if (status === "misconfigured") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-8 text-slate-100">
          <h1 className="text-2xl font-semibold">Firebase yapılandırması eksik</h1>
          <p className="mt-3 text-sm text-slate-300">
            `.env.local` dosyasını kontrol et.
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative overflow-hidden bg-slate-950 px-6 py-10 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(13,148,136,0.35),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(30,64,175,0.28),transparent_40%)]" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.2em] text-teal-200/90">
            Quiz App Studio
          </p>
          <h1 className="mt-4 max-w-sm text-3xl font-semibold leading-tight sm:text-4xl">
            Önce uygulamayı seç, sonra içeriği yönet
          </h1>
          <p className="mt-3 max-w-sm text-sm text-slate-300">
            HGMS ve sonraki sınavlar aynı CMS’ten, ayrı panellerle yönetilir.
          </p>
        </div>
        <p className="relative mt-8 text-xs text-slate-500 lg:mt-0">
          quiz-apps-a4b59
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <h2 className="text-xl font-semibold text-slate-900">Admin girişi</h2>
          <p className="mt-1 text-sm text-slate-500">
            Email/şifre · editor veya admin claim gerekir
          </p>
          <div className="mt-6 space-y-4">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Şifre">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="mt-6 w-full" disabled={pending}>
            {pending ? "Giriş yapılıyor…" : "Giriş yap"}
          </Button>
        </form>
      </div>
    </div>
  );
}
