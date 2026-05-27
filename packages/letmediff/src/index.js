#!/usr/bin/env node
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { StdioTransport } from '@tmcp/transport-stdio';
import { EventSource } from 'eventsource';
import { McpServer } from 'tmcp';
import { tool } from 'tmcp/utils';
import * as v from 'valibot';
import { create_git_checkpoint_store } from './git.js';

const WEBSITE_URL = process.env.URL ?? 'https://letmediff.it';

const created_schema = v.object({
	id: v.string(),
});

const server = new McpServer(
	{
		name: 'letmediff',
		version: '0.0.1',
	},
	{
		adapter: new ValibotJsonSchemaAdapter(),
		capabilities: {
			tools: {},
		},
	},
);

/**
 * @type {Map<string, Promise<string[]>>}
 */
const feedbacks = new Map();

const git_promise = create_git_checkpoint_store(process.cwd());

server.tool(
	{
		name: 'get_url',
		description:
			'Invoke this when the users ask you to review the code to get the review URL. You can include multiple steps each should be used to guide the user through the best review possible. After this tool returns you MUST send it to the user and then call the `wait_for_feedback` tool.',
		schema: v.object({
			steps: v.pipe(
				v.array(
					v.object({
						name: v.string(),
						description: v.string(),
						files: v.pipe(v.array(v.string()), v.minLength(1)),
					}),
				),
				v.minLength(1),
			),
		}),
		outputSchema: v.object({
			url: v.string(),
			id: v.string(),
		}),
	},
	async ({ steps }) => {
		const git = await git_promise;
		const diff = await git.store_checkpoints(steps);

		if (diff.length === 0) {
			return tool.error(
				'No checkpoints to review. Create at least one checkpoint with `create_checkpoint` before requesting a review URL.',
			);
		}

		let response;
		try {
			response = await fetch(`${WEBSITE_URL}/create`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ diff }),
			});
		} catch (error) {
			return tool.error(
				`Failed to reach letmediff at ${WEBSITE_URL}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		if (!response.ok) {
			return tool.error(
				`letmediff responded with ${response.status} ${response.statusText}`,
			);
		}

		const result = await response.json();
		const parsed = v.safeParse(created_schema, result);
		if (!parsed.success) {
			return tool.error(
				'Unexpected response from letmediff: missing review id.',
			);
		}
		const { id } = parsed.output;

		const url = new URL(WEBSITE_URL);
		/**
		 * @type {(results:string[])=>void}
		 */
		let resolve_feedback;
		/**
		 * @type {(reason:Error)=>void}
		 */
		let reject_feedback;

		const feedback_promise = /** @type {Promise<string[]>} */ (
			new Promise((resolve, reject) => {
				resolve_feedback = resolve;
				reject_feedback = reject;
			})
		);
		feedbacks.set(id, feedback_promise);
		const event_url = new URL(url);
		event_url.pathname = `/events/${id}`;
		/**
		 * @type {EventSource | null}
		 */
		let event_source = new EventSource(event_url.toString());
		const cleanup = () => {
			event_source?.close();
			event_source = null;
		};
		event_source.addEventListener('feedback', ({ data }) => {
			try {
				resolve_feedback(JSON.parse(data));
			} catch (error) {
				reject_feedback(
					error instanceof Error ? error : new Error(String(error)),
				);
			}
			cleanup();
		});
		event_source.addEventListener('error', () => {
			// EventSource attempts to reconnect on its own; only abort if it gave up.
			if (event_source?.readyState === EventSource.CLOSED) {
				reject_feedback(
					new Error('Lost connection to letmediff feedback stream'),
				);
				cleanup();
			}
		});
		url.pathname = `/diff/${id}`;
		return tool.structured({
			url: url.toString(),
			id,
		});
	},
);

server.tool(
	{
		name: 'wait_for_feedback',
		description:
			"Wait for the user to provide feedback on the diff. The tool will return the feedback provided by the user so after it returns assume that's the user telling you what to do and continue as if it was a message in the chat. If the tool times out invoke it again unless the user told you not to do it.",
		schema: v.object({
			id: v.string(),
		}),
		outputSchema: v.object({
			feedback: v.array(v.string()),
		}),
	},
	async ({ id }) => {
		const feedback_promise = feedbacks.get(id);
		if (!feedback_promise) {
			return tool.error(
				"No feedback found for the given id, please invoke the 'get_url' tool first to get a valid id.",
			);
		}
		try {
			const feedback = await feedback_promise;
			return tool.structured({
				feedback,
			});
		} catch (error) {
			return tool.error(error instanceof Error ? error.message : String(error));
		} finally {
			feedbacks.delete(id);
		}
	},
);

const transport = new StdioTransport(server);
transport.listen();
