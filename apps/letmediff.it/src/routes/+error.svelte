<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const status = $derived(page.status);
	const is_not_found = $derived(status === 404);
	const title = $derived(is_not_found ? 'Review not found' : 'Review unavailable');
	const message = $derived(
		is_not_found
			? 'That review link may have expired, been mistyped, or never existed.'
			: (page.error?.message ?? 'The review could not be loaded.'),
	);
</script>

<svelte:head>
	<title>{status} · {title} · letmediff</title>
	<meta name="description" content={message} />
	<meta name="theme-color" content="oklch(12% 0.008 240)" />
</svelte:head>

<main class="page">
	<section class="panel" aria-labelledby="error-title">
		<header class="top">
			<a class="brand" href={resolve('/')} aria-label="Back to letmediff home">
				<span class="brand-mark" aria-hidden="true"></span>
				<span>letmediff</span>
			</a>
			<span class="status">{status}</span>
		</header>

		<div class="body">
			<p class="label">review error</p>
			<h1 id="error-title">{title}</h1>
			<p class="message">{message}</p>

			<div class="actions" aria-label="Recovery actions">
				<a class="primary" href={resolve('/')}>Go home</a>
				<a class="secondary" href={resolve('/diff/[id]', { id: 'demo' })}>Open demo</a>
			</div>
		</div>

		<footer class="detail" aria-label="Error detail">
			<span class="detail-key">route</span>
			<span class="detail-value">{page.url.pathname}</span>
			<span class="detail-key">state</span>
			<span class="detail-value">{is_not_found ? 'missing review' : 'load failed'}</span>
		</footer>
	</section>
</main>

<style>
	.page {
		width: min(100%, 34rem);
		margin: 0 auto;
		padding: var(--page-gutter);
	}

	.panel {
		width: 100%;
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		background: var(--panel);
		overflow: hidden;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg);
		padding: 0.8rem 0.95rem;
		border-bottom: 1px solid var(--border);
		background: var(--raised);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		color: var(--ink);
		font-weight: 600;
		letter-spacing: -0.02em;
		text-decoration: none;
	}

	.brand-mark {
		width: 0.72rem;
		height: 0.72rem;
		border: 1px solid var(--border);
		border-radius: 2px;
		background: var(--inset);
		transform: rotate(45deg);
	}

	.status,
	.label,
	.detail {
		font-family: var(--font-mono);
	}

	.status {
		color: var(--muted);
		font-size: 0.78rem;
		letter-spacing: 0.08em;
	}

	.body {
		padding: clamp(1.2rem, 5vw, 1.8rem);
	}

	.label {
		margin: 0 0 0.7rem;
		color: var(--muted);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: lowercase;
	}

	h1 {
		margin: 0;
		color: var(--ink);
		font-size: clamp(1.8rem, 7vw, 2.5rem);
		font-weight: 600;
		line-height: 1.04;
		letter-spacing: -0.035em;
	}

	.message {
		max-width: 42ch;
		margin: 0.9rem 0 0;
		color: var(--text);
		font-size: 0.98rem;
		line-height: 1.58;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin-top: 1.4rem;
	}

	.primary,
	.secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--touch-target);
		padding: 0.64rem 0.95rem;
		border-radius: var(--radius-md);
		font-size: 0.92rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			background var(--duration-fast),
			border-color var(--duration-fast),
			color var(--duration-fast);
	}

	.primary {
		background: var(--green);
		color: var(--green-ink);
	}

	.primary:hover {
		background: var(--green-hover);
	}

	.secondary {
		border: 1px solid var(--border);
		background: var(--inset);
		color: var(--text);
	}

	.secondary:hover {
		border-color: var(--quiet);
		color: var(--ink);
	}

	.primary:focus-visible,
	.secondary:focus-visible,
	.brand:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--green-focus);
	}

	.detail {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 0.35rem 0.85rem;
		padding: 0.85rem 0.95rem;
		border-top: 1px solid var(--border-soft);
		background: var(--inset);
		font-size: 0.72rem;
		line-height: 1.35;
	}

	.detail-key {
		color: var(--quiet);
	}

	.detail-value {
		min-width: 0;
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	@media (max-width: 480px) {
		.page {
			padding: var(--space-lg);
		}

		.actions {
			flex-direction: column;
		}

		.primary,
		.secondary {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.primary,
		.secondary {
			transition: none;
		}
	}
</style>
