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
      <section className="my-10">
        <h2 className="text-center text-xl font-semibold text-saffron-700 mb-6">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2">
              <span aria-hidden>🔎</span> Finding a Bhandara
            </h3>
            <ol className="space-y-3 text-sm">
              <Step n={1} title="Share your location">
                Used only to find bhandaras near you — never saved.
              </Step>
              <Step n={2} title="Adjust the radius">
                Anywhere from 50 m to 5 km. List view by default; toggle to map.
              </Step>
              <Step n={3} title="Get directions">
                One tap opens walking directions in Google Maps.
              </Step>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2">
              <span aria-hidden>📍</span> Posting a Bhandara
            </h3>
            <ol className="space-y-3 text-sm">
              <Step n={1} title="Pin the spot">
                Use your current location, or drop a pin on the map.
              </Step>
              <Step n={2} title="Add when &amp; what">
                Event name, date (within the next 14 days), start and end times.
              </Step>
              <Step n={3} title="Optional photo">
                If you add one, AI checks it&apos;s an authentic bhandara setup before publishing. Either way, your event auto-deletes the day after it ends.
              </Step>
            </ol>
          </div>
        </div>
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

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="shrink-0 size-6 rounded-full bg-saffron-100 text-saffron-700 flex items-center justify-center text-xs font-semibold"
        aria-hidden
      >
        {n}
      </span>
      <div>
        <div className="font-medium text-ink-900">{title}</div>
        <div className="text-ink-600 mt-0.5">{children}</div>
      </div>
    </li>
  );
}
