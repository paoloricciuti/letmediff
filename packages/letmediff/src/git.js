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
 * @typedef {{ name: string, diff: string, created_at: Date }} GitCheckpointReference
 */

/**
 * @typedef {Record<string, GitCheckpointReference[]>} FutureEdits
 */

/**
 * @typedef {{ name: string, diff: string, created_at: Date, future_edits: FutureEdits }} GitCheckpoint
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
		const stats = node_fs.statSync(this.path);
		if (!stats.isDirectory()) {
			throw new Error(`Expected a directory path, got ${this.path}`);
		}

		const snapshot = clone_snapshot(
			toSnapshotSync({ fs: snapshot_fs, path: this.path }),
		);
		remove_entry(snapshot, '.git');

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
			await this.reset();
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
		await this.reset();
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
 * @param {GitCheckpoint} checkpoint
 */
function clone_checkpoint(checkpoint) {
	return structuredClone(checkpoint);
}

/**
 * @param {GitCheckpoint} checkpoint
 */
function checkpoint_reference(checkpoint) {
	return {
		name: checkpoint.name,
		diff: checkpoint.diff,
		created_at: checkpoint.created_at,
	};
}

function generated_checkpoint_name() {
	return `Final changes ${new Date().toISOString()}`;
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
