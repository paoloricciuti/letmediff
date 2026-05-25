# letmediff.it

`letmediff.it` is the SvelteKit web app for letmediff. It receives checkpoint diffs from the CLI, renders them at a shareable URL, and streams submitted feedback back to the waiting MCP server.

## Tech Stack

- SvelteKit with Svelte 5 runes mode
- SvelteKit remote functions
- Vercel adapter
- `@pierre/diffs` for diff rendering and SSR preloading
- Valibot for remote form validation

## Development

Install dependencies from the repo root:

```sh
pnpm install
```

Start the app:

```sh
pnpm --filter letmediff.it dev
```

Run the CLI against the local app:

```sh
URL=http://localhost:5173 pnpm --filter letmediff exec letmediff
```
