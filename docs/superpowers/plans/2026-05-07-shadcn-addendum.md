# Shadcn/ui Addendum to the Badamangal Locator Plan

**Read this alongside `2026-05-06-badamangal-locator.md`.** This addendum overrides the main plan where the two conflict.

**Why this exists.** The user requested shadcn/ui everywhere reasonable for UI consistency. The original plan used plain CSS Modules; this addendum switches the foundation to Tailwind v4 + shadcn and replaces hand-rolled UI components with shadcn primitives.

**Subagent guidance.** Whenever a UI task here calls for a shadcn primitive that hasn't been added yet, install it via the shadcn CLI before using it. The `shadcn` skill is available — invoke it for authoritative guidance on installation, component composition, and theming questions.

---

## 1. Stack changes

| Concern | Original plan | Updated |
|---|---|---|
| CSS approach | Plain CSS Modules + `globals.css` | Tailwind v4 utility classes; `globals.css` keeps only `@theme` tokens, the `.motif-band` class, and `body` resets |
| UI primitives | Hand-rolled buttons, inputs, modals | shadcn/ui primitives copied into `src/components/ui/` |
| Forms | Plain `useState` + manual validation | Same — plan keeps controlled inputs; we layer shadcn `Input`, `Label`, `Textarea` on top |
| Toast | Custom `<div>` | shadcn `Sonner` |
| Modal | Custom `Modal.tsx` | shadcn `Dialog` |
| Slider | Plain `<input type="range">` | shadcn `Slider` |
| Toggle (List/Map) | Custom buttons | shadcn `Tabs` |

The motif band, the cultural palette, and Leaflet wrappers (`MapView`, `PinDropMap`) stay as the main plan describes — these aren't primitives shadcn provides.

---

## 2. Component mapping

| Plan-internal name | Replacement |
|---|---|
| `.btn-primary` class | `<Button>` (shadcn) with `variant="default"` |
| `.btn-ghost` class | `<Button variant="outline">` or `variant="ghost"` |
| `.label` class | `<Label>` (shadcn) |
| `.card-surface` class | `<Card>`, `<CardHeader>`, `<CardContent>`, `<CardFooter>` (shadcn) |
| `Modal` (Task 2.12) | `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogFooter>` |
| Custom toast in Find (Task 3.8) | `Sonner` from shadcn (`toast.success("Thanks for sharing 🪔")`) |
| `RadiusSlider` (Task 3.6) | shadcn `<Slider>` wrapped to keep the 300ms debounce + display readout |
| List/Map toggle (Task 4.4) | shadcn `<Tabs>` with `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` |
| Location-mode radio (Task 4.5) | shadcn `<RadioGroup>` + `<RadioGroupItem>` |
| `<textarea>` for report reason (Task 5.2) | shadcn `<Textarea>` |
| "Happening now" badge (Task 3.5) | shadcn `<Badge>` with custom `className="bg-green-700 text-white"` (or a custom variant) |
| Admin reports row | `<Card>` + `<Button>` for actions, `<Badge>` for report count |

**Kept custom (not replaced):**
- `MotifBand` — cultural motif, custom CSS background.
- `PillarButton` — large landing tile, can be built on top of `<Card>` + `<Button>` but the visual treatment is unique enough to warrant a dedicated component.
- `BadamangalCard` — composes `<Card>` + image + custom badge positioning.
- `PhotoInput` — HEIC pipeline; uses shadcn `<Input type="file">` and `<Label>`.
- `LocationPicker` — composes `<RadioGroup>`, `<Button>`, and the Leaflet `PinDropMap`.
- `MapView` and `PinDropMap` — Leaflet only; not shadcn territory.

---

## 3. Replaces Task 1.6 — Tailwind v4 + shadcn setup

The original Task 1.6 ("Global palette and motif CSS") is replaced end-to-end with the steps below. All later tasks reference the resulting Tailwind tokens by their utility class names instead of the CSS variables.

**Files:**
- Modify: `src/app/globals.css` (overwrite — contains only `@theme`, motif band, base resets)
- Create: `postcss.config.mjs`
- Create: `components.json` (created by shadcn init)
- Create: `src/lib/utils.ts` (created by shadcn init)
- Create: `src/components/ui/*` (copied by `shadcn add`)

