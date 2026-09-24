# Monochrome chat design system

## Goals & principles

- **Strict light-only monochrome** (neutral grays, near-black text, white surfaces). No accent colors.
- **Foundation = prompt-kit** (shadcn-based, AI SDK-compatible) + existing shadcn primitives. Install via `pnpm dlx shadcn@latest add "https://prompt-kit.com/c/<component>.json"`.
- **Reuse over rebuild**. Establish a thin design-system layer; compose primitives instead of bespoke one-offs.
- **Preserve the backend contract**: parts-based messages, camelCase citation fields, 5 pipeline stages, citations arriving after text. (See d39a120a for the API research, da78ef4c for the frontend baseline.)

## Layout target (industry-standard 3-zone shell)

```
┌────────────────────────────────────────────────────────────────────────┐
│ App shell - full viewport                                              │
│ ┌──────────────────────┬───────────────────────┬─────────────────────┐ │
│ │ Collapsible sidebar  │ Main column           │ Source panel        │ │
│ │ (threads + user menu)│ (max-w-768px stream)  │ (slide-in on cite)  │ │
│ └──────────────────────┴───────────────────────┴─────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

## 7 To-dos

- [x] **1. Theme foundation cleanup**
  Consolidate `index.css` to single monochrome OKLCH token set; remove `#root` width constraint, purple/blue accents, marketing typography; wire Geist sans+mono; delete dead `App.css`; fix `index.html` title.

- [x] **2. Install prompt-kit components (message, prompt-input, markdown, code-block, chat-container, scroll-button, loader, prompt-suggestion, source) and shadcn primitives (dropdown-menu, avatar, badge, alert, hover-card)**
  Configured all primitives with strict monochrome styling, CVA variants, and full TypeScript support without interactive CLI overwrite halts. 

- [x] **3. Design-system conventions**
  Establish token-only styling, CVA variants, and shared composed components (`ThreadSidebar`, `CitationChip`, `SourcePassagePanel`, `StreamingIndicator`).

- [x] **4. 3-Zone Shell Layout**
  Build collapsible desktop sidebar with `Ctrl+B` keyboard shortcut, `localStorage` persistence, and floating expand trigger.

- [x] **5. Chronological thread grouping**
  Organize thread history into *Today*, *Yesterday*, *Previous 7 Days*, and *Older* with rename and delete dropdown actions.

- [x] **6. Citations & Grounding Trust UI**
  In-text hover preview tooltips for citations (`[1]`, `[2]`), tabbed source passage panel (Verified Excerpt + Filing Details), and copy excerpt feedback.

- [x] **7. Streaming feedback stepper**
  Multi-stage pipeline indicator reflecting active query stages (extracting keywords -> searching filings -> grounding validation).
