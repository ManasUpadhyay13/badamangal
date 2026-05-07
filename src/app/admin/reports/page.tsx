import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/admin");
  return <ReportsClient />;
}