- [ ] **Step 1: Install Tailwind v4 + PostCSS**

```bash
npm install -D tailwindcss @tailwindcss/postcss postcss
```

- [ ] **Step 2: PostCSS config**

Create `postcss.config.mjs`:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 3: Replace `src/app/globals.css`**

```css
@import "tailwindcss";
@import "leaflet/dist/leaflet.css";

@theme {
  --color-saffron-50:  #fffbeb;
  --color-saffron-100: #fef3c7;
  --color-saffron-500: #ea580c;
  --color-saffron-700: #92400e;
  --color-gold-500:    #ca8a04;
  --color-gold-700:    #854d0e;
  --color-green-700:   #166534;
  --color-green-900:   #14532d;
  --color-ivory:       #fffdf5;
  --color-ink-900:     #3a1f0e;
  --color-ink-600:     #6b3e00;

  /* shadcn semantic tokens — map to our palette */
  --color-background:        var(--color-ivory);
  --color-foreground:        var(--color-ink-900);
  --color-card:              #ffffff;
  --color-card-foreground:   var(--color-ink-900);
  --color-popover:           #ffffff;
  --color-popover-foreground: var(--color-ink-900);
  --color-primary:           var(--color-saffron-500);
  --color-primary-foreground: #ffffff;
  --color-secondary:         var(--color-saffron-100);
  --color-secondary-foreground: var(--color-ink-900);
  --color-muted:             var(--color-saffron-50);
  --color-muted-foreground:  var(--color-ink-600);
  --color-accent:            var(--color-saffron-100);
  --color-accent-foreground: var(--color-ink-900);
  --color-destructive:       #b91c1c;
  --color-destructive-foreground: #ffffff;
  --color-border:            var(--color-saffron-100);
  --color-input:             var(--color-saffron-100);
  --color-ring:              var(--color-gold-500);

  --radius: 8px;
  --font-sans: var(--font-inter), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-deva: var(--font-tiro-deva), serif;
}

@layer base {
  html, body {
    background: var(--color-ivory);
    color: var(--color-ink-900);
    font-family: var(--font-sans);
  }
  * { box-sizing: border-box; }
}

/* Chakra-wedge motif band, 8 px tall — kept as a global utility class */
.motif-band {
  height: 8px;
  width: 100%;
  background-color: var(--color-saffron-50);
  background-image: conic-gradient(
    from 0deg,
    var(--color-gold-500) 0deg 60deg,
    transparent 60deg 90deg,
    var(--color-gold-500) 90deg 150deg,
    transparent 150deg 180deg,
    var(--color-gold-500) 180deg 240deg,
    transparent 240deg 270deg,
    var(--color-gold-500) 270deg 330deg,
    transparent 330deg 360deg
  );
  background-size: 14px 14px;
  background-repeat: repeat-x;
  background-position: center;
}
```

- [ ] **Step 4: Initialize shadcn**

```bash
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Neutral** (we override colors via our `@theme` block above)
- CSS variables: **Yes**

This creates `components.json`, `src/lib/utils.ts` (the `cn()` helper), and updates `tsconfig.json` paths if needed.

- [ ] **Step 5: Add the primitives the plan needs**

```bash
npx shadcn@latest add button input label textarea card dialog tabs slider radio-group sonner badge separator
```

Verify each lands under `src/components/ui/`.

- [ ] **Step 6: Mount the Sonner toaster**

In `src/app/layout.tsx`, add the `<Toaster />` near the bottom of `<body>` (after `{children}`, before `<Footer />`):

```tsx
import { Toaster } from "@/components/ui/sonner";
// ...
<body>
  {children}
  <Toaster richColors position="bottom-center" />
  <Footer />
</body>
```

- [ ] **Step 7: Verify**

```bash
npm run dev
```

Confirm:
- The dev server boots cleanly.
- The landing page (still using the Task 1.10 layout) renders without CSS errors.
- DevTools shows the Tailwind utility class system is active (e.g., `class="text-saffron-700"` resolves to the right colour).

Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(theme): swap to Tailwind v4 + shadcn/ui with palette tokens mapped to semantic colors"
```

