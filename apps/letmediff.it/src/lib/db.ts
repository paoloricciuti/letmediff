import { env } from '$env/dynamic/private';
import { createStorage } from 'unstorage';
import redis from 'unstorage/drivers/upstash';
import * as v from 'valibot';

export const diff_ttl_seconds = 60 * 15;

let driver: ReturnType<typeof redis> | undefined = undefined;

if (env.UPSTASH_REDIS_REST_URL) {
	driver = redis({
		base: 'letmediff',
		url: env.UPSTASH_REDIS_REST_URL,
		token: env.UPSTASH_REDIS_REST_TOKEN,
		ttl: diff_ttl_seconds,
	});
}

export const storage = createStorage({
	driver,
});

export const diff_schema = v.array(
	v.object({
		name: v.string(),
		diff: v.string(),
		created_at: v.string(),
		description: v.optional(v.string()),
		future_edits: v.record(
			v.string(),
			v.array(
				v.object({
					name: v.string(),
					diff: v.string(),
					created_at: v.string(),
				}),
			),
		),
	}),
);
