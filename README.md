# Contact App

Contact App is a local-first relationship graph built with React, TypeScript, Vite, and Dexie.

It lets you:

1. Add people and their notes, interactions, socials, tags, and timeline events.
2. Visualize relationships in an interactive force-directed canvas.
3. Filter by tags/events and focus specific people.
4. Import and export JSON so data can move between machines.

## How The App Works

### Data Model

The app stores these entities in IndexedDB via Dexie:

1. `people`
2. `relationships`
3. `tags`
4. `events`

People are the main nodes. Tag and event nodes are auxiliary nodes linked to people.

### Graph Interaction

1. Click a person node to select it and auto-zoom the canvas to that node.
2. Click a tag/event node to highlight connected people.
3. Use Find person to jump to and zoom on someone.
4. Use Clear to remove active tag/event filters.
5. Use zoom buttons and recenter from graph controls.
6. Drag nodes to reposition them. Right-click a dragged node to release its lock.

### Sidebar Import and Export

In the left sidebar:

1. Add JSON imports a JSON file.
2. Export People exports only people as a portable JSON file.
3. Export Backup exports people, relationships, tags, and events.

This makes the app portable even when deployed as static hosting.

## Run Locally

### Requirements

1. Node.js 18+ (Node.js 20 recommended)
2. npm

### Steps

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open the printed local URL (typically `http://localhost:5173`).

## AI Agent Setup (Gemini)

The app includes an `AI Agent (Gemini)` panel in the left sidebar for simple data changes.

1. Create a file named `.env.local` in the project root.
2. Add your Google AI Studio key:

```bash
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

3. Restart the dev server after changing env values.

Notes:

1. `VITE_` env variables are exposed to the browser bundle in Vite.
2. For production, move Gemini calls behind a backend endpoint if you need to keep keys private.

### Production Build

1. Build:

```bash
npm run build
```

2. Preview build locally:

```bash
npm run preview
```

## Using It On Any PC

users can still keep personal data local:

1. Use the app in the browser.
2. Import their own JSON file from sidebar.
3. Work normally.
4. Export People or Export Backup when needed.
5. Import that file on another PC/browser to continue.

Note: Data is stored in each browser's local IndexedDB. Clearing site data removes local records unless exported first.

## JSON Notes

Supported import shapes:

1. Array of people
2. Object with `people` array
3. Full backup object with `people`, optional `relationships`, `tags`, and `events`

For best portability across machines, use Export Backup.
