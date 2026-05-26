<script lang="ts">
	import { resolve } from '$app/paths';

	type Line = {
		id: string;
		kind: 'add' | 'del' | 'ctx' | 'hunk';
		n_old: number | null;
		n_new: number | null;
		text: string;
		feedback?: string;
	};

	const checkpoints = [
		{ id: '04', title: 'Adopt valibot schemas', files: 3, time: '2m ago' },
		{ id: '05', title: 'Wire diff socket to MCP', files: 5, time: '1m ago' },
		{ id: '06', title: 'Persist checkpoint cursors', files: 2, time: '12s ago' },
	];

	const hero_lines: Line[] = [
		{
			id: 'hunk-stream',
			kind: 'hunk',
			n_old: null,
			n_new: null,
			text: '@@ src/lib/diff/stream.ts @@',
		},
		{
			id: 'ctx-open-stream',
			kind: 'ctx',
			n_old: 41,
			n_new: 41,
			text: 'export function open_stream(session_id: string) {',
		},
		{
			id: 'del-event-source',
			kind: 'del',
			n_old: 42,
			n_new: null,
			text: '\tconst es = new EventSource(`/events/${session_id}`);',
		},
		{
			id: 'add-event-source-open',
			kind: 'add',
			n_old: null,
			n_new: 42,
			text: '\tconst es = new EventSource(`/events/${session_id}`, {',
		},
		{
			id: 'add-credentials',
			kind: 'add',
			n_old: null,
			n_new: 43,
			text: '\t\twithCredentials: true',
		},
		{ id: 'add-event-source-close', kind: 'add', n_old: null, n_new: 44, text: '\t});' },
		{
			id: 'ctx-checkpoint-listener-open',
			kind: 'ctx',
			n_old: 43,
			n_new: 45,
			text: "\tes.addEventListener('checkpoint', (e) => {",
		},
		{
			id: 'del-unparsed-checkpoint',
			kind: 'del',
			n_old: 44,
			n_new: null,
			text: '\t\tcheckpoints.update((c) => [...c, JSON.parse(e.data)]);',
		},
		{
			id: 'add-parsed-checkpoint',
			kind: 'add',
			n_old: null,
			n_new: 46,
			text: '\t\tconst cp = parse(checkpoint_schema, JSON.parse(e.data));',
			feedback:
				'Line note: make parse failures visible to the agent instead of dropping the checkpoint.',
		},
		{
			id: 'add-checkpoint-update',
			kind: 'add',
			n_old: null,
			n_new: 47,
			text: '\t\tcheckpoints.update((c) => [...c, cp]);',
		},
		{ id: 'ctx-listener-close', kind: 'ctx', n_old: 45, n_new: 48, text: '\t});' },
		{ id: 'ctx-return-event-source', kind: 'ctx', n_old: 46, n_new: 49, text: '\treturn es;' },
		{ id: 'ctx-function-close', kind: 'ctx', n_old: 47, n_new: 50, text: '}' },
	];

	const feedback_words = [
		'overall ',
		'this ',
		'looks ',
		'right. ',
		'please ',
		'apply ',
		'the ',
		'line ',
		'notes ',
		'and ',
		'continue.',
	];

	let typed = $state('');
	let live_seconds = $state(0);

	$effect(() => {
		// Type feedback text into the textarea, then loop.
		let idx = 0;
		let char = 0;
		const tick = () => {
			if (idx >= feedback_words.length) {
				setTimeout(() => {
					typed = '';
					idx = 0;
					char = 0;
					tick();
				}, 3200);
				return;
			}
			const word = feedback_words[idx];
			char++;
			typed = feedback_words.slice(0, idx).join('') + word.slice(0, char);
			if (char >= word.length) {
				idx++;
				char = 0;
				setTimeout(tick, 110);
			} else {
				setTimeout(tick, 32 + Math.random() * 38);
			}
		};
		const t1 = setTimeout(tick, 900);

		// Live session counter
		const sec = setInterval(() => (live_seconds += 1), 1000);

		return () => {
			clearTimeout(t1);
			clearInterval(sec);
		};
	});

	function fmt_clock(s: number) {
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
	}
</script>

