import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <section className="max-w-3xl mx-auto px-4 py-6">{children}</section>;
}
