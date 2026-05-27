<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const status = $derived(page.status);
	const is_not_found = $derived(status === 404);
	const title = $derived(is_not_found ? 'Review not found' : 'Review unavailable');
	const message = $derived(
		is_not_found
			? 'That review link may have expired, been mistyped, or never existed. Reviews self-destruct 15 minutes after the agent posts them.'
			: (page.error?.message ?? 'The review could not be loaded.'),
	);
	const state_label = $derived(is_not_found ? 'missing review' : 'load failed');
	const pathname = $derived(page.url.pathname);
</script>

<svelte:head>
	<title>{status} · {title} · letmediff</title>
	<meta name="description" content={message} />
	<meta name="theme-color" content="oklch(12% 0.008 240)" />
</svelte:head>

<div class="page">
	<header class="bar">
		<div class="bar-left">
			<span class="mark" aria-hidden="true">
				<svg
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M5 7h6M5 12h10M5 17h4" stroke-linecap="square" />
					<path d="M15 17l3 3 4-5" stroke-linecap="square" stroke-linejoin="round" />
				</svg>
			</span>
			<span class="mark-text">letmediff</span>
			<span class="bar-sep" aria-hidden="true">/</span>
			<span class="bar-meta">session terminated</span>
		</div>
		<div class="bar-right">
			<span class="bar-dot" aria-hidden="true"></span>
			<span class="bar-meta">offline · {status}</span>
		</div>
	</header>

	<main class="main">
		<section class="console" aria-labelledby="error-title">
		<header class="console-head">
			<div class="head-left">
				<span class="dead-dot" aria-hidden="true"></span>
				<span class="head-label">review session</span>
				<span class="head-sep" aria-hidden="true">/</span>
				<span class="head-url" title={pathname}>{pathname}</span>
			</div>
			<span class="head-status">{status}</span>
		</header>

		<div class="trace" aria-hidden="true">
			<div class="trace-line">
				<span class="trace-time">00:00</span>
				<span class="trace-tag tag-ok">resolve</span>
				<span class="trace-text">opening review at <code>{pathname}</code></span>
			</div>
			<div class="trace-line">
				<span class="trace-time">00:00</span>
				<span class="trace-tag tag-ok">fetch</span>
				<span class="trace-text">looking up checkpoints</span>
			</div>
			<div class="trace-line trace-fail">
				<span class="trace-time">00:01</span>
				<span class="trace-tag tag-fail">{status}</span>
				<span class="trace-text">{state_label}</span>
			</div>
			<div class="trace-line trace-end">
				<span class="trace-time">00:01</span>
				<span class="trace-tag tag-end">abort</span>
				<span class="trace-text">connection closed</span>
			</div>
		</div>

		<div class="body">
			<h1 id="error-title">{title}</h1>
			<p class="message">{message}</p>

			<div class="actions">
				<a class="primary" href={resolve('/')}>
					<span>Take me home</span>
					<svg
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						aria-hidden="true"
					>
						<path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="square" stroke-linejoin="round" />
					</svg>
				</a>
				<a class="secondary" href={resolve('/diff/[id]', { id: 'demo' })}>Open the demo</a>
			</div>
		</div>
		</section>
	</main>

	<footer class="foot">
		<span class="foot-mark">letmediff</span>
		<span class="foot-meta">v0.1 · made for agents that wait politely</span>
		<a class="foot-link" href="https://github.com/paoloricciuti/letmediff">github</a>
	</footer>
</div>

