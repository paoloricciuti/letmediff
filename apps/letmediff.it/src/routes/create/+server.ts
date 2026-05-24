import { json } from '@sveltejs/kit';

export async function POST({ request }) {
	const { diff } = await request.json();
	console.log({ diff });
	return json({
		id: Math.random().toString(36).slice(2, 7)
	});
}
