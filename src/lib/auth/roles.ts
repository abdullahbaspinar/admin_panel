import type { StaffRole } from "@/lib/domain/types";

const ROLE_RANK: Record<StaffRole, number> = {
  moderator: 1,
  editor: 2,
  admin: 3,
  super_admin: 4,
};

export function normalizeRole(raw: unknown): StaffRole | null {
  if (raw === "admin" || raw === "editor" || raw === "moderator" || raw === "super_admin") {
    return raw;
  }
  return null;
}

/** Matches firestore.rules isEditor() (+ future super_admin). */
export function canEditContent(role: StaffRole | null): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK.editor;
}

export function canManageReports(role: StaffRole | null): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK.admin || role === "moderator";
}

export function canManageAdmins(role: StaffRole | null): boolean {
  return role === "admin" || role === "super_admin";
}
