import { db } from '$lib/db';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
	const { diff } = await request.json();
	const id = Math.random().toString(36).slice(2, 7);
	db.set(id, diff);
	return json({
		id
	});
}
