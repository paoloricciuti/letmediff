import { toSnapshotSync, fromSnapshotSync } from '@jsonjoy.com/fs-snapshot';
import { createTwoFilesPatch } from 'diff';
import * as git from 'isomorphic-git';
import { memfs } from 'memfs';
import * as node_fs from 'node:fs';
import path from 'node:path';

const FOLDER = 0;
const FILE = 1;
const SYMLINK = 2;
// need casting for some weird typing issues
const snapshot_fs =
	/** @type {import('@jsonjoy.com/fs-snapshot').SnapshotOptions['fs']} */ (
		/** @type {unknown} */ (node_fs)
	);

/**
 * @typedef {import('@jsonjoy.com/fs-snapshot').SnapshotNode} SnapshotNode
 */

/**
 * @typedef {{ name: string, diff: string, created_at: Date, description?: string }} GitCheckpointReference
 */

/**
 * @typedef {Record<string, GitCheckpointReference[]>} FutureEdits
 */

/**
 * @typedef {{ name: string, diff: string, created_at: Date, future_edits: FutureEdits, description?: string }} GitCheckpoint
 */

/**
 * @typedef {{ name: string, description?: string, files: string[] }} GitCheckpointInput
 */

/**
 * @typedef {{ filepath: string, content: string, binary: boolean }} SnapshotFile
 */

/**
 * @typedef {{ content: string, binary: boolean }} SnapshotFileContents
 */

/**
 * @typedef {{ filepath: string, before_file: SnapshotFileContents | null, after_file: SnapshotFileContents | null }} SnapshotFileChange
 */

/**
 * @typedef {{
 * 	path: string;
 * 	fs: import('memfs').IFs;
 * 	baseline_commit: string | null;
 * 	checkpoints: GitCheckpoint[];
 * }} GitCheckpointStoreState
 */

/**
 * Creates a checkpoint store backed by an in-memory git repo initialized from `repo_path`.
 *
 * @param {string} repo_path
 */
export async function create_git_checkpoint_store(repo_path) {
	const store = new GitCheckpointStore(repo_path);
	await store.reset();
	return store;
}

export class GitCheckpointStore {
	/**
	 * @param {string} repo_path
	 */
	constructor(repo_path) {
		this.path = path.resolve(repo_path);
		/** @type {SnapshotNode | null} */
		this.snapshot = null;
		/** @type {import('memfs').IFs | null} */
		this.fs = null;
		/** @type {string | null} */
		this.baseline_commit = null;
		/** @type {GitCheckpoint[]} */
		this.checkpoints = [];
		/** @type {Map<GitCheckpoint, Set<string>>} */
		this.checkpoint_filepaths = new Map();
		/** @type {Map<GitCheckpoint, { before: SnapshotNode, after: SnapshotNode }>} */
		this.checkpoint_snapshots = new Map();
	}

	async reset() {
		await this.rebaseline();
		this.checkpoints = [];
		this.checkpoint_filepaths.clear();
		this.checkpoint_snapshots.clear();
	}

	async rebaseline() {
		const stats = node_fs.statSync(this.path);
		if (!stats.isDirectory()) {
			throw new Error(`Expected a directory path, got ${this.path}`);
		}

		const snapshot = clone_snapshot(
			toSnapshotSync({ fs: snapshot_fs, path: this.path }),
		);
		remove_entry(snapshot, '.git');
		await this.set_baseline_snapshot(snapshot);
	}

	/**
	 * @param {SnapshotNode} snapshot
	 */
	async set_baseline_snapshot(snapshot) {
		const { fs } = memfs();
		fromSnapshotSync(snapshot, { fs, path: this.path });

		this.snapshot = snapshot;
		this.fs = fs;
		this.baseline_commit = await initialize_repo(fs, this.path);
	}

	/**
	 * Stores the diff from the previous snapshot to the current real file system state.
	 * Resets the in-memory repo to the current real file system state afterwards.
	 *
	 * @param {string} name
	 * @returns {Promise<GitCheckpoint>}
	 */
	async store_checkpoint(name) {
		return /** @type {Promise<GitCheckpoint>} */ (
			this.store_current_snapshot(name, false)
		);
	}

