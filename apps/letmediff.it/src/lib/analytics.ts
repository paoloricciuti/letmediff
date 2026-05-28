import { PUBLIC_UMAMI_URL, PUBLIC_UMAMI_WEBSITE_ID } from '$env/static/public';
import { Umami } from '@umami/node';

export const umami = new Umami();

umami.init({
	websiteId: PUBLIC_UMAMI_WEBSITE_ID,
	hostUrl: PUBLIC_UMAMI_URL,
});
