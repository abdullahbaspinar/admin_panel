import { cn } from "@/lib/cn";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-slate-100 text-slate-700",
        tone === "success" && "bg-emerald-50 text-emerald-800",
        tone === "warning" && "bg-amber-50 text-amber-800",
        tone === "danger" && "bg-red-50 text-red-700",
      )}
    >
      {children}
    </span>
  );
}