	/**
	 * Stores multiple checkpoints by splitting the current diff by file path.
	 *
	 * @param {GitCheckpointInput[]} checkpoint_inputs
	 * @returns {Promise<GitCheckpoint[]>}
	 */
	async store_checkpoints(checkpoint_inputs) {
		if (!this.snapshot) {
			throw new Error(
				'Checkpoint store has not been initialized. Call reset() first.',
			);
		}

		const requested_filepaths = checkpoint_inputs.flatMap(({ files }) =>
			files.map((filepath) =>
				normalize_checkpoint_filepath(filepath, this.path),
			),
		);
		const next_snapshot = snapshot_filepaths(
			this.snapshot,
			this.path,
			requested_filepaths,
		);

		const changed_files = changed_snapshot_filepaths(
			this.snapshot,
			next_snapshot,
			requested_filepaths,
		);
		const changed_file_map = new Map(
			changed_files.map((file) => [file.filepath, file]),
		);
		/** @type {GitCheckpoint[]} */
		const checkpoints = [];

		for (const checkpoint_input of checkpoint_inputs) {
			const filepaths = [
				...new Set(
					checkpoint_input.files.map((filepath) =>
						normalize_checkpoint_filepath(filepath),
					),
				),
			];
			const checkpoint_files = filepaths.flatMap((filepath) => {
				const file = changed_file_map.get(filepath);
				return file ? [file] : [];
			});

			if (checkpoint_files.length === 0) continue;

			/** @type {GitCheckpoint} */
			const checkpoint = {
				name: checkpoint_input.name,
				diff: create_snapshot_diff(checkpoint_files),
				created_at: new Date(),
				future_edits: {},
			};
			if (checkpoint_input.description !== undefined) {
				checkpoint.description = checkpoint_input.description;
			}

			this.checkpoints.push(checkpoint);
			this.checkpoint_filepaths.set(checkpoint, new Set(filepaths));
			this.checkpoint_snapshots.set(checkpoint, {
				before: clone_snapshot(this.snapshot),
				after: clone_snapshot(next_snapshot),
			});
			checkpoints.push(checkpoint);
		}

		this.refresh_future_edits();
		await this.set_baseline_snapshot(next_snapshot);
		return checkpoints;
	}

	/**
	 * Merges the current real file system state into the latest checkpoint if it changed.
	 *
	 * @returns {Promise<GitCheckpoint | null>}
	 */
	async merge_checkpoint_if_changed() {
		return this.store_current_snapshot(generated_checkpoint_name(), true, true);
	}

	/**
	 * @param {string} name
	 * @param {boolean} skip_empty
	 * @param {boolean} [merge_with_latest]
	 */
	async store_current_snapshot(name, skip_empty, merge_with_latest = false) {
		if (!this.snapshot) {
			throw new Error(
				'Checkpoint store has not been initialized. Call reset() first.',
			);
		}

		const next_snapshot = clone_snapshot(
			toSnapshotSync({ fs: snapshot_fs, path: this.path }),
		);
		remove_entry(next_snapshot, '.git');

		const changed_files = changed_snapshot_files(this.snapshot, next_snapshot);
		if (skip_empty && changed_files.length === 0) return null;

		const changed_filepaths = changed_files.map(({ filepath }) => filepath);
		const latest_checkpoint = this.checkpoints.at(-1);
		if (merge_with_latest && latest_checkpoint) {
			const snapshots = this.checkpoint_snapshots.get(latest_checkpoint);
			const before_snapshot = snapshots?.before ?? this.snapshot;
			const merged_changed_files = changed_snapshot_files(
				before_snapshot,
				next_snapshot,
			);
			const merged_changed_filepaths = merged_changed_files.map(
				({ filepath }) => filepath,
			);

			latest_checkpoint.diff = create_snapshot_diff(merged_changed_files);
			this.checkpoint_filepaths.set(
				latest_checkpoint,
				new Set(merged_changed_filepaths),
			);
			this.checkpoint_snapshots.set(latest_checkpoint, {
				before: clone_snapshot(before_snapshot),
				after: clone_snapshot(next_snapshot),
			});
			this.refresh_future_edits();
			await this.rebaseline();
			return latest_checkpoint;
		}

		const checkpoint = {
			name,
			diff: create_snapshot_diff(changed_files),
			created_at: new Date(),
			future_edits: {},
		};

		this.add_further_edits(changed_filepaths, checkpoint);
		this.checkpoints.push(checkpoint);
		this.checkpoint_filepaths.set(checkpoint, new Set(changed_filepaths));
		this.checkpoint_snapshots.set(checkpoint, {
			before: clone_snapshot(this.snapshot),
			after: clone_snapshot(next_snapshot),
		});
		await this.rebaseline();
		return checkpoint;
	}

