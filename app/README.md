# Pink Cut — App

The Tauri + React desktop app for **Pink Cut**, a text-based video editor
inspired by [Descript](https://www.descript.com/). See `../AGENTS.md` for the
full product/architecture brief.

## Stack

- **React 19** + **TypeScript 6** + **Vite 8**
- **Tauri 2** (Rust 1.77+)
- **Tailwind CSS v4** + **shadcn/ui** (radix-nova preset, `lucide` icons)
- **bun** as the package manager and task runner

## Layout

```
src/
├── App.tsx                  # Providers (Tooltip, Toaster) + AppShell
├── main.tsx                 # React root
├── index.css                # Tailwind + design tokens (pastel palette)
├── lib/utils.ts             # `cn()` helper from shadcn
├── hooks/use-mobile.ts      # `useIsMobile()` from shadcn
├── components/
│   ├── ui/                  # shadcn-generated primitives
│   └── layout/              # AppShell + Header + Footer (3-band layout)
├── features/                # Domain features (transcription, editor, ...)
└── vite-env.d.ts
```

The 3-band layout (header / content / footer) follows the spec in
`../AGENTS.md`: iconic footer menus, header for editing actions, and the
GitHub icon as the only external exit point.

## Development

```bash
# 1. Install dependencies (one-time)
bun install

# 2. Run the desktop app (Vite + Tauri together)
bun tauri dev

# 3. Frontend only (no Tauri window)
bun dev

# 4. Type-check + build the frontend
bun run build
```

The Tauri dev window will hot-reload on any change under `src/`. Rust
changes trigger a recompile of the Tauri shell.

## Adding shadcn components

```bash
bunx shadcn@latest add <component> -y
```

Components land in `src/components/ui/` and are free to edit — the whole
point of shadcn is the source stays in the project.

## Design tokens

Pastel palette lives in `src/index.css` inside `@theme { ... }`. Override
these `--color-*` and `--radius-*` variables to retune the look. See
`../AGENTS.md` for the bujo/studygram direction.
