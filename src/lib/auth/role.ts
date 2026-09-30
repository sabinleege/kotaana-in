import type { Role } from "@prisma/client";

export const ADMIN_EMAIL = "sabinleege@gmail.com";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function roleForEmail(email: string, requested?: "athlete" | "coach" | "admin"): Role {
  const normalized = normalizeEmail(email);
  if (normalized === ADMIN_EMAIL) return "admin";
  return requested === "coach" ? "coach" : "athlete";
}

export function homePath(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "coach") return "/coach";
  return "/app";
}
