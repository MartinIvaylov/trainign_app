# HYBRID Performance Platform — Design System

> **File:** `src/app/globals.css`  
> **Component library:** shadcn/ui (New York style) + custom blocks in `src/components/hybrid/blocks/ui.tsx`  
> **Status:** Phase 0 + Phase 1 shipped

---

## 1. Design Principles

HYBRID has a dark-first athletic aesthetic. The visual language is designed to feel like the dashboard of a race car or a high-end sports watch: deep charcoal backgrounds, high-contrast typography, strong numerical hierarchy, restrained accent colours, technical data visualisation.

1. **Dark-first.** The default theme is dark. A light theme is not planned for v1.
2. **Deep charcoal backgrounds.** Background uses OKLCH `0.13` — dark enough to reduce eye strain during late-evening training reviews, bright enough to keep numerals crisp.
3. **High-contrast typography.** Body text is Geist Sans at high contrast against the background. Numerals use Geist Mono for tabular alignment.
4. **Strong numerical hierarchy.** Stat numbers dominate their containers; secondary labels are deliberately smaller.
5. **Restrained accent colours.** Each training mode has exactly one accent colour. We do not mix accent colours on a single view.
6. **Technical data visualisation.** Charts are clean, gridlines are dashed, axes are muted. The data is the hero.
7. **Subtle motion.** Framer Motion is used for page transitions and modal in/out, never for decoration. No bouncy, playful motion.
8. **Clean spacing.** Tailwind's default spacing scale. No custom spacing tokens.
9. **Distinctive navigation.** Sidebar on desktop, horizontal pill nav on mobile. Never a hamburger menu on desktop.

---

## 2. Colour Tokens

All colours are defined as CSS custom properties in `src/app/globals.css` and surfaced to Tailwind via `@theme inline`. OKLCH is used for perceptual uniformity.

### 2.1 Base palette

| Token              | OKLCH value            | Usage                                                |
|--------------------|------------------------|------------------------------------------------------|
| `--background`     | `0.13 0.012 264`       | App background                                        |
| `--foreground`     | `0.98 0.005 264`       | Body text                                             |
| `--card`           | `0.17 0.012 264`       | Card background                                       |
| `--card-foreground`| `0.98 0.005 264`       | Text on cards                                         |
| `--secondary`      | `0.21 0.012 264`       | Secondary surfaces (sidebar, topbar)                  |
| `--secondary-foreground` | `0.98 0.005 264` | Text on secondary surfaces                          |
| `--muted`          | `0.21 0.012 264`       | Muted backgrounds                                     |
| `--muted-foreground` | `0.70 0.012 264`     | Muted text (labels, hints)                            |
| `--border`         | `0.28 0.012 264`       | All borders, gridlines                                |
| `--input`          | `0.21 0.012 264`       | Input background                                      |
| `--ring`           | `0.70 0.012 264`       | Focus ring                                            |
| `--primary`        | `0.70 0.16 250`        | Primary interactive (currently a neutral-cool)        |
| `--primary-foreground` | `0.13 0.012 264`    | Text on primary                                      |
| `--destructive`    | `0.55 0.22 25`         | Destructive actions (delete)                          |

### 2.2 Mode accent colours

Each training mode has a single accent colour. Mode accents are used for:

- Mode pills in the topbar and profile.
- Mode-tinted cards on the dashboard.
- Line colours in the mode-specific chart.
- The mode-specific module on the dashboard.

| Token         | OKLCH value            | Mode         | Emotional association                |
|---------------|------------------------|--------------|---------------------------------------|
| `--hyrox`     | `0.62 0.20 32`         | HYROX        | Orange-red — warm, competitive        |
| `--athx`      | `0.72 0.14 215`        | ATHX         | Cyan — analytical                     |
| `--crossfit`  | `0.82 0.16 90`         | CrossFit     | Yellow — functional                   |
| `--maint`     | `0.65 0.16 145`        | Maintenance  | Green — recovery                      |

### 2.3 Status colours

