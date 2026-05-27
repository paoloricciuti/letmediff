import { form, query } from '$app/server';
import { diff_schema, storage } from '$lib/db';
import { publish_feedback } from '$lib/feedback-bus';
import { preloadPatchFile } from '@pierre/diffs/ssr';
import * as v from 'valibot';
import default_diff from './diff.json' with { type: 'json' };
import { options } from './shared_diff';
import { error } from '@sveltejs/kit';

const DEMO_ID = 'demo';

export const get_diff = query(v.string(), async (id) => {
	let diffs: v.InferInput<typeof diff_schema> | null = id === DEMO_ID ? default_diff : null;
	const string_diff = await storage.getItem(id);
	if (string_diff) {
		try {
			const validated_diff = v.parse(diff_schema, string_diff);
			diffs = validated_diff;
		} catch {
			// fallback to demo diff
		}
	}
	if (!diffs) {
		error(404, 'Diff not found'); // this will throw a 404 error if the diff is not found
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
	async ({ id, feedback, line_feedback }) => {
		if (id === DEMO_ID) {
			return { success: Math.random() < 0.5 };
		}
		const line_feedback_parsed = line_feedback ? JSON.parse(line_feedback) : [];
		const line_feedback_validated = v.safeParse(line_feedback_schema, line_feedback_parsed);
		const lines: v.InferInput<typeof line_feedback_schema> = line_feedback_validated.success
			? line_feedback_validated.output
			: [];
		const success = await publish_feedback(id, [
			feedback,
			...lines.map(
				(line) => `At line ${line.line.start}-${line.line.end} in file ${line.file}: ${line.value}`,
			),
		]);

		return { success };
	},
);
