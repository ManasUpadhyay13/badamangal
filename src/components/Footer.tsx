import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-12 px-4 py-6 text-center text-sm text-muted-foreground border-t border-border">
      <Link href="/privacy" className="hover:underline">
        Privacy
      </Link>
      <span className="mx-2">·</span>
      <span>🪔 Bhandara · Built with sewa in mind.</span>
    </footer>
  );
}