| Token        | OKLCH value            | Usage                                    |
|--------------|------------------------|------------------------------------------|
| `--success`  | `0.68 0.16 145`        | Completed session, PR, verified result   |
| `--warning`  | `0.78 0.16 75`         | High RPE, fatigue, streak at risk       |
| `--info`     | `0.70 0.14 215`        | Informational toasts, badges             |

---

## 3. Typography

### 3.1 Font families

- **Body:** Geist Sans (variable, served via `next/font/google` or self-hosted).
- **Data:** Geist Mono (variable).
- No third font family in v1. No serif.

### 3.2 Type scale

Tailwind's default type scale is used (`text-xs` through `text-9xl`). Two custom utility classes are added in `globals.css`:

- **`.text-display`** — used for page titles and hero numbers.  
  `font-weight: 800; letter-spacing: -0.02em; line-height: 1.1;`

- **`.text-stat`** — used for all numeric stats.  
  `font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em;`

The `tabular-nums` setting ensures numbers align column-to-column in stat tables and dashboards.

### 3.3 Numerical hierarchy

| Use case                       | Class               | Size            |
|--------------------------------|---------------------|-----------------|
| Hero number on dashboard       | `text-5xl text-stat`| 48px            |
| Stat in a StatCard             | `text-3xl text-stat`| 30px            |
| Section header number          | `text-xl text-stat` | 20px            |
| Inline metric                  | `text-base text-stat`| 16px           |
| Tabular data row               | `text-sm text-stat` | 14px            |
| Axis label on charts           | `text-xs`           | 12px            |

---

## 4. Spacing Scale

Tailwind's default spacing scale is used. No custom spacing tokens. The most-used values:

| Token | px    | Use                                             |
|-------|-------|-------------------------------------------------|
| `1`   | 4     | Tight icon-to-label spacing                     |
| `2`   | 8     | Inline spacing                                  |
| `3`   | 12    | Default between related items                   |
| `4`   | 16    | Default between unrelated items                |
| `6`   | 24    | Card padding (mobile)                          |
| `8`   | 32    | Card padding (desktop), section spacing        |
| `12`  | 48    | Major section spacing                          |
| `16`  | 64    | Hero spacing                                    |

---

## 5. Custom Components

Built in `src/components/hybrid/blocks/ui.tsx`. These are shared building blocks used across all views.

### 5.1 `Card`

Wraps shadcn's `Card` with consistent padding, rounded corners (`rounded-xl`), `border` using `var(--border)`, and `bg-card`. Used everywhere.

### 5.2 `StatCard`

A single stat with label, value, optional delta, and optional accent colour.

```tsx
<StatCard
  label="Predicted HYROX finish"
  value="1:32:15"
  delta="-4:12"
  deltaTone="positive"
  accent="hyrox"
/>
```

- `deltaTone="positive"` renders in `var(--success)`, `"negative"` in `var(--destructive)`, `"neutral"` in `var(--muted-foreground)`.
- `accent` tints the top border and the value with the mode accent.

### 5.3 `Pill`

A small rounded badge used for tags, mode selectors, filters.

```tsx
<Pill tone="hyrox" active>HYROX</Pill>
```

- Tones: `hyrox`, `athx`, `crossfit`, `maint`, `neutral`, `success`, `warning`, `info`.
- `active` state inverts background and text colour.

### 5.4 `PageHeader`

Title + optional subtitle + optional right-slot for actions.

### 5.5 `SectionTitle`

Smaller than PageHeader; used to introduce a section within a page.

### 5.6 `EmptyState`

Dashed border, icon, title, body, optional action button. Used by every chart and list when there is no data.

```tsx
<EmptyState
  icon={<ActivityIcon />}
  title="No workouts logged yet"
  body="Finish your first workout and analytics will appear here."
  action={<Button>Browse workouts</Button>}
/>
```

### 5.7 `MiniBar`

A tiny horizontal bar used inline (e.g., contribution to a total).

### 5.8 `ScoreCircle`

An SVG ring with a value in the centre. Used for ATHX EPS and readiness score.

---

## 6. shadcn/ui Components Used

The full New York style set is installed. Components used in the app:

