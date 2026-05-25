<script lang="ts">
	import { get_diff, send_feedback } from './diff.remote';
	import { CodeView } from '@pierre/diffs';
	import { get_future_edits_sentence, options } from './shared_diff.js';

	let { params } = $props();
	let loaded = $state(false);
	const diffs = $derived(await get_diff(params.id));
	const lines_feedback: string[] = $state([]);
</script>

<main>
	<form
		{...send_feedback}
		onformdata={(e) => {
			e.formData.set('line_feedback', JSON.stringify(lines_feedback));
		}}
	>
		<textarea {...send_feedback.fields.feedback.as('text')}></textarea>
		<button {...send_feedback.fields.id.as('submit', params.id)}>Submit Feedback</button>
	</form>

	{#each diffs as checkpoint (checkpoint.created_at)}
		<h2>{checkpoint.name}</h2>
		<div
			class={{ loaded }}
			{@attach (node) => {
				const instance = new CodeView({
					...options,
					onGutterUtilityClick(line) {
						console.log('gutter utility clicked', line);
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
			<div class={['ssr', { loaded: !loaded }]}>
				{#each checkpoint.diff as diffed (diffed.fileDiff.name)}
					<diff-view style:--edits={get_future_edits_sentence(diffed.fileDiff.name, checkpoint)}>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html `<template shadowrootmode="open">${diffed.prerenderedHTML}</template>`}
					</diff-view>
				{/each}
			</div>
		{/if}
	{/each}
</main>

<style>
	div:not(.loaded) {
		display: none;
	}
	div.loaded {
		display: block;
	}
	.ssr.ssr {
		display: grid;
		gap: 8px;
		margin-block: 8px;
	}
</style>