	read_checkpoints() {
		return this.checkpoints.map(clone_checkpoint);
	}

	/**
	 * @param {string} name
	 */
	read_checkpoint(name) {
		const checkpoint = this.checkpoints.find(
			(checkpoint) => checkpoint.name === name,
		);
		return checkpoint ? clone_checkpoint(checkpoint) : null;
	}

	/**
	 * @param {string[]} filepaths
	 * @param {GitCheckpoint} checkpoint
	 */
	add_further_edits(filepaths, checkpoint) {
		const checkpoint_ref = checkpoint_reference(checkpoint);

		for (const filepath of filepaths) {
			const checkpoints = this.find_checkpoints_for_file(filepath);
			for (const previous_checkpoint of checkpoints) {
				previous_checkpoint.future_edits[filepath] ??= [];
				previous_checkpoint.future_edits[filepath].push(checkpoint_ref);
			}
		}
	}

	/**
	 * @param {string} filepath
	 */
	find_checkpoints_for_file(filepath) {
		return this.checkpoints.filter((checkpoint) => {
			if (
				checkpoint &&
				this.checkpoint_filepaths.get(checkpoint)?.has(filepath)
			) {
				return true;
			}

			return false;
		});
	}

	refresh_future_edits() {
		for (const checkpoint of this.checkpoints) {
			checkpoint.future_edits = {};
		}

		for (let index = 0; index < this.checkpoints.length; index += 1) {
			const checkpoint = /** @type {GitCheckpoint} */ (this.checkpoints[index]);
			const filepaths = this.checkpoint_filepaths.get(checkpoint) ?? new Set();

			for (
				let future_index = index + 1;
				future_index < this.checkpoints.length;
				future_index += 1
			) {
				const future_checkpoint = /** @type {GitCheckpoint} */ (
					this.checkpoints[future_index]
				);
				const future_filepaths =
					this.checkpoint_filepaths.get(future_checkpoint) ?? new Set();
				const future_checkpoint_ref = checkpoint_reference(future_checkpoint);

				for (const filepath of filepaths) {
					if (!future_filepaths.has(filepath)) continue;
					checkpoint.future_edits[filepath] ??= [];
					checkpoint.future_edits[filepath].push(future_checkpoint_ref);
				}
			}
		}
	}

	state() {
		if (!this.fs) {
			throw new Error(
				'Checkpoint store has not been initialized. Call reset() first.',
			);
		}

		return {
			path: this.path,
			fs: this.fs,
			baseline_commit: this.baseline_commit,
			checkpoints: this.read_checkpoints(),
		};
	}
}

/**
 * @param {import('memfs').IFs} fs
 * @param {string} repo_path
 */
async function initialize_repo(fs, repo_path) {
	await git.init({ fs, dir: repo_path, defaultBranch: 'main' });
	await git.add({ fs, dir: repo_path, filepath: '.' });

	return git.commit({
		fs,
		dir: repo_path,
		message: 'Initial snapshot',
		author: {
			name: 'letmediff',
			email: 'letmediff@example.com',
		},
	});
}

/**
 * @param {SnapshotFileChange[]} changed_files
 */
function create_snapshot_diff(changed_files) {
	const patches = [];

	for (const { filepath, before_file, after_file } of changed_files) {
		if (before_file?.binary || after_file?.binary) {
			patches.push(create_binary_patch(filepath, before_file, after_file));
			continue;
		}

		patches.push(
			createTwoFilesPatch(
				before_file ? `a/${filepath}` : '/dev/null',
				after_file ? `b/${filepath}` : '/dev/null',
				before_file?.content ?? '',
				after_file?.content ?? '',
				'',
				'',
			),
		);
	}

	return patches.join('\n');
}

/**
 * @param {SnapshotNode} before
 * @param {SnapshotNode} after
 */
