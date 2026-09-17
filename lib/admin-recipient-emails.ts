import { parseAdminEmailsEnv } from "@/lib/admin-access";
import { SUPER_ADMIN_EMAIL } from "@/lib/super-admin";
import { listCollectionDocsRest } from "@/lib/firebase/firestore-rest-admin";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Všichni administrátoři, kterým mají jít provozní e-maily (stížnosti). */
export async function collectAdminRecipientEmails(): Promise<string[]> {
  const set = new Set<string>();
  set.add(SUPER_ADMIN_EMAIL.trim().toLowerCase());

  for (const email of parseAdminEmailsEnv()) {
    set.add(email);
  }

  const alert = process.env.ADMIN_ALERT_EMAIL?.trim().toLowerCase();
  if (alert) set.add(alert);

  try {
    const rows = await listCollectionDocsRest("admin_users", 200);
    for (const row of rows) {
      const email = String(row.email ?? "").trim().toLowerCase();
      if (email) set.add(email);
    }
  } catch (e) {
    console.warn(
      "[admin-recipient-emails] admin_users:",
      e instanceof Error ? e.message : e
    );
  }

  return [...set].filter(isEmail);
}
