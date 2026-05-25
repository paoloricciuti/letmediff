# letmediff CLI

`letmediff` is an MCP server that lets an agent share its current code diff for review and receive feedback from the reviewer without leaving the coding session.

It snapshots the repository where it is started, tracks named checkpoints, uploads the checkpoint diffs to the letmediff web app, and waits for feedback over server-sent events.

## Install

From the published package:

```sh
pnpm dlx letmediff
```

From this workspace:

```sh
pnpm --filter letmediff exec letmediff
```

## MCP Usage

Configure your MCP client to run `letmediff` in the repository you want reviewed.

Example command:

```sh
letmediff
```

For local app development, point the CLI at the local SvelteKit server:

```sh
URL=http://localhost:5173 letmediff
```

If `URL` is not set, the CLI posts diffs to `https://letmediff.com`.

## Tools

The server exposes four MCP tools.

- `create_checkpoint`: stores the diff since the previous snapshot under a reviewer-friendly name.
- `reset_review`: clears all checkpoints and restarts the review from the current working tree. Destructive.
- `get_url`: uploads the collected checkpoints and returns the shareable `/diff/[id]` URL.
- `wait_for_feedback`: waits for feedback submitted from the web app and returns it to the agent.

## Review Flow

1. Start the MCP server from the repository being edited.
2. Ask the agent to create checkpoints when a change should appear as a separate review section.
3. Ask the agent for the review URL.
4. Open the URL, review the rendered diff, and submit feedback.
5. The agent receives the feedback through `wait_for_feedback` and can continue working.

## Development

Install dependencies from the repo root:

```sh
pnpm install
```

Run tests:

```sh
pnpm --filter letmediff test
```

The CLI entry point is `src/index.js`. Git snapshotting and checkpoint diff generation live in `src/git.js`.

## Environment

- `URL`: base URL of the letmediff app. Defaults to `https://letmediff.com`.

## Notes

- The server uses stdio transport, so normal stdout is reserved for MCP communication.
- It snapshots the current working directory at startup, excluding `.git`.
- Checkpoints are kept in memory for the life of the MCP process.