function changed_snapshot_files(before, after) {
	const before_files = snapshot_file_map(before);
	const after_files = snapshot_file_map(after);
	const filepaths = [
		...new Set([...before_files.keys(), ...after_files.keys()]),
	].sort();

	return filepaths.flatMap((filepath) => {
		const before_file = before_files.get(filepath) ?? null;
		const after_file = after_files.get(filepath) ?? null;
		if (files_are_equal(before_file, after_file)) return [];

		return [
			{
				filepath,
				before_file,
				after_file,
			},
		];
	});
}

/**
 * @param {SnapshotNode} before
 * @param {SnapshotNode} after
 * @param {string[]} requested_filepaths
 */
function changed_snapshot_filepaths(before, after, requested_filepaths) {
	/** @type {Map<string, SnapshotFileChange>} */
	const changes = new Map();

	for (const requested_filepath of new Set(requested_filepaths)) {
		const before_files = snapshot_path_file_map(before, requested_filepath);
		const after_files = snapshot_path_file_map(after, requested_filepath);
		const filepaths = new Set([...before_files.keys(), ...after_files.keys()]);

		for (const filepath of filepaths) {
			const before_file = before_files.get(filepath) ?? null;
			const after_file = after_files.get(filepath) ?? null;
			if (files_are_equal(before_file, after_file)) continue;

			changes.set(filepath, {
				filepath,
				before_file,
				after_file,
			});
		}
	}

	return [...changes.values()].sort((a, b) =>
		a.filepath.localeCompare(b.filepath),
	);
}

/**
 * @param {GitCheckpoint} checkpoint
 */
function clone_checkpoint(checkpoint) {
	return structuredClone(checkpoint);
}

/**
 * @param {GitCheckpoint} checkpoint
 */
function checkpoint_reference(checkpoint) {
	/** @type {GitCheckpointReference} */
	const reference = {
		name: checkpoint.name,
		diff: checkpoint.diff,
		created_at: checkpoint.created_at,
	};
	if (checkpoint.description !== undefined) {
		reference.description = checkpoint.description;
	}
	return reference;
}

function generated_checkpoint_name() {
	return `Final changes ${new Date().toISOString()}`;
}

/**
 * @param {string} filepath
 * @param {string} [repo_path]
 */
