import { storage } from '$lib/db';
import { json } from '@sveltejs/kit';
import { umami } from '$lib/analytics.js';
import { dev } from '$app/environment';

export async function POST({ request }) {
	const { diff } = await request.json();
	const id = Math.random().toString(36).slice(2, 7);
	if (!dev) {
		umami.track({
			name: 'create-diff',
			data: {
				id,
			},
		});
	}
	await storage.setItem(id, JSON.stringify(diff));
	return json({
		id,
	});
}
