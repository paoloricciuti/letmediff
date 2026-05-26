import { form, query } from '$app/server';
import { db } from '$lib/db';
import * as v from 'valibot';
import { controllers } from './controllers';
import { preloadPatchFile } from '@pierre/diffs/ssr';
import { error } from '@sveltejs/kit';
import { options } from './shared_diff';
import default_diff from './diff.json' with { type: 'json' };

const text_encoder = new TextEncoder();

export const get_diff = query(v.string(), async (id) => {
	const diffs = db.get(id) ?? default_diff;
	if (!diffs) {
		error(404, 'Diff not found');
	}
	const rendered_diffs = await Promise.all(
		diffs.map(async (diff) => ({
			...diff,
			diff: await preloadPatchFile({
				patch: diff.diff,
				options,
			}),
		})),
	);
	return rendered_diffs;
});

const line_feedback_schema = v.array(
	v.object({
		value: v.string(),
		line: v.object({
			start: v.number(),
			end: v.number(),
		}),
		file: v.string(),
	}),
);

export const send_feedback = form(
	v.object({
		id: v.string(),
		feedback: v.string(),
		line_feedback: v.optional(v.string()),
	}),
	({ id, feedback, line_feedback }) => {
		const line_feedback_parsed = line_feedback ? JSON.parse(line_feedback) : [];
		const line_feedback_validated = v.safeParse(line_feedback_schema, line_feedback_parsed);
		const lines: v.InferInput<typeof line_feedback_schema> = line_feedback_validated.success
			? line_feedback_validated.output
			: [];
		const id_controllers = controllers.get(id);
		for (const controller of id_controllers || []) {
			controller.enqueue(
				text_encoder.encode(
					`event: feedback\ndata: ${JSON.stringify([feedback, ...lines.map((line) => `At line ${line.line.start}-${line.line.end} in file ${line.file}: ${line.value}`)])}\n\n`,
				),
			);
		}
	},
);
