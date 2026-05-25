# letmediff

`letmediff` is a review handoff tool for agent-driven coding sessions.

The CLI runs as an MCP server inside a local repository, captures the current worktree diff, and posts it to the web app. The web app renders the diff at a shareable URL and sends reviewer feedback back to the MCP client over server-sent events.

## Workspace

This repository is a pnpm monorepo.

- `packages/letmediff` contains the `letmediff` MCP CLI.
- `apps/letmediff.it` contains the SvelteKit app that stores, renders, and streams diff feedback.

## Requirements

- Node.js compatible with the package dependencies
- pnpm `^11.2.2`

## Install

```sh
pnpm install
```

## Local Development

Run the app:

```sh
pnpm --filter letmediff.it dev
```

Run the MCP server against the local app by setting `URL`:

```sh
URL=http://localhost:5173 pnpm --filter letmediff exec letmediff
```

When used by an MCP-compatible agent, the server exposes tools to create named checkpoints, create a hosted diff URL, and wait for reviewer feedback.

## How It Works

1. The MCP server snapshots the repository when it starts.
2. The agent can create named checkpoints while it works.
3. When a review URL is requested, the server sends the collected checkpoint diffs to the app.
4. The app renders `/diff/[id]` and keeps an `/events/[id]` SSE connection open.
5. Submitted feedback is streamed back to the MCP server so the agent can continue from the review notes.

## Package READMEs

- CLI: [`packages/letmediff/README.md`](packages/letmediff/README.md)
- App: [`apps/letmediff.it/README.md`](apps/letmediff.it/README.md)
