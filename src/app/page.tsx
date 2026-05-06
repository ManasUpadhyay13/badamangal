import MotifBand from "@/components/MotifBand";
import PillarButton from "@/components/PillarButton";

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
    </main>
  );
}
