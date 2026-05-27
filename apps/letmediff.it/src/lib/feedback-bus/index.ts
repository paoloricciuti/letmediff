import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { FeedbackBus, FeedbackHandler, FeedbackMessage } from './types';

export type { FeedbackMessage } from './types';

let feedback_bus: Promise<FeedbackBus> | undefined;

function get_feedback_bus() {
	feedback_bus ??= dev
		? import('./in-memory').then(({ InMemoryFeedbackBus }) => new InMemoryFeedbackBus())
		: import('./redis').then(
				({ RedisFeedbackBus }) =>
					new RedisFeedbackBus({
						url: env.UPSTASH_REDIS_REST_URL!,
						token: env.UPSTASH_REDIS_REST_TOKEN!,
					}),
			);

	return feedback_bus;
}

export async function publish_feedback(id: string, message: FeedbackMessage) {
	const bus = await get_feedback_bus();
	return bus.publish(id, message);
}

export async function subscribe_to_feedback(id: string, handler: FeedbackHandler) {
	const bus = await get_feedback_bus();
	return bus.subscribe(id, handler);
}
