export const db = new Map<
	string,
	[
		{
			name: string;
			diff: string;
			created_at: string;
			description?: string;
			future_edits: Record<string, { name: string; diff: string; created_at: string }[]>;
		},
	]
>();
