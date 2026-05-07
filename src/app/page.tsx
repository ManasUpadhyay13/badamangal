import { Star } from "lucide-react";
import MotifBand from "@/components/MotifBand";
import PillarButton from "@/components/PillarButton";

const REPO_URL = "https://github.com/ManasUpadhyay13/badamangal";

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto px-4">
      <header className="py-8 text-center">
        <h1 className="text-2xl font-bold text-saffron-700 m-0">🪔 Bhandara</h1>
        <p className="mt-2 text-ink-600">Find or share a Badamangal near you</p>
      </header>
      <MotifBand />
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8">
        <PillarButton
          href="/find"
          icon="🔎"
          label="Find a Bhandara"
          subtext="Discover events nearby"
        />
        <PillarButton
          href="/post"
          icon="📍"
          label="Post a Bhandara"
          subtext="Share where Prasad is being served"
        />
      </section>
      <p className="text-center text-ink-600 text-sm px-4">
        A community space for charitable food distribution events. Run by sewa, kept honest by AI verification.
      </p>
      <div className="flex justify-center mt-6">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-saffron-100 bg-saffron-50 text-ink-900 text-sm font-medium hover:bg-saffron-100 transition"
        >
          <Star className="size-4 text-gold-500" fill="currentColor" />
          Star this project on GitHub
        </a>
      </div>
    </main>
  );
}
