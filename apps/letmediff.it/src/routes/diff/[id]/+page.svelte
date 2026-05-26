<script lang="ts">
	import LineFeedback from '$lib/LineFeedback.svelte';
	import { CodeView, type CodeViewFileItem, type LineAnnotation } from '@pierre/diffs';
	import { mount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { get_diff, send_feedback } from '../../diff/[id]/diff.remote';
	import { get_future_edits_sentence, options } from '../../diff/[id]/shared_diff.js';

	let { params } = $props();
	let feedback = $state('');
	const lines_feedback = new SvelteMap<
		LineAnnotation<unknown>,
		{ value: string; line: { start: number; end: number }; file: string }
	>();
	const diffs = $derived(await get_diff(params.id));
	let loaded = $derived.by(() => {
		let arr = $state(Array(diffs.length).fill(false));
		return arr;
	});

	let details_open = $derived.by(() => {
		let arr = $state(Array(diffs.length).fill(false));
		arr[0] = true; // open first checkpoint by default
		return arr;
	});

	let form_open = $state(false);
	let details_form: HTMLDetailsElement;

	const relative_time_formatter = new Intl.RelativeTimeFormat('en', {
		numeric: 'auto',
		style: 'short',
	});
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
		<p class="ttl-note">The diff is only stored for 15 minutes max.</p>
	</header>

	<nav class="cp-rail" aria-label="Checkpoints">
		<div class="cp-rail-track">
			{#each diffs as checkpoint, i (checkpoint.created_at)}
				{@const cp_id = `cp_${String(i + 1).padStart(2, '0')}`}
				<a
					onclick={() => {
						details_open[i] = true;
					}}
					class="cp-pill"
					href="#{cp_id}"
				>
					<span class="cp-pill-num">{String(i + 1).padStart(2, '0')}</span>
					<span class="cp-pill-name">{checkpoint.name}</span>
					<span class="cp-pill-time">{relative(checkpoint.created_at)}</span>
				</a>
			{/each}
		</div>
	</nav>

	<main class="stage">
		{#each diffs as checkpoint, i (checkpoint.created_at)}
			{@const id = `${String(i + 1).padStart(2, '0')}`}
			{@const cp_id = `cp_${id}`}
			<details class="cp" id={cp_id} bind:open={details_open[i]}>
				<summary>
					<span class="cp-num">{cp_id}</span>
					<span class="cp-time">{relative(checkpoint.created_at)}</span>
					<h2>{checkpoint.name}</h2>
					<span class="cp-caret" aria-hidden="true"></span>
					{#if checkpoint.description}
						<p class="cp-desc">{checkpoint.description}</p>
					{/if}
				</summary>
				<div class="cp-body">
					<div
						class={['code-host', { loaded: loaded[i] }]}
						{@attach (node) => {
							const instance = new CodeView<{
								id: string;
								line: { start: number; end: number };
								item: CodeViewFileItem;
							}>({
								...options,
								renderAnnotation(annotation) {
									const line = annotation.metadata.line;
									instance.clearSelectedLines();
									const div = document.createElement('div');
									const line_feedback = {
										value: '',
										line,
										file: annotation.metadata.item.id,
									};
									lines_feedback.set(annotation, line_feedback);

									mount(LineFeedback, {
										target: div,
										props: {
											get value() {
												return line_feedback?.value ?? '';
											},
											set value(v) {
												line_feedback.value = v;
											},
											line,
											ondelete() {
												const item = instance.getItem(annotation.metadata.item.id);
												if (!item) return;
												// @ts-expect-error dunno
												instance.updateItem({
													...item,
													version: (item.version ?? 0) + 1, // force re-render of the line without the deleted annotation
													annotations: (item.annotations ?? []).filter(
														(a) => a.metadata.id !== annotation.metadata.id,
													),
												});
											},
										},
									});
									return div;
								},
								onGutterUtilityClick(line, ctx) {
									console.log(line);
									instance.updateItem({
										...ctx.item,
										version: (ctx.item.version ?? 0) + 1, // force re-render of the line with the new annotation
										annotations: [
											// @ts-expect-error dunno
											...(ctx.item.annotations ?? []),
											// @ts-expect-error dunno
											{
												lineNumber: line.end,
												side: line.side,
												metadata: {
													id: Math.random().toString(36).slice(2),
													line: { start: line.start, end: line.end },
													item: ctx.item as never,
												},
											},
										],
									});
									instance.render();
									// gutter affordance enabled; pinning intentionally a no-op here
									void line;
								},
								onPostRender(element, _instance, ctx) {
									const css_variable = get_future_edits_sentence(ctx.item.id, checkpoint);
									if (css_variable) {
										element.style.setProperty('--edits', css_variable);
									}
									loaded[i] = true;
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
					{#if !loaded[i]}
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
		<div
			{@attach (node) => {
				const intersection = new IntersectionObserver(
					([entry]) => {
						if (details_form.open && !form_open) return;
						form_open = entry.isIntersecting;
					},
					{
						threshold: 1,
					},
				);
				intersection.observe(node);
				return () => {
					intersection.disconnect();
				};
			}}
		></div>
	</main>

	<form
		class="sheet-form"
		{...send_feedback}
		onformdata={(e) => {
			e.formData.set('line_feedback', JSON.stringify(Array.from(lines_feedback.values())));
		}}
	>
		<details bind:this={details_form} open={form_open} class="sheet">
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
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		grid-template-columns: 100%;
	}

	/* ---- sticky command sheet ---- */
	.sheet-form {
		position: sticky;
		bottom: 0;
		z-index: 50;
		margin: 0;
		margin-top: auto;
	}
	.sheet {
		background: var(--sheet-scrim);
		backdrop-filter: saturate(160%) blur(12px);
		-webkit-backdrop-filter: saturate(160%) blur(12px);
		border-bottom: 1px solid var(--border);
	}
	.sheet[open] {
		background: linear-gradient(90deg, var(--canvas) 5%, var(--sheet-open), var(--canvas) 95%);
	}
	.sheet summary {
		list-style: none;
		display: grid;
		grid-template-columns: max-content 1fr max-content max-content;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md) var(--page-gutter);
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
		border-radius: var(--radius-md);
		background: var(--control-raised);
		border: 1px solid var(--control-border);
		transition:
			background var(--duration-fast),
			border-color var(--duration-fast);
	}
	.caret {
		width: 6px;
		height: 6px;
		border-right: 1.5px solid var(--muted-bright);
		border-bottom: 1.5px solid var(--muted-bright);
		transform: rotate(-45deg) translate(1px, -1px);
		transition: transform var(--duration-med) var(--ease-out-quart);
	}
	.sheet[open] .caret {
		transform: rotate(45deg) translate(-1px, -1px);
	}
	.sheet[open] .sheet-leading {
		background: var(--control-raised-hover);
		border-color: var(--control-border-hover);
	}
	.sheet-prompt {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
		font-size: 0.92rem;
		color: var(--muted-mid);
		overflow: hidden;
	}
	.sheet-hint,
	.sheet-draft {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sheet-draft {
		color: var(--text-soft);
	}
	.sheet-kbd {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		padding: 0.22rem 0.45rem;
		border-radius: var(--radius-sm);
		background: var(--control);
		border: 1px solid var(--control-border);
		color: var(--muted-mid);
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
		border-radius: var(--radius-md);
		background: var(--green);
		color: var(--green-ink);
		transition:
			background var(--duration-fast),
			transform 220ms var(--ease-out-quart);
	}
	.sheet[open] .sheet-send {
		transform: rotate(90deg);
	}

	.sheet-body {
		padding: 0 var(--page-gutter) var(--space-lg);
		display: grid;
		gap: 0.65rem;
	}
	textarea {
		font: inherit;
		font-size: 0.95rem;
		width: 100%;
		padding: 0.8rem 0.9rem;
		background: var(--inset);
		color: var(--text-bright);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		resize: vertical;
		box-sizing: border-box;
	}
	textarea::placeholder {
		color: var(--quiet-bright);
	}
	textarea:focus {
		outline: none;
		border-color: var(--green);
		box-shadow: 0 0 0 3px var(--green-focus);
	}

	.sheet-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		margin-top: var(--space-xs);
	}
	.sheet-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--muted);
	}
	.sheet-meta-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--green);
		box-shadow: 0 0 6px var(--green-glow);
	}
	.send-big {
		font: inherit;
		font-size: 0.92rem;
		font-weight: 600;
		padding: 0.65rem 1rem;
		border-radius: var(--radius-md);
		background: var(--green);
		color: var(--green-ink);
		border: none;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: var(--touch-target);
		transition: background var(--duration-fast);
	}
	.send-big:hover {
		background: var(--green-hover);
	}
	.send-arrow {
		transition: transform var(--duration-med) var(--ease-out-quart);
	}
	.send-big:hover .send-arrow {
		transform: translateX(3px);
	}

	/* ---- top ---- */
	.top {
		padding: 2.5rem var(--page-gutter) 1.25rem;
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
		font-family: var(--font-mono);
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--muted-mid);
		margin: 0;
	}
	.brand-mark {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: conic-gradient(from 0deg, var(--green), var(--brand-mark-blue), var(--green));
	}
	.live {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--green);
	}
	.live-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--green);
		box-shadow: 0 0 0 3px var(--green-live);
		animation: breathe 2.4s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			box-shadow: 0 0 0 6px var(--green-transparent);
		}
	}

	h1 {
		font-size: clamp(1.7rem, 5vw, 2.2rem);
		font-weight: 580;
		letter-spacing: -0.025em;
		line-height: 1.05;
		margin: 0 0 0.6rem;
		color: var(--ink);
	}
	.sub {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0;
	}
	.sub-id {
		color: var(--muted-bright);
	}
	.sub-sep {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--quiet-low);
	}
	.ttl-note {
		margin: 0.7rem 0 0;
		font-family: var(--font-mono);
		font-size: 0.74rem;
		color: var(--quiet-bright);
	}

	/* ---- checkpoint rail (anchor links, no JS) ---- */
	.cp-rail {
		padding: var(--space-lg) var(--page-gutter) var(--space-xl);
	}
	.cp-rail-track {
		display: flex;
		gap: var(--space-sm);
		overflow-x: auto;
		padding-bottom: var(--space-xs);
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
		background: var(--pill);
		border: 1px solid var(--pill-border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		scroll-snap-align: start;
		transition:
			background var(--duration-fast),
			border-color var(--duration-fast),
			transform var(--duration-fast);
		position: relative;
		text-decoration: none;
		color: inherit;
	}
	.cp-pill:hover {
		background: var(--pill-hover);
	}
	.cp-pill:focus-visible {
		outline: 2px solid var(--green);
		outline-offset: 2px;
	}
	.cp-pill-num {
		grid-area: num;
		align-self: center;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--quiet-bright);
		font-variant-numeric: tabular-nums;
		padding: 0.2rem 0.4rem;
		background: var(--inset);
		border-radius: var(--radius-xs);
	}
	.cp-pill-name {
		grid-area: name;
		font-size: 0.9rem;
		font-weight: 540;
		color: var(--text);
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cp-pill-time {
		grid-area: time;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--quiet-bright);
	}

	/* ---- stage ---- */
	.stage {
		padding: 0 var(--page-gutter);
	}

	.cp {
		margin: 0 0 1rem;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		overflow: hidden;
		scroll-margin-top: 5rem;
	}
	/* Highlight the checkpoint targeted by the rail anchor */
	.cp:target {
		border-color: var(--green-target);
		box-shadow: 0 0 0 3px var(--green-soft);
	}
	.cp:target > summary .cp-num {
		color: var(--green-target-ink);
		background: var(--green-target-bg);
	}

	.cp > summary {
		list-style: none;
		display: grid;
		grid-template-columns: max-content max-content 1fr max-content;
		grid-template-rows: auto auto;
		align-items: center;
		gap: 0.65rem;
		padding: 0.85rem 1rem;
		cursor: pointer;
		user-select: none;
		background: var(--raised);
		border-bottom: 1px solid transparent;
		transition: border-color var(--duration-fast);
	}
	.cp > summary::-webkit-details-marker {
		display: none;
	}
	.cp[open] > summary {
		border-bottom-color: var(--border);
	}
	.cp-num {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--muted-mid);
		font-variant-numeric: tabular-nums;
		padding: 0.2rem 0.45rem;
		background: var(--inset);
		border-radius: var(--radius-xs);
		letter-spacing: 0.04em;
	}
	.cp-time {
		font-family: var(--font-mono);
		font-size: 0.74rem;
		color: var(--muted);
	}
	.cp-time::before {
		content: '·';
		margin-right: 0.5rem;
		color: var(--quiet-low);
	}
	.cp > summary h2 {
		font-size: 1.05rem;
		font-weight: 560;
		letter-spacing: -0.01em;
		margin: 0;
		line-height: 1.2;
		color: var(--text-bright);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.cp-caret {
		width: 7px;
		height: 7px;
		border-right: 1.5px solid var(--muted-mid);
		border-bottom: 1.5px solid var(--muted-mid);
		transform: rotate(-45deg) translate(1px, -1px);
		transition: transform var(--duration-med) var(--ease-out-quart);
	}
	.cp[open] > summary .cp-caret {
		transform: rotate(45deg) translate(-1px, -1px);
	}

	.cp-body {
		padding: 0;
	}

	.cp-desc {
		grid-column: 3 / -1;
		font-size: 0.9rem;
		color: var(--text-soft);
		margin: 0.25rem 0 0;
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
		padding-block: 8px;
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
