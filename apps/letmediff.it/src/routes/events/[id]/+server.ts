import { controllers } from '../../diff/[id]/controllers';

const text_encoder = new TextEncoder();

export function GET({ params: { id } }) {
	let _controller: ReadableStreamDefaultController | null = null;
	return new Response(
		new ReadableStream({
			start(controller) {
				_controller = controller;
				let set = controllers.get(id);
				if (!set) {
					set = new Set();
					controllers.set(id, set);
				}
				set.add(controller);
				// send some data to flush headers immediately
				controller.enqueue(text_encoder.encode(': connected\n\n'));
			},
			cancel() {
				const set = controllers.get(id);
				if (set) {
					set.delete(_controller!);
				}
			}
		})
	);
}
