<script lang="ts">
	import '@fontsource/geist-sans/400.css';
	import '@fontsource/geist-sans/500.css';
	import '@fontsource/geist-sans/600.css';
	import '@fontsource/geist-sans/700.css';
	import '@fontsource/geist-mono/400.css';
	import '@fontsource/geist-mono/500.css';
	import './global.css';
	import favicon from '$lib/assets/favicon.svg';
	import { dev } from '$app/environment';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if !dev}
		<script
			defer
			src="https://umami.ricciuti.app/script.js"
			data-website-id="7be7e93b-d509-45ff-9374-e127ae10cd17"
		></script>
	{/if}
</svelte:head>

{@render children()}
