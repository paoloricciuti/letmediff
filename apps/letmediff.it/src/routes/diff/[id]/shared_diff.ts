import type { FileDiffOptions } from '@pierre/diffs';

export const options = {
	unsafeCSS: `
[data-title]{
	display: flex;
	align-items: center;
	column-gap: 4px;
	direction: ltr;
	&::after{
		content: var(--edits);
		font-size: 0.9em;
		color: orange;
		opacity: 0.7;
	}
}
`,
	theme: {
		light: 'github-light',
		dark: 'github-dark',
	},
	diffStyle: 'unified',
	enableLineSelection: true,
	enableGutterUtility: true,
} satisfies FileDiffOptions<undefined>;

const list_formatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export function get_future_edits_sentence(
	name: string,
	checkpoint: { future_edits: Record<string, { name: string }[]> },
) {
	const future_edits = checkpoint.future_edits[name.substring(2)];
	if (!future_edits) return undefined;
	return `'Re-edited in: ${list_formatter.format([...future_edits].map((fe) => `"${fe.name}"`))}'`;
}