- `Button` (variants: default, secondary, outline, ghost, destructive; sizes: sm, default, lg, icon)
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardDescription`, `CardFooter`
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
- `Sheet` (mobile drawer)
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
- `Slider` (RPE input)
- `Switch` (settings toggles)
- `Input`, `Textarea`, `Label`
- `Badge`
- `Avatar`, `AvatarImage`, `AvatarFallback`
- `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
- `Separator`
- `Progress`
- `Skeleton`
- `Toast` (shadcn's Toast is installed but the app uses a custom toast system — see §10)
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`
- `ScrollArea`

---

## 7. Animations

Framer Motion is used. Motion is restrained — no playful bounces.

### 7.1 Page transitions

Each view transition animates `opacity: 0 → 1` and `y: 8 → 0` over 200ms with `ease-out`. Implemented in `AppShell` via `AnimatePresence`.

### 7.2 Card hover

Cards lift 2px on hover (`y: -2`) with a subtle shadow change. Over 150ms. No scale.

### 7.3 Modal and chat

`AnimatePresence` wraps modals (mode switching, session detail) and the AI chat. Modal in: `opacity 0 → 1`, `y: 16 → 0`, 200ms. Out: reverse, 150ms.

### 7.4 Pulse ring

A subtle pulse-ring animation on status indicators (live workout, syncing wearable). Uses the `@keyframes` defined in `globals.css`.

### 7.5 Shimmer

Skeleton loaders use a shimmer animation sweeping left-to-right over 1.5s, looping. Used on the AI coach answer while waiting for the response.

---

## 8. Layout Patterns

### 8.1 Desktop

Sidebar (fixed left, 240px) + main content. Top bar (sticky, 56px) with page title + global actions. The sidebar contains the 8 main nav items + the mode pill at the top + the athlete avatar at the bottom.

### 8.2 Mobile

Below `md` breakpoint, the sidebar collapses. Navigation becomes a horizontal pill nav in the top bar. Page content gets full width. The bottom tab bar (planned for native mobile) is not yet rendered in the web app.

### 8.3 Sticky footer pattern

Pages use `min-h-screen flex flex-col` with `main` set to `flex-1`. This keeps the footer (when present) pinned to the bottom of the viewport on short pages.

### 8.4 Grid

Dashboard uses CSS grid via Tailwind `grid` and `grid-cols-*` utilities. The default dashboard grid is `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` with `gap-4` or `gap-6`.

---

## 9. Chart Styling (Recharts)

All charts in `src/components/hybrid/views/performance.tsx` follow these rules:

- **Container:** `<ResponsiveContainer width="100%" height={...}>` — every chart adapts to its parent.
- **Tooltip:** `contentStyle={{ background: var(--card), border: '1px solid var(--border)', borderRadius: 8, color: var(--muted-foreground) }}`. Item labels use `var(--foreground)`.
- **Lines:** mode accent colour for the primary series, `var(--muted-foreground)` for reference lines.
- **Cartesian grid:** `strokeDasharray="3 3"`, `stroke="var(--border)"`. No vertical gridlines on bar charts.
- **Axes:** `tick={{ fill: var(--muted-foreground), fontSize: 12 }}`, `axisLine={false}`, `tickLine={false}`.
- **Area gradient fill:** uses a linear gradient from the mode accent at 0.3 opacity to transparent.
- **Radar:** polygon stroke is the mode accent, fill is the same accent at 0.15 opacity.
- **Bar:** mode accent, rounded top corners (`radius={[4,4,0,0]}`).
- **Empty state:** when a chart has no data, the chart container is replaced with `<EmptyState />` — we never render an empty chart.

---

## 10. Empty States

Used everywhere data could be missing. The contract:

```tsx
<EmptyState
  icon={<Icon />}
  title="Short, specific title"
  body="One sentence explaining what would be here and what to do to populate it."
  action={<Button>Optional primary action</Button>}
/>
```

Visual:

- Dashed `var(--border)` border.
- `rounded-xl`.
- Centered content, `gap-3` between elements.
- Icon size 24px, `var(--muted-foreground)`.
- Title: `text-base font-semibold`.
- Body: `text-sm text-muted-foreground`.

---

## 11. Toasts

Custom toast system in `src/components/hybrid/toasts.tsx`. (shadcn's Toast is installed but we use a custom system for tighter control of animation and stacking.)

- **Position:** bottom-right on desktop, bottom-centre on mobile.
- **Animation:** slide-in from bottom + spring physics. Out: slide-down + fade.
- **Kinds:** `info`, `success`, `warning`, `error`. Each has a kind-specific icon and accent colour.
- **Auto-dismiss:** after 4.5 seconds.
- **Manual close:** × button top-right.
- **Stack:** up to 3 visible; older toasts dismissed.
- **Accessibility:** `role="status"` for info/success, `role="alert"` for warning/error. `aria-live="polite"` container.

---

## 12. Mode Colour Usage

| Mode         | Accent              | Where it appears                                                                  |
|--------------|---------------------|------------------------------------------------------------------------------------|
| HYROX        | Orange-red (`--hyrox`) | Mode pill, dashboard module, HYROX simulator chart, station analytics bars       |
| ATHX         | Cyan (`--athx`)        | Mode pill, EPS score circle, ATHX radar, pairs mode header                       |
| CrossFit     | Yellow (`--crossfit`) | Mode pill, benchmark PRs list accents, WOD timer kind chip                      |
| Maintenance  | Green (`--maint`)      | Mode pill, recovery week badges, maintenance block accent                       |

When an athlete switches active mode, the dashboard module tint and the primary chart line switch to the new accent. History is preserved; only the *accent* changes.

---

## 13. Responsive Breakpoints

Tailwind defaults, mobile-first:

| Breakpoint | Min width | Behaviour                                                  |
|------------|-----------|------------------------------------------------------------|
| (default)  | 0         | Single column, horizontal pill nav, stacked cards         |
| `sm`       | 640px     | Two-column dashboard grid for small tablets               |
| `md`       | 768px     | Sidebar appears; pill nav collapses into the sidebar      |
| `lg`       | 1024px    | Three-column dashboard grid on wide tablets / laptops     |
| `xl`       | 1280px    | Full desktop layout; charts get more width                |
| `2xl`      | 1536px    | Optional; main content max-width caps at 1400px            |

---

## 14. Accessibility

- **Semantic HTML:** `main`, `header`, `nav`, `section`, `article` are used appropriately. The sidebar is a `<nav aria-label="Main">`.
- **Screen-reader-only text:** `sr-only` class for labels that are visual-only (e.g., icon-only buttons).
- **Icon-only buttons** have `aria-label`.
- **Touch targets:** minimum 44×44px on all interactive elements. The smallest tap target in the app is the Timer rep-counter `-`/`+` buttons at 44×44.
- **Keyboard focus:** focus ring uses `--ring`. Focus is always visible; we never remove the default outline without replacing it.
- **Colour contrast:** all text passes WCAG AA against the background. Mode accents at their default usage meet AA against `--card`.
- **Motion preference:** `prefers-reduced-motion: reduce` disables all Framer Motion transitions (page transitions and hovers become instant).
- **Form labels:** every input has an associated `<Label>` or `aria-label`.

---

## 15. Mobile Design (planned)

The mobile app (Expo + React Native) will reuse the design tokens via `packages/ui-tokens`. Specifics:

- **Bottom tab bar:** 5 tabs (Today / Plan / Train / Progress / Profile), 56px tall, opaque background matching `--background`, active tab tinted with the active mode accent.
- **Large tap targets:** minimum 48×48px on mobile (larger than web's 44).
- **Haptic feedback:** light impact on timer interval beeps, medium impact on PR unlocked, success notification on workout completed.
- **Keep-screen-awake:** during an active workout, the screen does not dim. Implemented via `expo-keep-awake`.
- **Native timers:** timer runs in a foreground service on Android and a background task on iOS so audio beeps continue if the app is backgrounded briefly.
- **Charts:** React Native-compatible Recharts (or Victory Native) using the same mode accent colours.
- **Type:** Geist Sans and Geist Mono are loaded via `expo-font`. The same `text-display` and `text-stat` utilities map to equivalent `StyleSheet` rules.
