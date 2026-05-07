import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLanding() {
  const auth = await requireAdmin();
  if (auth.ok) redirect("/admin/listings");
  return <LoginForm />;
}
