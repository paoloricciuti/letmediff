<script lang="ts">
	import { CodeView } from '@pierre/diffs';
	import { get_diff, send_feedback } from '../../diff/[id]/diff.remote';
	import { get_future_edits_sentence, options } from '../../diff/[id]/shared_diff.js';

	let { params } = $props();
	let loaded = $state(false);
	let feedback = $state('');
	const lines_feedback: string[] = $state([]);
	const diffs = $derived(await get_diff(params.id));

	const relative_time_formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	const now = Date.now();
	function relative(iso: string) {
		const then = new Date(iso).getTime();
		const diff_ms = then - now;
		const minutes = Math.round(diff_ms / 60_000);
		if (Math.abs(minutes) < 60) return relative_time_formatter.format(minutes, 'minute');
		const hours = Math.round(minutes / 60);
		if (Math.abs(hours) < 24) return relative_time_formatter.format(hours, 'hour');
		const days = Math.round(hours / 24);
		return relative_time_formatter.format(days, 'day');
	}
</script>

<svelte:head>
	<title>{params.id} · letmediff</title>
</svelte:head>

<div class="app">
	<header class="top">
		<div class="top-line">
			<p class="brand">
				<span class="brand-mark" aria-hidden="true"></span>
				letmediff
			</p>
			<span class="live"><span class="live-dot" aria-hidden="true"></span>live</span>
		</div>
		<h1>Review</h1>
		<p class="sub">
			<span class="sub-id">{params.id}</span>
			<span class="sub-sep" aria-hidden="true"></span>
			<span class="sub-count">{diffs.length} checkpoint{diffs.length === 1 ? '' : 's'}</span>
		</p>
	</header>

	<nav class="cp-rail" aria-label="Checkpoints">
		<div class="cp-rail-track">
			{#each diffs as checkpoint, i (checkpoint.created_at)}
				{@const cp_id = `cp_${String(i + 1).padStart(2, '0')}`}
				<a class="cp-pill" href="#{cp_id}">
					<span class="cp-pill-num">{String(i + 1).padStart(2, '0')}</span>
					<span class="cp-pill-name">{checkpoint.name}</span>
					<span class="cp-pill-time">{relative(checkpoint.created_at)}</span>
				</a>
			{/each}
		</div>
	</nav>

	<main class="stage">
		{#each diffs as checkpoint, i (checkpoint.created_at)}
			{@const cp_id = `cp_${String(i + 1).padStart(2, '0')}`}
			<details class="cp" id={cp_id} open={i === 0}>
				<summary>
					<span class="cp-num">{cp_id}</span>
					<span class="cp-time">{relative(checkpoint.created_at)}</span>
					<h2>{checkpoint.name}</h2>
					<span class="cp-caret" aria-hidden="true"></span>
				</summary>
				<div class="cp-body">
					<div
						class={['code-host', { loaded }]}
						{@attach (node) => {
							const instance = new CodeView({
								...options,
								onGutterUtilityClick(line) {
									// gutter affordance enabled; pinning intentionally a no-op here
									void line;
								},
								onPostRender(element, _instance, ctx) {
									const css_variable = get_future_edits_sentence(ctx.item.id, checkpoint);
									if (css_variable) {
										element.style.setProperty('--edits', css_variable);
									}
									loaded = true;
								},
							});
							instance.setup(node);
							instance.setItems(
								checkpoint.diff.map((diff_file) => ({
									id: diff_file.fileDiff.name,
									fileDiff: diff_file.fileDiff,
									type: 'diff',
								})),
							);
						}}
					></div>
					{#if !loaded}
						<div class="ssr">
							{#each checkpoint.diff as diffed (diffed.fileDiff.name)}
								<diff-view
									style:--edits={get_future_edits_sentence(diffed.fileDiff.name, checkpoint)}
								>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html `<template shadowrootmode="open">${diffed.prerenderedHTML}</template>`}
								</diff-view>
							{/each}
						</div>
					{/if}
				</div>
			</details>
		{/each}
	</main>

	<form
		class="sheet-form"
		{...send_feedback}
		onformdata={(e) => {
			e.formData.set('line_feedback', JSON.stringify(lines_feedback));
		}}
	>
		<details class="sheet">
			<summary>
				<span class="sheet-leading" aria-hidden="true">
					<span class="caret"></span>
				</span>
				<span class="sheet-prompt">
					{#if !feedback}
						<span class="sheet-hint">Send feedback to the agent</span>
					{:else}
						<span class="sheet-draft"
							>{feedback.split('\n')[0].slice(0, 64)}{feedback.length > 64 ? '…' : ''}</span
						>
					{/if}
				</span>
				<kbd class="sheet-kbd" aria-hidden="true">⌘ K</kbd>
				<span class="sheet-send" aria-hidden="true">
					<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
						<path
							d="M3 8.75a.75.75 0 0 1 .75-.75h7.69L8.97 5.53a.75.75 0 1 1 1.06-1.06l3.75 3.75a.75.75 0 0 1 0 1.06l-3.75 3.75a.75.75 0 1 1-1.06-1.06l2.47-2.47H3.75A.75.75 0 0 1 3 8.75"
							fill="currentColor"
						/>
					</svg>
				</span>
			</summary>
			<div class="sheet-body">
				<textarea
					{...send_feedback.fields.feedback.as('text')}
					bind:value={feedback}
					rows="4"
					placeholder="Tell the agent what to do next."
					autocomplete="off"
				></textarea>
				<div class="sheet-actions">
					<span class="sheet-meta">
						<span class="sheet-meta-dot" aria-hidden="true"></span>
						agent
					</span>
					<button {...send_feedback.fields.id.as('submit', params.id)} class="send-big">
						Send to agent
						<span class="send-arrow" aria-hidden="true">→</span>
					</button>
				</div>
			</div>
		</details>
	</form>
</div>

<style>
	.app {
		min-height: 100dvh;
		max-width: 56rem;
		margin: 0 auto;
		padding-bottom: 6rem;
	}

	/* ---- sticky command sheet ---- */
	.sheet-form {
		position: sticky;
		bottom: 0;
		z-index: 50;
		margin: 0;
	}
	.sheet {
		background: oklch(14% 0.01 240 / 0.78);
		backdrop-filter: saturate(160%) blur(12px);
		-webkit-backdrop-filter: saturate(160%) blur(12px);
		border-bottom: 1px solid oklch(22% 0.012 240);
	}
	.sheet[open] {
		background: oklch(15% 0.012 240 / 0.95);
	}
	.sheet summary {
		list-style: none;
		display: grid;
		grid-template-columns: max-content 1fr max-content max-content;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem max(1rem, 4vw);
		cursor: pointer;
		user-select: none;
	}
	.sheet summary::-webkit-details-marker {
		display: none;
	}
	.sheet-leading {
		width: 1.6rem;
		height: 1.6rem;
		display: grid;
		place-items: center;
		border-radius: 8px;
		background: oklch(20% 0.015 240);
		border: 1px solid oklch(26% 0.014 240);
		transition:
			background 160ms,
			border-color 160ms;
	}
	.caret {
		width: 6px;
		height: 6px;
		border-right: 1.5px solid oklch(70% 0.014 240);
		border-bottom: 1.5px solid oklch(70% 0.014 240);
		transform: rotate(-45deg) translate(1px, -1px);
		transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.sheet[open] .caret {
		transform: rotate(45deg) translate(-1px, -1px);
	}
	.sheet[open] .sheet-leading {
		background: oklch(22% 0.018 240);
		border-color: oklch(30% 0.018 240);
	}
	.sheet-prompt {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
		font-size: 0.92rem;
		color: oklch(68% 0.01 240);
		overflow: hidden;
	}
	.sheet-hint,
	.sheet-draft {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sheet-draft {
		color: oklch(90% 0.008 240);
	}
	.sheet-kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		padding: 0.22rem 0.45rem;
		border-radius: 6px;
		background: oklch(18% 0.01 240);
		border: 1px solid oklch(26% 0.014 240);
		color: oklch(60% 0.012 240);
		letter-spacing: 0.04em;
	}
	@media (max-width: 540px) {
		.sheet-kbd {
			display: none;
		}
	}
	.sheet-send {
		width: 1.95rem;
		height: 1.95rem;
		display: grid;
		place-items: center;
		border-radius: 8px;
		background: oklch(75% 0.18 165);
		color: oklch(14% 0.04 165);
		transition:
			background 160ms,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.sheet[open] .sheet-send {
		transform: rotate(90deg);
	}

	.sheet-body {
		padding: 0 max(1rem, 4vw) 1rem;
		display: grid;
		gap: 0.65rem;
	}
	textarea {
		font: inherit;
		font-size: 0.95rem;
		width: 100%;
		padding: 0.8rem 0.9rem;
		background: oklch(10% 0.008 240);
		color: oklch(95% 0.006 240);
		border: 1px solid oklch(24% 0.012 240);
		border-radius: 10px;
		resize: vertical;
		box-sizing: border-box;
	}
	textarea::placeholder {
		color: oklch(46% 0.012 240);
	}
	textarea:focus {
		outline: none;
		border-color: oklch(75% 0.18 165);
		box-shadow: 0 0 0 3px oklch(75% 0.18 165 / 0.18);
	}

	.sheet-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}
	.sheet-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: ui-monospace, monospace;
		font-size: 0.72rem;
		color: oklch(55% 0.012 240);
	}
	.sheet-meta-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: oklch(75% 0.18 165);
		box-shadow: 0 0 6px oklch(75% 0.18 165 / 0.6);
	}
	.send-big {
		font: inherit;
		font-size: 0.92rem;
		font-weight: 600;
		padding: 0.65rem 1rem;
		border-radius: 8px;
		background: oklch(75% 0.18 165);
		color: oklch(13% 0.04 165);
		border: none;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 40px;
		transition: background 160ms;
	}
	.send-big:hover {
		background: oklch(80% 0.18 165);
	}
	.send-arrow {
		transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.send-big:hover .send-arrow {
		transform: translateX(3px);
	}

	/* ---- top ---- */
	.top {
		padding: 2.5rem max(1rem, 4vw) 1.25rem;
	}
	.top-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.75rem;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: oklch(58% 0.012 240);
		margin: 0;
	}
	.brand-mark {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: conic-gradient(
			from 0deg,
			oklch(75% 0.18 165),
			oklch(70% 0.16 220),
			oklch(75% 0.18 165)
		);
	}
	.live {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-family: ui-monospace, monospace;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: oklch(75% 0.18 165);
	}
	.live-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: oklch(75% 0.18 165);
		box-shadow: 0 0 0 3px oklch(75% 0.18 165 / 0.2);
		animation: breathe 2.4s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			box-shadow: 0 0 0 6px oklch(75% 0.18 165 / 0);
		}
	}

	h1 {
		font-size: clamp(1.7rem, 5vw, 2.2rem);
		font-weight: 580;
		letter-spacing: -0.025em;
		line-height: 1.05;
		margin: 0 0 0.6rem;
		color: oklch(98% 0.005 240);
	}
	.sub {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-family: ui-monospace, monospace;
		font-size: 0.82rem;
		color: oklch(55% 0.012 240);
		margin: 0;
	}
	.sub-id {
		color: oklch(72% 0.012 240);
	}
	.sub-sep {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: oklch(38% 0.012 240);
	}

	/* ---- checkpoint rail (anchor links, no JS) ---- */
	.cp-rail {
		padding: 1rem max(1rem, 4vw) 1.5rem;
	}
	.cp-rail-track {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.cp-rail-track::-webkit-scrollbar {
		display: none;
	}
	.cp-pill {
		all: unset;
		flex: 0 0 auto;
		min-width: 12rem;
		display: grid;
		grid-template-columns: max-content 1fr;
		grid-template-rows: auto auto;
		grid-template-areas:
			'num name'
			'num time';
		column-gap: 0.65rem;
		row-gap: 0.15rem;
		padding: 0.7rem 0.85rem;
		background: oklch(15% 0.011 240);
		border: 1px solid oklch(22% 0.013 240);
		border-radius: 10px;
		cursor: pointer;
		scroll-snap-align: start;
		transition:
			background 160ms,
			border-color 160ms,
			transform 160ms;
		position: relative;
		text-decoration: none;
		color: inherit;
	}
	.cp-pill:hover {
		background: oklch(18% 0.013 240);
	}
	.cp-pill:focus-visible {
		outline: 2px solid oklch(75% 0.18 165);
		outline-offset: 2px;
	}
	.cp-pill-num {
		grid-area: num;
		align-self: center;
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		color: oklch(50% 0.012 240);
		font-variant-numeric: tabular-nums;
		padding: 0.2rem 0.4rem;
		background: oklch(11% 0.008 240);
		border-radius: 4px;
	}
	.cp-pill-name {
		grid-area: name;
		font-size: 0.9rem;
		font-weight: 540;
		color: oklch(94% 0.008 240);
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cp-pill-time {
		grid-area: time;
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		color: oklch(50% 0.012 240);
	}

	/* ---- stage ---- */
	.stage {
		padding: 0 max(1rem, 4vw);
	}

	.cp {
		margin: 0 0 1rem;
		background: oklch(14% 0.01 240);
		border: 1px solid oklch(22% 0.012 240);
		border-radius: 12px;
		overflow: hidden;
		scroll-margin-top: 5rem;
	}
	/* Highlight the checkpoint targeted by the rail anchor */
	.cp:target {
		border-color: oklch(75% 0.18 165 / 0.5);
		box-shadow: 0 0 0 3px oklch(75% 0.18 165 / 0.12);
	}
	.cp:target > summary .cp-num {
		color: oklch(82% 0.16 165);
		background: oklch(18% 0.04 165 / 0.6);
	}

	.cp > summary {
		list-style: none;
		display: grid;
		grid-template-columns: max-content max-content 1fr max-content;
		align-items: center;
		gap: 0.65rem;
		padding: 0.85rem 1rem;
		cursor: pointer;
		user-select: none;
		background: oklch(16% 0.012 240);
		border-bottom: 1px solid transparent;
		transition: border-color 160ms;
	}
	.cp > summary::-webkit-details-marker {
		display: none;
	}
	.cp[open] > summary {
		border-bottom-color: oklch(22% 0.012 240);
	}
	.cp-num {
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		color: oklch(60% 0.012 240);
		font-variant-numeric: tabular-nums;
		padding: 0.2rem 0.45rem;
		background: oklch(11% 0.008 240);
		border-radius: 4px;
		letter-spacing: 0.04em;
	}
	.cp-time {
		font-family: ui-monospace, monospace;
		font-size: 0.74rem;
		color: oklch(55% 0.012 240);
	}
	.cp-time::before {
		content: '·';
		margin-right: 0.5rem;
		color: oklch(38% 0.012 240);
	}
	.cp > summary h2 {
		font-size: 1.05rem;
		font-weight: 560;
		letter-spacing: -0.01em;
		margin: 0;
		line-height: 1.2;
		color: oklch(96% 0.006 240);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.cp-caret {
		width: 7px;
		height: 7px;
		border-right: 1.5px solid oklch(60% 0.014 240);
		border-bottom: 1.5px solid oklch(60% 0.014 240);
		transform: rotate(-45deg) translate(1px, -1px);
		transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.cp[open] > summary .cp-caret {
		transform: rotate(45deg) translate(-1px, -1px);
	}

	.cp-body {
		padding: 0;
	}

	/* loaded toggle copied from real diff page */
	.code-host:not(.loaded) {
		display: none;
	}
	.code-host.loaded {
		display: block;
	}
	.ssr {
		display: grid;
		gap: 8px;
		padding: 8px;
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
