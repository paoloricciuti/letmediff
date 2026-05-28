import { PUBLIC_UMAMI_URL, PUBLIC_UMAMI_WEBSITE_ID } from '$env/static/public';
import umami from '@umami/node';

umami.init({
	websiteId: PUBLIC_UMAMI_WEBSITE_ID,
	hostUrl: PUBLIC_UMAMI_URL,
});

export { umami };
