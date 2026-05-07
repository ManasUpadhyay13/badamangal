import { Suspense } from "react";
import FindClient from "./FindClient";

export default function FindPage() {
  return (
    <Suspense fallback={null}>
      <FindClient />
    </Suspense>
  );
}
