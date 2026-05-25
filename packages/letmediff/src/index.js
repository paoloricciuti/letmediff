#!/usr/bin/env node
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { StdioTransport } from '@tmcp/transport-stdio';
import { EventSource } from 'eventsource';
import { McpServer } from 'tmcp';
import { tool } from 'tmcp/utils';
import * as v from 'valibot';
import { create_git_checkpoint_store } from './git.js';

const WEBSITE_URL = process.env.URL ?? 'https://letmediff.com';

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

const git = await create_git_checkpoint_store(process.cwd());

server.tool(
	{
		name: 'create_checkpoint',
		description:
			"Creates a checkpoint to help the review process. Each checkpoint changes will be displayed as a separate section so create a checkpoint whenever you think it's necessary to split the review in different parts. You can create as many checkpoints as you want and they will be displayed in the order they were created.",
		schema: v.object({
			name: v.string(),
		}),
	},
	async ({ name }) => {
		await git.store_checkpoint(name);
		return tool.text('Checkpoint created successfully');
	},
);

server.tool(
	{
		name: 'get_url',
		description:
			'Invoke this when the users ask you to review the code to get the URL of the currents diff. After this tool returns you MUST send it to the user and then call the `wait_for_feedback` tool.',
		outputSchema: v.object({
			url: v.string(),
			id: v.string(),
		}),
	},
	async () => {
		await git.merge_checkpoint_if_changed();
		const diff = git.read_checkpoints();

		const result = await fetch(`${WEBSITE_URL}/create`, {
			method: 'POST',
			body: JSON.stringify({ diff }),
		}).then((res) => res.json());

		const { id } = v.parse(created_schema, result);

		const url = new URL(WEBSITE_URL);
		/**
		 * @type {(results:string[])=>void}
		 */
		let resolve_feedback;

		const feedback_promise = new Promise((resolve) => {
			resolve_feedback = resolve;
		});
		feedbacks.set(id, feedback_promise);
		const event_url = new URL(url);
		event_url.pathname = `/events/${id}`;
		/**
		 * @type {EventSource | null}
		 */
		let event_source = new EventSource(event_url.toString());
		event_source.addEventListener('feedback', ({ data }) => {
			resolve_feedback(JSON.parse(data));
			event_source?.close();
			event_source = null;
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
		const feedback = await feedback_promise;
		return tool.structured({
			feedback,
		});
	},
);

const transport = new StdioTransport(server);
transport.listen();
