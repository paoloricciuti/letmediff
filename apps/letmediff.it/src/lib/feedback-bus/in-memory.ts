import { FeedbackBus, type FeedbackHandler, type FeedbackMessage } from './types';

export class InMemoryFeedbackBus extends FeedbackBus {
	#listeners = new Map<string, Set<FeedbackHandler>>();

	async publish(id: string, message: FeedbackMessage) {
		const id_listeners = this.#listeners.get(id);
		if (!id_listeners || id_listeners.size === 0) {
			return false;
		}
		for (const listener of id_listeners) {
			listener(message);
		}
		return true;
	}

	async subscribe(id: string, handler: FeedbackHandler) {
		let id_listeners = this.#listeners.get(id);
		if (!id_listeners) {
			id_listeners = new Set();
			this.#listeners.set(id, id_listeners);
		}
		id_listeners.add(handler);

		return {
			unsubscribe: () => {
				const current_listeners = this.#listeners.get(id);
				if (!current_listeners) {
					return;
				}
				current_listeners.delete(handler);
				if (current_listeners.size === 0) {
					this.#listeners.delete(id);
				}
			},
		};
	}
}
