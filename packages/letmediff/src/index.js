#!/usr/bin/env node
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { StdioTransport } from '@tmcp/transport-stdio';
import { tool } from 'tmcp/utils';
import * as v from 'valibot';
import { EventSource } from 'eventsource';
import { spawnSync } from 'node:child_process';

const WEBSITE_URL = process.env.URL ?? 'https://letmediff.com';
const text_encoder = new TextDecoder();

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

server.tool(
	{
		name: 'get_url',
		description:
			'Get the URL of the current diff. After this tool returns you MUST send it to the user and then call the `wait_for_feedback` tool.',
		outputSchema: v.object({
			url: v.string(),
			id: v.string(),
		}),
	},
	async () => {
		const diff_process = spawnSync('git', ['diff']);

		const diff = text_encoder.decode(diff_process.stdout);

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
			'Wait for the user to provide feedback on the diff. This tool should be called after sending the URL to the user. The tool will return the feedback provided by the user.',
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