<svelte:head>
	<title>letmediff · pocket review console for agent diffs</title>
	<meta
		name="description"
		content="letmediff is the review handoff console for agent-driven coding. Inspect checkpointed diffs from a shareable URL and send feedback back to the waiting agent, from anywhere."
	/>
	<meta name="theme-color" content="oklch(12% 0.008 240)" />
</svelte:head>

<div class="page">
	<!-- Top status bar: pretends to be the product header -->
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
			<span class="bar-meta">session a7f3-91c2</span>
		</div>
		<div class="bar-right">
			<span class="dot" aria-hidden="true"></span>
			<span class="bar-meta">live · {fmt_clock(live_seconds)}</span>
		</div>
	</header>

	<!-- HERO: split composition. Pitch left, live diff right. Asymmetric. -->
	<section class="hero">
		<div class="hero-copy">
			<span class="kicker">a free review handoff console</span>
			<h1 class="display">
				Read the diff.<br />
				<span class="display-mute">Send the note.</span><br />
				<span class="display-green">Agent keeps going.</span>
			</h1>
			<p class="lede">
				letmediff opens a shareable URL for a curated review of your agent changes. You read the
				change, scrub the files, leave top-level or line-specific feedback, and the coding session
				keeps moving while you put the phone down.
			</p>
			<div class="cta-row">
				<a class="btn-primary" href="#install">
					<span>Add the MCP</span>
					<svg
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
					>
						<path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="square" stroke-linejoin="round" />
					</svg>
				</a>
				<a class="btn-ghost" href={resolve('/diff/[id]', { id: 'demo' })}>Open a sample review</a>
			</div>
		</div>

		<!-- The product demo. A miniature review session in HTML. -->
		<div class="demo" aria-label="Live review session demo">
			<div class="demo-frame">
				<div class="demo-chrome">
					<span class="chrome-meta">letmediff.it/diff/a7f3-91c2</span>
					<span class="chrome-pill">3 checkpoints</span>
				</div>

				<!-- Sticky feedback sheet -->
				<div class="feedback">
					<div class="feedback-label">
						<span>feedback</span>
						<span class="kbd">⌘ ⏎</span>
					</div>
					<div class="feedback-input" aria-label="Draft final review feedback">
						<span class="feedback-text">{typed}<span class="caret">▍</span></span>
					</div>
					<button class="feedback-send" type="button" tabindex="-1" aria-hidden="true">
						send
						<svg
							viewBox="0 0 24 24"
							width="14"
							height="14"
							fill="none"
							stroke="currentColor"
							stroke-width="2.2"
						>
							<path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="square" stroke-linejoin="round" />
						</svg>
					</button>
				</div>

				<!-- Checkpoint rail -->
				<div class="rail" role="list">
					{#each checkpoints as cp, i (cp.id)}
						<div class="rail-pill" class:rail-active={i === 1} role="listitem">
							<span class="rail-num">cp.{cp.id}</span>
							<span class="rail-title">{cp.title}</span>
							<span class="rail-meta">{cp.files} files · {cp.time}</span>
						</div>
					{/each}
				</div>

				<!-- The actual diff -->
				<div class="diff">
					<div class="diff-head">
						<span class="diff-file">src/lib/diff/stream.ts</span>
						<span class="diff-stat">
							<span class="add-count">+4</span>
							<span class="del-count">−2</span>
						</span>
					</div>
					<div class="diff-body" role="presentation">
						{#each hero_lines as l (l.id)}
							<div class="row row-{l.kind}">
								{#if l.kind === 'hunk'}
									<span class="row-hunk">{l.text}</span>
								{:else}
									<span class="gutter">{l.n_old ?? ''}</span>
									<span class="gutter">{l.n_new ?? ''}</span>
									<span class="sign">
										{#if l.kind === 'add'}+{:else if l.kind === 'del'}−{:else}&nbsp;{/if}
									</span>
									<span class="code">{l.text}</span>
								{/if}
							</div>
							{#if l.feedback}
								<div class="inline-note">
									<span class="inline-note-pin">L{l.n_new}</span>
									<span>{l.feedback}</span>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS: vertical timeline. Not cards. -->
	<section class="how">
		<div class="how-head">
			<span class="kicker">how the handoff works</span>
			<h2 class="h2">Four moves.</h2>
		</div>

		<ol class="steps">
			<li class="step">
				<span class="step-n">01</span>
				<div class="step-body">
					<h3>The agent pauses creates checkpoints after every task. Then send you a link.</h3>
					<p>
						The letmediff MCP snapshots the working tree, posts the diff, and the session waits. No
						polling, no copy-paste, no chat-thread archaeology.
					</p>
					<div class="step-aside">
						<span class="aside-label">mcp.json</span>
						<pre><code
								>{`{
  "letmediff": {
    "command": "npx",
    "args": ["-y", "letmediff"]
  }
}`}</code
							></pre>
					</div>
				</div>
			</li>

			<li class="step">
				<span class="step-n">02</span>
				<div class="step-body">
					<h3>A link arrives. You open it.</h3>
					<p>
						A review experience specifically built for agent checkpoints. It's not just git. The
						agent decides how to best show you their changes.
					</p>
					<div class="step-aside step-aside-pillrow">
						<span class="aside-label">checkpoint rail</span>
						<div class="mini-rail">
							<span class="mini-pill">cp.01</span>
							<span class="mini-pill">cp.02</span>
							<span class="mini-pill mini-active">cp.03</span>
							<span class="mini-pill">cp.04</span>
						</div>
					</div>
				</div>
			</li>

			<li class="step">
				<span class="step-n">03</span>
				<div class="step-body">
					<h3>You read. You give feedback.</h3>
					<p>
						The sticky feedback sheet stays in reach as you scroll the diff. Leave a session note,
						or tap a line and attach the comment exactly where it belongs. letmediff carries
						checkpoint, file, and line context back to the agent.
					</p>
				</div>
			</li>

			<li class="step">
				<span class="step-n">04</span>
				<div class="step-body">
					<h3>The agent resumes with your note in hand.</h3>
					<p>
						Feedback returns to the same MCP session over a kept-open channel. Rinse and repeat
						until your feature is complete.
					</p>
				</div>
			</li>
		</ol>
	</section>

	<!-- MANIFESTO BLOCK: the textarea as a stage prop -->
	<section class="manifesto">
		<p class="manifesto-eyebrow">why a separate surface</p>
		<p class="manifesto-text">
			Reviewing the code is the real bottleneck. letmediff tries to build a review experience where
			agent and human actually cooperate. It's also specifically optimized for mobile so that you
			can review your code even while working from your phone.
		</p>
	</section>

	<!-- INSTALL -->
	<section class="install" id="install">
		<div class="install-head">
			<span class="kicker">get going</span>
			<h2 class="h2">Ask for the work. Review the checkpoints.</h2>
		</div>

		<div class="setup-copy">
			<p>
				Add the MCP server with <code>mcp-add</code>, then keep using your coding agent normally.
				The agent can create several checkpoints, publish one review URL that contains all of them,
				then call a wait tool so it stops until you finish reviewing in letmediff.
			</p>
			<pre><code
					>{`npx mcp-add \
  --name letmediff \
  --type stdio \
  --command "npx -y letmediff" \
  --scope project`}</code
				></pre>
		</div>

		<div class="chat-demo" aria-label="Agent chat workflow example">
			<div class="chat-top">
				<span class="chat-dot"></span>
				<span class="chat-title">agent chat</span>
				<span class="chat-status">letmediff connected</span>
			</div>
			<div class="chat-body">
				<div class="bubble bubble-user">
					Add line-level comments to the review page and make sure mobile still feels good.
				</div>
				<div class="bubble bubble-agent">
					I’ll implement it, create checkpoints as I go, then ask you to review the full diff set.
				</div>
				<div class="tool-card">
					<span class="tool-index">tool_call</span>
					<span class="checkpoint-kicker">letmediff checkpoint</span>
					<strong>Updated landing copy and package name.</strong>
					<span>The package shown in the setup is the package users actually install.</span>
				</div>
				<div class="tool-card">
					<span class="tool-index">tool_call</span>
					<span class="checkpoint-kicker">letmediff checkpoint</span>
					<strong>Added line-level feedback to the diff demo.</strong>
					<span>Line notes are attached in the review, not typed into the final comment.</span>
				</div>
				<div class="tool-card">
					<span class="tool-index">tool_call</span>
					<span class="checkpoint-kicker">letmediff review url</span>
					<strong>3 checkpoints ready</strong>
					<a href={resolve('/diff/[id]', { id: 'demo' })}>https://letmediff.it/diff/a7f3-91c2</a>
				</div>
				<div class="tool-card tool-card-waiting">
					<span class="tool-index">tool_call</span>
					<span class="checkpoint-kicker">letmediff wait_for_review</span>
					<strong>Waiting for review in letmediff...</strong>
					<span>The feedback is submitted from the review page, not typed into chat.</span>
				</div>
				<div class="bubble bubble-agent">
					Review received. I’ll apply the requested changes and continue from the latest checkpoint.
				</div>
			</div>
		</div>

		<div class="install-foot">
			<span class="install-aside">free to use</span>
		</div>
	</section>

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
	}

	/* ---------- bar ---------- */
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
	}
	.mark {
		color: var(--ink);
		display: inline-flex;
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
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--green);
		box-shadow: 0 0 0 4px oklch(75% 0.18 165 / 0.16);
		animation: pulse 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			box-shadow: 0 0 0 4px oklch(75% 0.18 165 / 0.16);
		}
		50% {
			box-shadow: 0 0 0 7px oklch(75% 0.18 165 / 0.05);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
		}
	}

	/* ---------- hero ---------- */
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: clamp(2rem, 5vw, 4rem);
		padding: clamp(2.4rem, 6vw, 5rem) 0 clamp(3rem, 7vw, 6rem);
	}
	@media (min-width: 980px) {
		.hero {
			grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
			align-items: start;
		}
	}

	.kicker {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--muted);
		margin-bottom: clamp(1rem, 2.4vw, 1.6rem);
	}
	.kicker::before {
		content: '/ ';
		color: var(--quiet);
	}

	.display {
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: clamp(2.4rem, 7.4vw, 5.4rem);
		line-height: 0.98;
		letter-spacing: -0.035em;
		color: var(--ink);
		margin: 0 0 clamp(1.4rem, 3vw, 2rem);
		max-width: 14ch;
	}
	.display-mute {
		color: var(--muted);
	}
	.display-green {
		color: var(--green);
	}

	.lede {
		font-size: clamp(1rem, 1.4vw, 1.12rem);
		line-height: 1.55;
		color: var(--text);
		max-width: 48ch;
		margin: 0 0 clamp(1.8rem, 3vw, 2.4rem);
	}

	.cta-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: clamp(2rem, 4vw, 2.6rem);
	}
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		background: var(--green);
		color: var(--green-ink);
		font-weight: 600;
		font-size: 0.92rem;
		padding: 0.72rem 1.05rem;
		border-radius: 8px;
		text-decoration: none;
		transition:
			background 200ms cubic-bezier(0.16, 1, 0.3, 1),
			transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	.btn-primary svg {
		transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	.btn-primary:hover {
		background: var(--green-hover);
	}
	.btn-primary:hover svg {
		transform: translateX(3px);
	}
	.btn-primary:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--green-soft);
	}

	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text);
		background: transparent;
		border: 1px solid var(--border);
		font-weight: 500;
		font-size: 0.92rem;
		padding: 0.7rem 1rem;
		border-radius: 8px;
		text-decoration: none;
		transition:
			border-color 200ms,
			color 200ms;
	}
	.btn-ghost:hover {
		border-color: oklch(32% 0.012 240);
		color: var(--ink);
	}

	.hero-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(1rem, 2.5vw, 1.6rem);
		margin: 0;
		padding-top: clamp(1.4rem, 2.4vw, 1.8rem);
		border-top: 1px solid var(--border-soft);
		max-width: 38rem;
	}

	/* ---------- demo (product mini) ---------- */
	.demo {
		position: relative;
	}
	.demo-frame {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 460px;
		box-shadow: 0 30px 60px -30px oklch(0% 0 0 / 0.6);
	}
	.demo-chrome {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.85rem;
		background: var(--raised);
		border-bottom: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--muted);
	}
	.chrome-meta {
		letter-spacing: 0.04em;
	}
	.chrome-pill {
		padding: 0.18rem 0.5rem;
		border-radius: 999px;
		background: oklch(20% 0.012 240);
		color: var(--text);
	}

	/* feedback sticky */
	.feedback {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.7rem;
		align-items: center;
		padding: 0.65rem 0.7rem;
		background: var(--raised);
		border-bottom: 1px solid var(--border);
	}
	.feedback-label {
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		color: var(--muted);
		text-transform: lowercase;
	}
	.kbd {
		font-size: 0.6rem;
		color: var(--quiet);
	}
	.feedback-input {
		background: var(--inset);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.45rem 0.55rem;
		min-height: 38px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		box-shadow: 0 0 0 3px var(--green-soft);
		border-color: var(--green);
	}
	.feedback-text {
		min-width: 0;
		font-size: 0.86rem;
		line-height: 1.4;
		color: var(--text);
		font-family: var(--font-sans);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.caret {
		display: inline-block;
		color: var(--green);
		transform: translateY(-1px);
		margin-left: 1px;
		animation: caret-blink 1.04s steps(2, jump-none) infinite;
	}
	@keyframes caret-blink {
		50% {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.caret {
			animation: none;
		}
	}
	.feedback-send {
		background: var(--green);
		color: var(--green-ink);
		border: none;
		border-radius: 8px;
		padding: 0.5rem 0.7rem;
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 0.78rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
	}

	/* checkpoint rail */
	.rail {
		display: flex;
		gap: 0.5rem;
		padding: 0.7rem;
		overflow-x: auto;
		border-bottom: 1px solid var(--border);
		scrollbar-width: none;
	}
	.rail::-webkit-scrollbar {
		display: none;
	}
	.rail-pill {
		flex: 0 0 auto;
		min-width: 12rem;
		display: grid;
		grid-template-rows: auto auto;
		gap: 0.18rem;
		padding: 0.55rem 0.7rem;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 10px;
		position: relative;
	}
	.rail-active {
		border-color: var(--green);
		box-shadow: 0 0 0 3px oklch(75% 0.18 165 / 0.12);
	}
	.rail-num {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		color: var(--muted);
		background: oklch(11% 0.008 240);
		padding: 0.12rem 0.36rem;
		border-radius: 4px;
		justify-self: start;
	}
	.rail-active .rail-num {
		color: var(--green);
		background: oklch(20% 0.04 165 / 0.5);
	}
	.rail-title {
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--ink);
		line-height: 1.25;
	}
	.rail-meta {
		grid-column: 1 / -1;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--muted);
		margin-top: 0.1rem;
	}

	/* diff body */
	.diff {
		flex: 1;
		background: var(--panel);
		display: flex;
		flex-direction: column;
	}
	.diff-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.85rem;
		border-bottom: 1px solid var(--border-soft);
	}
	.diff-file {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--text);
	}
	.diff-stat {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		display: flex;
		gap: 0.5rem;
	}
	.add-count {
		color: var(--add);
	}
	.del-count {
		color: var(--del);
	}

	.diff-body {
		font-family: var(--font-mono);
		font-size: 0.74rem;
		line-height: 1.55;
		padding: 0.3rem 0;
		overflow-x: auto;
	}
	.row {
		display: grid;
		grid-template-columns: 2.4rem 2.4rem 1.4rem 1fr;
		min-width: max-content;
		padding: 0 0.4rem;
	}
	.row-hunk {
		display: block;
		padding: 0.35rem 0.7rem;
		color: var(--muted);
		background: oklch(13% 0.014 240);
		grid-column: 1 / -1;
		font-size: 0.7rem;
	}
	.gutter {
		text-align: right;
		padding-right: 0.6rem;
		color: var(--quiet);
		user-select: none;
	}
	.sign {
		text-align: center;
		color: var(--muted);
	}
	.code {
		white-space: pre;
		color: var(--text);
		padding-right: 0.6rem;
	}
	.row-add {
		background: var(--add-bg);
	}
	.row-add .sign,
	.row-add .gutter {
		color: var(--add);
	}
	.row-del {
		background: var(--del-bg);
	}
	.row-del .sign,
	.row-del .gutter {
		color: var(--del);
	}
	.inline-note {
		display: flex;
		align-items: start;
		gap: 0.55rem;
		width: fit-content;
		min-width: 0;
		margin: 0.28rem 0.7rem 0.48rem 6.4rem;
		padding: 0.48rem 0.65rem;
		max-width: min(28rem, calc(100% - 7.1rem));
		border: 1px solid oklch(75% 0.18 165 / 0.34);
		border-radius: 8px;
		background:
			linear-gradient(90deg, oklch(75% 0.18 165 / 0.1), transparent 55%),
			oklch(11% 0.014 240 / 0.96);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: 0.72rem;
		line-height: 1.35;
		box-shadow: 0 12px 26px -22px var(--green);
	}
	.inline-note-pin {
		flex: 0 0 auto;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		color: var(--green);
		padding-top: 0.04rem;
	}

	/* ---------- how ---------- */
	.how {
		padding: clamp(3rem, 8vw, 6rem) 0 clamp(2rem, 5vw, 4rem);
		border-top: 1px solid var(--border-soft);
	}
	.how-head {
		max-width: 38rem;
		margin-bottom: clamp(2rem, 4vw, 3rem);
	}
	.h2 {
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: clamp(1.8rem, 3.6vw, 2.8rem);
		line-height: 1.05;
		letter-spacing: -0.028em;
		color: var(--ink);
		margin: 0;
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: clamp(2.2rem, 4vw, 3.4rem);
	}
	.step {
		display: grid;
		grid-template-columns: 4.4rem minmax(0, 1fr);
		gap: clamp(0.8rem, 2vw, 1.6rem);
		padding-bottom: clamp(2rem, 4vw, 2.8rem);
		border-bottom: 1px solid var(--border-soft);
	}
	.step:last-child {
		border-bottom: none;
	}
	.step-n {
		font-family: var(--font-mono);
		font-size: 0.86rem;
		letter-spacing: 0.06em;
		color: var(--green);
		padding-top: 0.45rem;
		font-weight: 500;
	}
	.step-body h3 {
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: clamp(1.1rem, 1.9vw, 1.45rem);
		line-height: 1.2;
		letter-spacing: -0.015em;
		color: var(--ink);
		margin: 0 0 0.7rem;
		max-width: 28ch;
	}
	.step-body p {
		margin: 0;
		color: var(--text);
		line-height: 1.6;
		max-width: 55ch;
		font-size: 0.98rem;
	}
	.step-aside {
		margin-top: 1.2rem;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.8rem 0.9rem;
		max-width: 30rem;
	}
	.aside-label {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		color: var(--muted);
		text-transform: lowercase;
		margin-bottom: 0.55rem;
	}
	.step-aside pre {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--text);
		overflow-x: auto;
	}
	.step-aside code {
		font-family: inherit;
	}
	.step-aside-pillrow {
		max-width: 30rem;
	}
	.mini-rail {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.mini-pill {
		font-family: var(--font-mono);
		font-size: 0.74rem;
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--muted);
		background: var(--inset);
	}
	.mini-active {
		color: var(--green);
		border-color: var(--green);
		box-shadow: 0 0 0 3px oklch(75% 0.18 165 / 0.12);
	}

	/* ---------- manifesto ---------- */
	.manifesto {
		padding: clamp(3rem, 7vw, 5rem) 0;
		border-top: 1px solid var(--border-soft);
		max-width: 56rem;
	}
	.manifesto-eyebrow {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		color: var(--muted);
		text-transform: lowercase;
		margin: 0 0 1.4rem;
	}
	.manifesto-text {
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: clamp(1.3rem, 2.6vw, 1.85rem);
		line-height: 1.32;
		letter-spacing: -0.018em;
		color: var(--ink);
		margin: 0;
		max-width: 32ch;
	}

	/* ---------- install ---------- */
	.install {
		padding: clamp(2.4rem, 6vw, 4.5rem) 0 clamp(3rem, 7vw, 5rem);
		border-top: 1px solid var(--border-soft);
	}
	.install-head {
		max-width: 38rem;
		margin-bottom: clamp(1.8rem, 3vw, 2.4rem);
	}
	.setup-copy {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: clamp(1rem, 2.6vw, 1.3rem);
		max-width: 48rem;
		margin-bottom: 1rem;
	}
	.setup-copy p {
		margin: 0 0 1rem;
		color: var(--text);
		line-height: 1.6;
		max-width: 56ch;
	}
	.setup-copy code {
		font-family: var(--font-mono);
		color: var(--ink);
	}
	.setup-copy pre {
		margin: 0;
		padding: 0.8rem 0.9rem;
		background: var(--inset);
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow-x: auto;
		line-height: 1.55;
	}
	.chat-demo {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		max-width: 48rem;
		box-shadow: 0 24px 50px -34px oklch(0% 0 0 / 0.8);
	}
	.chat-top {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.65rem 0.85rem;
		background: var(--raised);
		border-bottom: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--muted);
	}
	.chat-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--green);
		box-shadow: 0 0 0 4px var(--green-soft);
	}
	.chat-title {
		color: var(--ink);
		letter-spacing: 0.08em;
		text-transform: lowercase;
	}
	.chat-status {
		justify-self: end;
		color: var(--green);
	}
	.chat-body {
		display: grid;
		gap: 0.7rem;
		padding: clamp(0.9rem, 2.6vw, 1.2rem);
	}
	.bubble {
		max-width: 75%;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 13px;
		font-size: 0.9rem;
		line-height: 1.45;
		color: var(--text);
	}
	.bubble-user {
		justify-self: end;
		background: var(--green);
		border-color: var(--green);
		color: var(--green-ink);
	}
	.bubble-agent {
		justify-self: start;
		background: var(--raised);
	}
	.tool-card {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 0.35rem;
		column-gap: 0.7rem;
		justify-self: start;
		width: min(100%, 31rem);
		padding: 0.85rem 0.95rem;
		background: linear-gradient(90deg, oklch(75% 0.18 165 / 0.08), transparent 42%), var(--inset);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text);
		font-size: 0.86rem;
		line-height: 1.45;
	}
	.tool-card-waiting {
		background:
			repeating-linear-gradient(
				135deg,
				oklch(75% 0.18 165 / 0.07) 0,
				oklch(75% 0.18 165 / 0.07) 1px,
				transparent 1px,
				transparent 8px
			),
			var(--inset);
		border-color: oklch(75% 0.18 165 / 0.4);
		box-shadow: 0 0 0 3px var(--green-soft);
	}
	.tool-index {
		grid-row: span 3;
		display: grid;
		place-items: center;
		align-self: start;
		min-width: 2.35rem;
		height: 1.8rem;
		padding: 0 0.42rem;
		border-radius: 7px;
		background: oklch(18% 0.014 240);
		border: 1px solid oklch(26% 0.014 240);
		color: var(--green);
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
	}
	.checkpoint-kicker {
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.12em;
		color: var(--green);
		text-transform: lowercase;
	}
	.tool-card strong {
		color: var(--ink);
		font-weight: 600;
	}
	.tool-card a {
		color: var(--green);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		text-decoration: none;
		word-break: break-word;
	}

	.install-foot {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-top: 1.6rem;
	}
	.install-aside {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--muted);
		letter-spacing: 0.04em;
	}

	/* ---------- foot ---------- */
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

	/* ---------- small screens ---------- */
	@media (max-width: 640px) {
		.bar-meta {
			font-size: 0.66rem;
		}
		.hero-stats {
			grid-template-columns: 1fr 1fr;
		}
		.step {
			grid-template-columns: 2.6rem minmax(0, 1fr);
		}
		.feedback {
			grid-template-columns: 1fr auto;
		}
		.feedback-label {
			display: none;
		}
		.inline-note {
			margin-left: 3.2rem;
			max-width: calc(100% - 3.9rem);
		}
		.feedback-input {
			grid-column: 1 / -1;
			order: 2;
		}
		.feedback-send {
			order: 1;
		}
		.chat-top {
			grid-template-columns: auto 1fr;
		}
		.chat-status {
			grid-column: 1 / -1;
			justify-self: start;
		}
		.bubble {
			max-width: 92%;
		}
	}
</style>
