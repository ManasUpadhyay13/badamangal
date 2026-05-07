import MotifBand from "@/components/MotifBand";

export const metadata = {
  title: "Privacy · Bhandara",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 pb-16">
      <h1 className="text-2xl font-bold text-saffron-700 mt-6 mb-2">Privacy</h1>
      <MotifBand marginBlock="0.5rem 1.5rem" />

      <h2 className="text-xl font-semibold mt-6 mb-2">What we collect</h2>
      <p>
        When you submit a Bhandara, we store: the location coordinates you provided, the
        event name, date, and time window, the photo you uploaded, the timestamp of
        submission, your device fingerprint (a string derived from browser
        characteristics), and your IP address. The fingerprint and IP are used only to
        enforce a rate limit of five submissions per hour and never displayed publicly.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Why we collect it</h2>
      <p>
        Coordinates, name, time, and photo are public on this site so people can find
        your event. Fingerprint and IP keep the platform fair by preventing abuse. We do
        not advertise, do not sell data, and do not use third-party analytics.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">How long we keep it</h2>
      <p>
        Each Bhandara — including its photo — is automatically deleted the day after its
        event date, at 00:01 IST. Reports are deleted when the listing they reference is
        deleted. Rate-limit records are deleted seven days after they are created.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Photo validation</h2>
      <p>
        Submitted photos are sent to OpenAI&apos;s vision API for authenticity checks
        against reference imagery of bhandara events. Photos that fail validation are not
        stored. Approved photos are public on this site.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Contact</h2>
      <p>
        For questions or removal requests, reach out via the email address listed on the
        GitHub repository.
      </p>
    </main>
  );
}