<style>
	.page {
		min-height: 100vh;
		max-width: 1280px;
		margin: 0 auto;
		padding: 0 clamp(1rem, 3.2vw, 2.4rem);
		display: flex;
		flex-direction: column;
	}

	.main {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(2rem, 6vw, 4rem) 0;
	}

	/* ---------- bar (matches landing) ---------- */
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 0;
		border-bottom: 1px solid var(--border-soft);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		color: var(--muted);
	}
	.bar-left,
	.bar-right {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
	}
	.mark {
		color: var(--ink);
		display: inline-flex;
		flex: 0 0 auto;
	}
	.mark-text {
		font-family: var(--font-sans);
		color: var(--ink);
		font-weight: 600;
		letter-spacing: -0.02em;
		font-size: 0.95rem;
	}
	.bar-sep {
		color: var(--quiet);
	}
	.bar-meta {
		text-transform: lowercase;
	}
	.bar-right .bar-meta {
		color: var(--del);
	}
	.bar-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--del);
		box-shadow: 0 0 0 4px oklch(72% 0.15 25 / 0.14);
		flex: 0 0 auto;
	}

	/* ---------- foot (matches landing) ---------- */
	.foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 1.4rem 0;
		border-top: 1px solid var(--border-soft);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--muted);
		letter-spacing: 0.04em;
		flex-wrap: wrap;
	}
	.foot-mark {
		font-family: var(--font-sans);
		color: var(--ink);
		font-weight: 600;
		letter-spacing: -0.02em;
		font-size: 0.9rem;
	}
	.foot-link {
		color: var(--text);
		text-decoration: none;
		border-bottom: 1px solid var(--border);
		padding-bottom: 1px;
	}
	.foot-link:hover {
		color: var(--green);
		border-color: var(--green);
	}

	.console {
		width: min(100%, 38rem);
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		overflow: hidden;
		box-shadow: 0 30px 60px -34px oklch(0% 0 0 / 0.55);
		display: flex;
		flex-direction: column;
	}

	/* ---------- console head ---------- */
	.console-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		padding: 0.7rem 0.9rem;
		background: var(--raised);
		border-bottom: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--muted);
		min-width: 0;
	}
	.head-left {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		flex: 1;
	}
	.dead-dot {
		flex: 0 0 auto;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--del);
		box-shadow: 0 0 0 4px oklch(72% 0.15 25 / 0.14);
	}
	.head-label {
		letter-spacing: 0.08em;
		text-transform: lowercase;
		flex: 0 0 auto;
	}
	.head-sep {
		color: var(--quiet);
		flex: 0 0 auto;
	}
	.head-url {
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.head-status {
		flex: 0 0 auto;
		color: var(--del);
		font-weight: 500;
		letter-spacing: 0.06em;
	}

	/* ---------- trace ---------- */
	.trace {
		padding: 0.55rem 0;
		background: var(--inset);
		border-bottom: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 0.74rem;
		line-height: 1.55;
		overflow-x: auto;
	}
	.trace-line {
		display: grid;
		grid-template-columns: 3.2rem 4rem 1fr;
		gap: 0.7rem;
		align-items: baseline;
		padding: 0.15rem 0.95rem;
		color: var(--muted);
	}
	.trace-time {
		color: var(--quiet);
	}
	.trace-tag {
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: lowercase;
		padding: 0.08rem 0.4rem;
		border-radius: var(--radius-xs);
		text-align: center;
		justify-self: start;
		min-width: 2.8rem;
	}
	.tag-ok {
		color: var(--muted);
		background: oklch(18% 0.012 240);
		border: 1px solid var(--border-soft);
	}
	.tag-fail {
		color: var(--del);
		background: oklch(22% 0.06 25 / 0.4);
		border: 1px solid oklch(40% 0.1 25 / 0.5);
	}
	.tag-end {
		color: var(--quiet);
		background: transparent;
		border: 1px solid var(--border-soft);
	}
	.trace-text {
		color: var(--text);
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.trace-text code {
		font-family: inherit;
		color: var(--ink);
	}
	.trace-fail .trace-text {
		color: var(--del);
	}
	.trace-end .trace-text {
		color: var(--muted);
	}

	/* ---------- body ---------- */
	.body {
		padding: clamp(1.3rem, 4vw, 1.8rem);
	}
	h1 {
		margin: 0;
		color: var(--ink);
		font-size: clamp(1.6rem, 5.4vw, 2.1rem);
		font-weight: 600;
		line-height: 1.08;
		letter-spacing: -0.028em;
	}
	.message {
		max-width: 50ch;
		margin: 0.85rem 0 0;
		color: var(--text);
		font-size: 0.98rem;
		line-height: 1.6;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin-top: 1.6rem;
	}
	.primary,
	.secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: var(--touch-target);
		padding: 0.66rem 1rem;
		border-radius: var(--radius-md);
		font-size: 0.92rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			background var(--duration-med) var(--ease-out-quart),
			border-color var(--duration-med) var(--ease-out-quart),
			color var(--duration-med) var(--ease-out-quart);
	}
	.primary {
		background: var(--green);
		color: var(--green-ink);
	}
	.primary svg {
		transition: transform 240ms var(--ease-out-quart);
	}
	.primary:hover {
		background: var(--green-hover);
	}
	.primary:hover svg {
		transform: translateX(3px);
	}
	.secondary {
		border: 1px solid var(--border);
		background: var(--inset);
		color: var(--text);
		font-weight: 500;
	}
	.secondary:hover {
		border-color: var(--quiet);
		color: var(--ink);
	}
	.primary:focus-visible,
	.secondary:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--green-focus);
	}

	@media (max-width: 520px) {
		.bar-meta {
			font-size: 0.66rem;
		}
		.foot-meta {
			display: none;
		}
		.console-head {
			font-size: 0.66rem;
		}
		.head-label {
			display: none;
		}
		.trace {
			font-size: 0.7rem;
		}
		.trace-line {
			grid-template-columns: 2.4rem max-content 1fr;
			gap: 0.5rem;
			padding: 0.18rem 0.75rem;
		}
		.trace-tag {
			min-width: 0;
			padding: 0.06rem 0.34rem;
			font-size: 0.6rem;
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
		.secondary,
		.primary svg {
			transition: none;
		}
	}
</style>
