import { Redis } from '@upstash/redis';
import { FeedbackBus, type FeedbackHandler, type FeedbackMessage } from './types';

export class RedisFeedbackBus extends FeedbackBus {
	#redis: Redis;

	constructor(config: { url: string; token: string }) {
		super();
		this.#redis = new Redis(config);
	}

	async publish(id: string, message: FeedbackMessage) {
		const listeners_count = await this.#redis.publish(
			this.#get_channel(id),
			JSON.stringify(message),
		);
		return listeners_count > 0;
	}

	async subscribe(id: string, handler: FeedbackHandler) {
		const subscription = this.#redis.subscribe<string>(this.#get_channel(id));
		subscription.on('message', ({ message }) => {
			try {
				handler(JSON.parse(message));
			} catch {
				// Ignore malformed pub/sub messages for this channel.
			}
		});

		return {
			async unsubscribe() {
				subscription.removeAllListeners();
				await subscription.unsubscribe();
			},
		};
	}

	#get_channel(id: string) {
		return `letmediff:feedback:${id}`;
	}
}
