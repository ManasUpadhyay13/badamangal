import Link from "next/link";

export default function PillarButton({
  href,
  icon,
  label,
  subtext,
}: {
  href: string;
  icon: string;
  label: string;
  subtext: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 px-5 py-6 rounded-2xl text-white font-bold text-lg min-h-[120px] border-2 border-gold-500 shadow-lg bg-gradient-to-br from-saffron-500 to-saffron-700 hover:brightness-105 transition"
    >
      <span className="text-3xl leading-none" aria-hidden>
        {icon}
      </span>
      <span className="text-lg">{label}</span>
      <span className="text-sm font-normal opacity-90">{subtext}</span>
    </Link>
  );
}