---

## 4. Per-task adjustments

For each task below, follow the original plan's structure (write tests, implement, commit) but use the substitutions listed.

### Task 1.7 — Root layout
- Add `<Toaster richColors position="bottom-center" />` from `@/components/ui/sonner` (already covered in §3 Step 6).

### Task 1.9 — PillarButton
- Build the pillar by composing shadcn `<Card>` (background gradient via `className="bg-gradient-to-br from-saffron-500 to-saffron-700 text-white border-2 border-gold-500 shadow-lg"`) wrapped in a `<Link>`. The `<Card>` makes typography and elevation consistent with the rest of the app.
- Replace the `PillarButton.module.css` file with a single component that uses Tailwind classes; delete the `.module.css` file from the original plan.

### Task 1.10 — Landing
- Replace the `page.module.css` styles with Tailwind utilities. The two-column pillar layout becomes `className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-8"`.
- Drop `page.module.css` entirely.

### Task 2.10 — PhotoInput
- Use `<Label htmlFor="photo-input">` (shadcn) and `<Input id="photo-input" type="file" accept="image/*,.heic,.heif" />` (shadcn).
- The "Preparing photo…" status and error states use Tailwind text classes (`text-muted-foreground`, `text-destructive`).

### Task 2.11 + 4.5 — LocationPicker
- Use `<RadioGroup>` + `<RadioGroupItem>` for the geo/pin mode toggle.
- Use shadcn `<Button variant="outline">` for "Detect now" / "Re-detect".
- Surrounding labels use `<Label>`.

### Task 2.12 — Modal → Dialog
- **Replace `Modal.tsx` with shadcn `<Dialog>`**. Subagents should not create a custom Modal component; use `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog`.
- `ResultModals.tsx` becomes:

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type Result =
  | { kind: "rejected"; reason: string }
  | { kind: "rate_limited"; retryAt: Date }
  | null;

