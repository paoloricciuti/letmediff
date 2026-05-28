import { subscribe_to_feedback, type FeedbackMessage } from '$lib/feedback-bus';
import { umami } from '$lib/analytics.js';
import { dev } from '$app/environment';

const text_encoder = new TextEncoder();

function send_feedback(controller: ReadableStreamDefaultController, message: FeedbackMessage) {
	controller.enqueue(text_encoder.encode(`event: feedback\ndata: ${JSON.stringify(message)}\n\n`));
}

export function GET({ params: { id } }) {
	let unsubscribe: (() => Promise<void> | void) | undefined;
	if (!dev) {
		umami.track({
			name: 'events-connected',
			data: {
				id,
			},
		});
	}
	return new Response(
		new ReadableStream({
			async start(controller) {
				const subscription = await subscribe_to_feedback(id, (message) => {
					send_feedback(controller, message);
				});
				unsubscribe = subscription.unsubscribe;
				// send some data to flush headers immediately
				controller.enqueue(text_encoder.encode(': connected\n\n'));
			},
			async cancel() {
				await unsubscribe?.();
			},
		}),
		{
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		},
	);
}
