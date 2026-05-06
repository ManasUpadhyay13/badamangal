export default function MotifBand({
  marginBlock = "0",
}: {
  marginBlock?: string;
}) {
  return (
    <div
      className="motif-band"
      style={{ marginBlock }}
      role="presentation"
      aria-hidden
    />
  );
}
