import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import ListingsClient from "./ListingsClient";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/admin");
  return <ListingsClient adminEmail={auth.email} />;
}
