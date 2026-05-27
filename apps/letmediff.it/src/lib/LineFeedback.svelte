<script lang="ts">
	interface Props {
		value: string;
		line: { start: number; end: number };
		ondelete?: () => void | Promise<void>;
	}

	let { value = $bindable(''), ondelete, line }: Props = $props();

	let line_sentence = $derived(
		'Comment on ' +
			(line.start === line.end ? `line ${line.start}` : `lines ${line.start}-${line.end}`),
	);

	const input_id = $props.id();
</script>

<form class="line-feedback" aria-label="Line feedback">
	<label class="sr-only" for={input_id}>Line feedback</label>
	<button
		aria-label="Delete line feedback"
		class="error"
		type="button"
		onclick={() => {
			if (window.confirm('Are you sure you want to delete this feedback?')) ondelete?.();
		}}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			width="15"
			stroke-width="1.5"
			stroke="currentColor"
			aria-hidden="true"
			data-slot="icon"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
			/>
		</svg>
	</button>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		autofocus
		id={input_id}
		type="text"
		name="line_feedback"
		bind:value
		placeholder="Add line feedback"
	/>
	<small>{line_sentence}</small>
</form>

<style>
	.line-feedback {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: auto auto;
		column-gap: 0.375rem;
		row-gap: var(--space-xs);
		align-items: center;
		width: 100%;
		padding: 0.25rem;
		border: 1px solid var(--border-soft);
		background: var(--panel);
	}

	small {
		grid-column: 2 / -1;
		font-size: 0.625rem;
		padding-left: 0.375rem;
		color: var(--green);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	input {
		min-width: 0;
		height: 2.25rem;
		padding: 0 0.625rem;
		border: 1px solid var(--border-soft);
		border-radius: 0.55rem;
		outline: none;
		background: var(--inset);
		color: var(--text);
		font: 0.8125rem/1 var(--font-sans);
	}

	input::placeholder {
		color: var(--quiet);
	}

	input:focus-visible {
		border-color: var(--green);
		box-shadow: 0 0 0 3px var(--green-soft);
	}

	button {
		min-height: 2.25rem;
		padding: 0.5rem;
		border: 1px solid var(--green);
		border-radius: 0.55rem;
		background: var(--green);
		color: var(--green-ink);
		font: 700 0.75rem/1 var(--font-sans);
		letter-spacing: 0.01em;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		border-color: var(--green-hover);
		background: var(--green-hover);
	}

	button:focus-visible {
		outline: 3px solid var(--green-soft);
		outline-offset: 2px;
	}

	.error {
		background: transparent;
		border-color: transparent;
		color: var(--ink);
	}
	.error.error:hover {
		background: transparent;
		border-color: var(--del);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
</style>
