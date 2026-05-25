import { form, query } from '$app/server';
import { db } from '$lib/db';
import * as v from 'valibot';
import { controllers } from './controllers';
import { preloadPatchFile } from '@pierre/diffs/ssr';
import { error } from '@sveltejs/kit';
import { options } from './shared_diff';

const text_encoder = new TextEncoder();

export const get_diff = query(v.string(), async (id) => {
	const diffs = db.get(id);
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

export const send_feedback = form(
	v.object({
		id: v.string(),
		feedback: v.string(),
		line_feedback: v.string(),
	}),
	({ id, feedback, line_feedback }) => {
		console.log(line_feedback);
		const id_controllers = controllers.get(id);
		for (const controller of id_controllers || []) {
			controller.enqueue(
				text_encoder.encode(
					`event: feedback\ndata: ${JSON.stringify([feedback, ...line_feedback])}\n\n`,
				),
			);
		}
	},
);