export default function ResultModals({
  result,
  onDismiss,
  onRetry,
}: {
  result: Result;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  if (!result) return null;
  if (result.kind === "rejected") {
    return (
      <Dialog open onOpenChange={(o) => !o && onDismiss()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This photo doesn't look like a bhandara</DialogTitle>
            <DialogDescription>{result.reason}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Try a different photo that clearly shows cooking vessels, prasad distribution, or seated devotees being served.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={onDismiss}>Close</Button>
            <Button onClick={onRetry}>Try a different photo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submission limit reached</DialogTitle>
          <DialogDescription>
            You've reached the limit of 5 submissions per hour. Please try again at {result.retryAt.toLocaleTimeString()}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onDismiss}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Task 2.13 — PostForm
- All `<input>` elements use shadcn `<Input>`. All `<label>` elements use shadcn `<Label>`.
- Submit button uses shadcn `<Button type="submit">`. Submit-disabled hint uses Tailwind text utilities.
- Drop `post.module.css`. Layout is Tailwind: `className="max-w-xl mx-auto px-4 pb-16 pt-6"` for the form, `className="grid grid-cols-2 gap-4"` for the time row, `className="mb-5"` for fields.

### Task 3.5 — BadamangalCard
- Wrap content in shadcn `<Card>` with `<CardContent>` for the body. The 16:9 photo block stays a custom `<div>` because it has the absolutely-positioned "Happening now" badge.
- Replace the badge with shadcn `<Badge>` styled `className="absolute top-2 left-2 bg-green-700 text-white"`.
- Replace the action buttons with shadcn `<Button>` (`variant="default"` for primary, `variant="ghost"` for secondary, `variant="link"` for the Report link).

### Task 3.6 — RadiusSlider
- Use shadcn `<Slider>`. Wrap to preserve the 300 ms debounce + readout:

```tsx
"use client";

import { Slider } from "@/components/ui/slider";
import { useEffect, useRef, useState } from "react";

export default function RadiusSlider({
  value,
  onCommit,
  disabled,
}: {
  value: number;
  onCommit: (n: number) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<number | null>(null);
  useEffect(() => setLocal(value), [value]);

  const display = local < 1000 ? `${local} m` : `${(local / 1000).toFixed(1)} km`;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-full bg-saffron-50 border border-saffron-100">
      <span className="text-sm text-ink-600 min-w-[64px]">Within {display}</span>
      <Slider
        value={[local]}
        min={50}
        max={5000}
        step={50}
        onValueChange={(vals) => {
          const next = vals[0] ?? 50;
          setLocal(next);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onCommit(next), 300);
        }}
        disabled={disabled}
        aria-label="Search radius"
        className="flex-1"
      />
    </div>
  );
}
```

### Task 3.7 — ListView
- Skeleton blocks become `<div className="h-56 rounded bg-gradient-to-r from-saffron-50 via-saffron-100 to-saffron-50 animate-pulse" />` — drop the inline `<style>` keyframes.

### Task 3.8 — FindClient
- Replace the custom toast `<div>` with `import { toast } from "sonner";` and call `toast.success("Thanks for sharing 🪔")` inside the `useEffect` that fires when `submitted=1`. Remove the `.toast` class from `find.module.css` and delete the file (use Tailwind for the rest).

### Task 4.4 — List/Map toggle
- Replace the custom `<div className="toggle">` with shadcn `<Tabs>`:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// ...
<Tabs value={view} onValueChange={(v) => setView(v as "list" | "map")}>
  <TabsList>
    <TabsTrigger value="list">List</TabsTrigger>
    <TabsTrigger value="map" disabled={!coord}>Map</TabsTrigger>
  </TabsList>
  <TabsContent value="list">
    <ListView ... />
  </TabsContent>
  <TabsContent value="map">
    {coord && <MapView items={items} center={coord} />}
  </TabsContent>
</Tabs>
```

Drop the corresponding CSS in `find.module.css`.

### Task 5.2 — ReportDialog
- Use shadcn `<Dialog>` instead of the custom Modal.
- The reason `<textarea>` becomes shadcn `<Textarea>`.
- Submit/Cancel buttons use shadcn `<Button>` (`default` and `outline` variants).

### Task 5.6 — Admin reports UI
- Wrap each row in shadcn `<Card>`.
- Use `<Badge>` for the report count.
- Hide / Dismiss actions use shadcn `<Button>` (`outline` and `ghost` variants).
- Use shadcn `<Separator>` between rows if a divider is desired (or skip — the Card border is enough).

---

## 5. Tasks that don't change

These tasks have no UI surface and execute exactly as the main plan describes:

- 1.1, 1.2, 1.3, 1.4, 1.5
- 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9
- 3.1, 3.2, 3.3, 3.4
- 4.1, 4.2, 4.3
- 5.1, 5.4, 5.5
- 6.1, 6.2, 6.3
- 7.2, 7.3

Task 1.8 (`MotifBand`) is unchanged — it stays a thin `<div className="motif-band">` wrapper.

Task 7.1 (polish) is unchanged in spirit, but written as Tailwind utility classes rather than `className="..."` against module scopes. Subagent should adapt without issue.

---

## 6. Cleanup tasks

After Task 1.6 (the new shadcn one), these CSS files should not exist:

- `src/components/PillarButton.module.css` — drop, use Tailwind in the component.
- `src/app/page.module.css` — drop.
- `src/app/post/post.module.css` — drop.
- `src/app/find/find.module.css` — drop (use Tailwind utility classes inside the component).
- `src/app/admin/admin.module.css` — drop.
- `src/components/Modal.tsx` — drop (replaced by shadcn `Dialog`).

If a subagent has already created any of these (e.g., they executed the original Task 1.6 first and the addendum was applied later), include their deletion in the same task that switches to Tailwind.

---

## 7. Sanity checks during execution

- After a UI task, the subagent should run `npm run dev` and visually confirm the page renders. shadcn errors usually surface immediately (missing component file, missing utility class, or mis-cased token).
- After every UI task, run `npm test` and `npm run lint`. The unit tests don't touch shadcn directly so they should remain green. Lint may flag unused imports — clean them up.
- If a subagent struggles with a shadcn issue (theming, component variants, dark-mode quirks, server vs client component placement), invoke the `shadcn` skill for authoritative guidance rather than guessing.