function normalize_checkpoint_filepath(filepath, repo_path) {
	if (repo_path && path.isAbsolute(filepath)) {
		return path.relative(repo_path, filepath).replaceAll('\\', '/');
	}

	return filepath
		.replaceAll('\\', '/')
		.replace(/^\.\//, '')
		.replace(/^\/+/, '');
}

/**
 * @param {SnapshotNode} snapshot
 * @param {string} repo_path
 * @param {string[]} filepaths
 */
function snapshot_filepaths(snapshot, repo_path, filepaths) {
	const next_snapshot = clone_snapshot(snapshot);

	for (const filepath of new Set(filepaths)) {
		if (filepath === '' || filepath === '.') {
			const full_snapshot = clone_snapshot(
				toSnapshotSync({ fs: snapshot_fs, path: repo_path }),
			);
			remove_entry(full_snapshot, '.git');
			return full_snapshot;
		}

		if (filepath === '.git' || filepath.startsWith('.git/')) continue;

		const real_path = path.resolve(repo_path, filepath);
		if (!is_path_inside(repo_path, real_path)) continue;

		if (!node_fs.existsSync(real_path)) {
			remove_snapshot_path(next_snapshot, filepath);
			continue;
		}

		const file_snapshot = clone_snapshot(
			toSnapshotSync({ fs: snapshot_fs, path: real_path }),
		);
		set_snapshot_path(next_snapshot, filepath, file_snapshot);
	}

	return next_snapshot;
}

/**
 * @param {string} parent
 * @param {string} child
 */
function is_path_inside(parent, child) {
	const relative = path.relative(parent, child);
	return (
		relative === '' ||
		(!relative.startsWith('..') && !path.isAbsolute(relative))
	);
}

/**
 * @param {SnapshotNode} snapshot
 * @param {string} filepath
 * @param {SnapshotNode} value
 */
function set_snapshot_path(snapshot, filepath, value) {
	const parts = filepath.split('/').filter(Boolean);
	const name = parts.pop();
	if (!name) return;

	let current = snapshot;
	for (const part of parts) {
		const entries = snapshot_folder_entries(current);
		entries[part] ??= [FOLDER, {}, {}];
		current = entries[part];
	}

	snapshot_folder_entries(current)[name] = value;
}

/**
 * @param {SnapshotNode} snapshot
 * @param {string} filepath
 */
function remove_snapshot_path(snapshot, filepath) {
	const parts = filepath.split('/').filter(Boolean);
	const name = parts.pop();
	if (!name) return;

	let current = snapshot;
	for (const part of parts) {
		const child = snapshot_folder_entries(current)[part];
		if (!child) return;
		current = child;
	}

	delete snapshot_folder_entries(current)[name];
}

/**
 * @param {SnapshotNode} snapshot
 */
function snapshot_file_map(snapshot) {
	/** @type {Map<string, { content: string, binary: boolean }>} */
	const files = new Map();
	for (const file of snapshot_files(snapshot)) {
		files.set(file.filepath, {
			content: file.content,
			binary: file.binary,
		});
	}
	return files;
}

/**
 * @param {SnapshotNode} snapshot
 * @param {string} filepath
 */
function snapshot_path_file_map(snapshot, filepath) {
	/** @type {Map<string, { content: string, binary: boolean }>} */
	const files = new Map();
	const node = snapshot_path(snapshot, filepath);
	if (!node) return files;

	for (const file of snapshot_files(node, filepath)) {
		files.set(file.filepath, {
			content: file.content,
			binary: file.binary,
		});
	}

	return files;
}

/**
 * @param {SnapshotNode} snapshot
 * @param {string} filepath
 */
function snapshot_path(snapshot, filepath) {
	let current = snapshot;
	for (const part of filepath.split('/').filter(Boolean)) {
		const child = snapshot_folder_entries(current)[part];
		if (!child) return null;
		current = child;
	}

	return current;
}

/**
 * @param {SnapshotNode} snapshot
 * @param {string} [parent]
 * @returns {Generator<SnapshotFile>}
 */
function* snapshot_files(snapshot, parent = '') {
	const file_data = snapshot_file_data(snapshot);
	if (file_data) {
		yield {
			filepath: parent,
			content: Buffer.from(file_data).toString('utf8'),
			binary: is_binary(file_data),
		};
		return;
	}

	const symlink_target = snapshot_symlink_target(snapshot);
	if (symlink_target !== null) {
		yield {
			filepath: parent,
			content: symlink_target,
			binary: false,
		};
		return;
	}

	for (const [name, child] of Object.entries(
		snapshot_folder_entries(snapshot),
	)) {
		yield* snapshot_files(child, parent ? `${parent}/${name}` : name);
	}
}

/**
 * @param {SnapshotNode} snapshot
 * @param {string} entry
 */
function remove_entry(snapshot, entry) {
	delete snapshot_folder_entries(snapshot)[entry];
}

/**
 * @param {SnapshotNode} snapshot
 */
function snapshot_folder_entries(snapshot) {
	if (!snapshot || snapshot[0] !== FOLDER) return {};
	return snapshot[2];
}

/**
 * @param {SnapshotNode} snapshot
 */
function snapshot_file_data(snapshot) {
	if (!snapshot || snapshot[0] !== FILE) return null;
	return snapshot[2];
}

/**
 * @param {SnapshotNode} snapshot
 */
function snapshot_symlink_target(snapshot) {
	if (!snapshot || snapshot[0] !== SYMLINK) return null;
	return snapshot[1].target;
}

/**
 * @param {{ content: string, binary: boolean } | null} before_file
 * @param {{ content: string, binary: boolean } | null} after_file
 */
function files_are_equal(before_file, after_file) {
	return (
		before_file?.binary === after_file?.binary &&
		before_file?.content === after_file?.content
	);
}

/**
 * @param {string} filepath
 * @param {{ content: string, binary: boolean } | null} before_file
 * @param {{ content: string, binary: boolean } | null} after_file
 */
function create_binary_patch(filepath, before_file, after_file) {
	const old_path = before_file ? `a/${filepath}` : '/dev/null';
	const new_path = after_file ? `b/${filepath}` : '/dev/null';
	return [
		`diff --git ${old_path} ${new_path}`,
		`Binary files ${old_path} and ${new_path} differ`,
	].join('\n');
}

/**
 * @param {Uint8Array} data
 */
function is_binary(data) {
	return data.includes(0);
}

/**
 * @param {SnapshotNode} snapshot
 */
function clone_snapshot(snapshot) {
	return structuredClone(snapshot);
}
