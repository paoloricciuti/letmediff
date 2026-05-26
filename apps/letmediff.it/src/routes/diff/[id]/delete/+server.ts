import { storage } from '$lib/db';

import type { RequestHandler } from './$types';

async function delete_diff(id: string) {
	await storage.removeItem(id);
	return new Response(null, { status: 204 });
}

export const POST: RequestHandler = ({ params }) => delete_diff(params.id);

export const DELETE: RequestHandler = ({ params }) => delete_diff(params.id);
