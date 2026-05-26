import * as git from 'isomorphic-git';
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { create_git_checkpoint_store } from './git.js';

function create_temp_dir() {
	return mkdtempSync(path.join(tmpdir(), 'letmediff-git-test-'));
}

/**
 * @param {string} dir
 * @param {string} filepath
 * @param {string | Uint8Array} content
 */
function write_fixture(dir, filepath, content) {
	const full_path = path.join(dir, filepath);
	mkdirSync(path.dirname(full_path), { recursive: true });
	writeFileSync(full_path, content);
}

describe('git checkpoint store', () => {
	test('snapshots a real directory into an in-memory git repo', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');
		write_fixture(dir, 'nested/b.txt', 'two\n');

		const store = await create_git_checkpoint_store(dir);
		const state = store.state();

		expect(state.path).toBe(dir);
		expect(state.baseline_commit).toEqual(expect.any(String));
		expect(state.checkpoints).toEqual([]);
		expect(state.fs.readFileSync(path.join(dir, 'a.txt'), 'utf8')).toBe(
			'one\n',
		);
		expect(await git.listFiles({ fs: state.fs, dir })).toEqual([
			'a.txt',
			'nested/b.txt',
		]);
	});

	test('stores a named diff and resets the in-memory repo to the current filesystem state', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');

		const store = await create_git_checkpoint_store(dir);
		const first_commit = store.state().baseline_commit;

		write_fixture(dir, 'a.txt', 'two\n');
		write_fixture(dir, 'b.txt', 'new\n');

		const checkpoint = await store.store_checkpoint('first');
		const state = store.state();

		expect(checkpoint.name).toBe('first');
		expect(checkpoint.created_at).toBeInstanceOf(Date);
		expect(checkpoint.future_edits).toEqual({});
		expect(checkpoint.diff).toContain('--- a/a.txt');
		expect(checkpoint.diff).toContain('+++ b/a.txt');
		expect(checkpoint.diff).toContain('-one');
		expect(checkpoint.diff).toContain('+two');
		expect(checkpoint.diff).toContain('+++ b/b.txt');
		expect(checkpoint.diff).toContain('+new');
		expect(state.baseline_commit).not.toBe(first_commit);
		expect(state.fs.readFileSync(path.join(dir, 'a.txt'), 'utf8')).toBe(
			'two\n',
		);
		expect(state.fs.readFileSync(path.join(dir, 'b.txt'), 'utf8')).toBe(
			'new\n',
		);
		expect(await git.listFiles({ fs: state.fs, dir })).toEqual([
			'a.txt',
			'b.txt',
		]);
	});

	test('reads all checkpoints and individual checkpoints', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');

		const store = await create_git_checkpoint_store(dir);
		write_fixture(dir, 'a.txt', 'two\n');
		await store.store_checkpoint('first');
		write_fixture(dir, 'a.txt', 'three\n');
		await store.store_checkpoint('second');

		const checkpoints = store.read_checkpoints();

		expect(checkpoints.map((checkpoint) => checkpoint.name)).toEqual([
			'first',
			'second',
		]);
		expect(store.read_checkpoint('second')?.diff).toContain('+three');
		expect(store.read_checkpoint('missing')).toBeNull();

		const first_checkpoint = checkpoints.at(0);
		if (!first_checkpoint) throw new Error('Expected first checkpoint');
		first_checkpoint.name = 'changed';
		expect(store.read_checkpoint('first')?.name).toBe('first');
	});

	test('stores a final checkpoint only when there are pending changes and no checkpoint exists', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');

		const store = await create_git_checkpoint_store(dir);

		expect(await store.merge_checkpoint_if_changed()).toBeNull();
		expect(store.read_checkpoints()).toEqual([]);

		write_fixture(dir, 'a.txt', 'two\n');

		const checkpoint = await store.merge_checkpoint_if_changed();
		if (!checkpoint) throw new Error('Expected checkpoint');

		expect(checkpoint.name).toMatch(
			/^Final changes \d{4}-\d{2}-\d{2}T.*Z$/,
		);
		expect(checkpoint.diff).toContain('+two');
		expect(store.read_checkpoints().map(({ name }) => name)).toEqual([
			checkpoint.name,
		]);
	});

	test('merges pending changes into the latest checkpoint when requested', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');

		const store = await create_git_checkpoint_store(dir);
		await store.store_checkpoint('first');
		write_fixture(dir, 'a.txt', 'two\n');

		const checkpoint = await store.merge_checkpoint_if_changed();
		const checkpoints = store.read_checkpoints();
		const first_checkpoint = checkpoints.at(0);
		if (!checkpoint) throw new Error('Expected checkpoint');
		if (!first_checkpoint) throw new Error('Expected first checkpoint');

		expect(checkpoint.name).toBe('first');
		expect(checkpoints.map(({ name }) => name)).toEqual(['first']);
		expect(first_checkpoint.diff).toContain('-one');
		expect(first_checkpoint.diff).toContain('+two');
	});

	test('merged checkpoints diff from the original checkpoint baseline', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');

		const store = await create_git_checkpoint_store(dir);
		write_fixture(dir, 'a.txt', 'two\n');
		await store.store_checkpoint('first');
		write_fixture(dir, 'a.txt', 'three\n');

		await store.merge_checkpoint_if_changed();
		const checkpoint = store.read_checkpoint('first');

		expect(checkpoint?.diff).toContain('-one');
		expect(checkpoint?.diff).not.toContain('-two');
		expect(checkpoint?.diff).toContain('+three');
	});

	test('tracks future checkpoints that further edit a file', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');
		write_fixture(dir, 'b.txt', 'one\n');

		const store = await create_git_checkpoint_store(dir);
		write_fixture(dir, 'a.txt', 'two\n');
		await store.store_checkpoint('first');
		write_fixture(dir, 'b.txt', 'two\n');
		await store.store_checkpoint('second');
		write_fixture(dir, 'a.txt', 'three\n');

		const third = await store.store_checkpoint('third');
		const first_checkpoint = store.read_checkpoint('first');

		expect(first_checkpoint?.future_edits).toEqual({
			'a.txt': [
				{
					name: 'third',
					diff: third.diff,
					created_at: third.created_at,
				},
			],
		});
		expect(store.read_checkpoint('second')?.future_edits).toEqual({});
		expect(third.future_edits).toEqual({});
	});

	test('tracks all future checkpoints that further edit a file', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');

		const store = await create_git_checkpoint_store(dir);
		write_fixture(dir, 'a.txt', 'two\n');
		await store.store_checkpoint('first');
		write_fixture(dir, 'a.txt', 'three\n');
		const second = await store.store_checkpoint('second');
		write_fixture(dir, 'a.txt', 'four\n');

		const third = await store.store_checkpoint('third');
		const first_checkpoint = store.read_checkpoint('first');
		const second_checkpoint = store.read_checkpoint('second');

		expect(first_checkpoint?.future_edits).toEqual({
			'a.txt': [
				{
					name: 'second',
					diff: second.diff,
					created_at: second.created_at,
				},
				{
					name: 'third',
					diff: third.diff,
					created_at: third.created_at,
				},
			],
		});
		expect(second_checkpoint?.future_edits).toEqual({
			'a.txt': [
				{
					name: 'third',
					diff: third.diff,
					created_at: third.created_at,
				},
			],
		});
		expect(third.future_edits).toEqual({});
	});

	test('stores multiple checkpoints by splitting the current diff by requested files', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');
		write_fixture(dir, 'b.txt', 'one\n');

		const store = await create_git_checkpoint_store(dir);
		write_fixture(dir, 'a.txt', 'two\n');
		write_fixture(dir, 'b.txt', 'two\n');

		const checkpoints = await store.store_checkpoints([
			{
				name: 'Task 1',
				description: 'Updated a because it belongs to task 1',
				files: ['./a.txt'],
			},
			{
				name: 'Task 2',
				description: 'Updated b because it belongs to task 2',
				files: ['./b.txt'],
			},
		]);

		expect(checkpoints.map(({ name }) => name)).toEqual(['Task 1', 'Task 2']);
		expect(checkpoints[0]?.description).toBe(
			'Updated a because it belongs to task 1',
		);
		expect(checkpoints[0]?.diff).toContain('--- a/a.txt');
		expect(checkpoints[0]?.diff).not.toContain('--- a/b.txt');
		expect(checkpoints[1]?.diff).toContain('--- a/b.txt');
		expect(checkpoints[1]?.diff).not.toContain('--- a/a.txt');
		expect(store.read_checkpoints().map(({ name }) => name)).toEqual([
			'Task 1',
			'Task 2',
		]);
		expect(await store.merge_checkpoint_if_changed()).toBeNull();
	});

	test('allows the same file in multiple bulk checkpoints and tracks future edits', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');

		const store = await create_git_checkpoint_store(dir);
		write_fixture(dir, 'a.txt', 'two\n');

		const checkpoints = await store.store_checkpoints([
			{ name: 'Task 1', description: 'First task', files: ['./a.txt'] },
			{ name: 'Task 2', description: 'Second task', files: ['a.txt'] },
		]);
		const first_checkpoint = store.read_checkpoint('Task 1');

		expect(checkpoints).toHaveLength(2);
		expect(first_checkpoint?.future_edits).toEqual({
			'a.txt': [
				{
					name: 'Task 2',
					description: 'Second task',
					diff: checkpoints[1]?.diff,
					created_at: checkpoints[1]?.created_at,
				},
			],
		});
	});

	test('records deleted files', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');
		write_fixture(dir, 'b.txt', 'two\n');

		const store = await create_git_checkpoint_store(dir);
		rmSync(path.join(dir, 'b.txt'));

		const checkpoint = await store.store_checkpoint('delete b');

		expect(checkpoint.diff).toContain('--- a/b.txt');
		expect(checkpoint.diff).toContain('+++ /dev/null');
		expect(checkpoint.diff).toContain('-two');
	});

	test('records binary changes without trying to create a text patch', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'image.bin', new Uint8Array([0, 1, 2]));

		const store = await create_git_checkpoint_store(dir);
		write_fixture(dir, 'image.bin', new Uint8Array([0, 3, 4]));

		const checkpoint = await store.store_checkpoint('binary');

		expect(checkpoint.diff).toContain('diff --git a/image.bin b/image.bin');
		expect(checkpoint.diff).toContain(
			'Binary files a/image.bin and b/image.bin differ',
		);
	});

	test('ignores a real .git directory when snapshotting', async () => {
		const dir = create_temp_dir();
		write_fixture(dir, 'a.txt', 'one\n');
		write_fixture(
			dir,
			'.git/config',
			'[letmediff-test]\n\tmarker = real-git-dir\n',
		);

		const store = await create_git_checkpoint_store(dir);
		const state = store.state();

		expect(state.fs.existsSync(path.join(dir, '.git'))).toBe(true);
		expect(
			state.fs.readFileSync(path.join(dir, '.git/HEAD'), 'utf8'),
		).toContain('refs/heads/main');
		expect(
			state.fs.readFileSync(path.join(dir, '.git/config'), 'utf8'),
		).not.toContain('real-git-dir');
		expect(await git.listFiles({ fs: state.fs, dir })).toEqual(['a.txt']);
	});

	test('throws when initialized with a non-directory path', async () => {
		const dir = create_temp_dir();
		const file_path = path.join(dir, 'file.txt');
		writeFileSync(file_path, 'content');

		await expect(create_git_checkpoint_store(file_path)).rejects.toThrow(
			'Expected a directory path',
		);
		expect(statSync(file_path).isFile()).toBe(true);
	});

	test('supports empty directories', async () => {
		const dir = create_temp_dir();

		const store = await create_git_checkpoint_store(dir);

		expect(store.state().baseline_commit).toEqual(expect.any(String));
		expect(await git.listFiles({ fs: store.state().fs, dir })).toEqual([]);
	});
});
