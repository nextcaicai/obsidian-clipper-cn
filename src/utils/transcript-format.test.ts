import { describe, expect, test } from 'vitest';
import { formatTranscriptForReading } from './transcript-format';

describe('formatTranscriptForReading', () => {
	test('groups timestamped Chinese cues and keeps one timestamp per paragraph', () => {
		const transcript = [
			'### 引言',
			'',
			'- `00:00` 这是一段口播',
			'- `00:02` 继续说同一段',
			'- `00:04` 这里结束。',
			'- `00:12` 开始下一段'
		].join('\n');

		expect(formatTranscriptForReading(transcript)).toBe([
			'### 引言',
			'',
			'00:00 这是一段口播继续说同一段这里结束。',
			'',
			'00:12 开始下一段。'
		].join('\n'));
	});

	test('preserves English word spacing and linked timestamp labels', () => {
		const transcript = [
			'- [00:00](https://video.example/?t=0) Build a small tool',
			'- [00:03](https://video.example/?t=3) with a clear interface.'
		].join('\n');

		expect(formatTranscriptForReading(transcript)).toBe('00:00 Build a small tool with a clear interface.');
	});

	test('starts a new paragraph when cues are far apart or the paragraph gets long', () => {
		const transcript = [
			'- 00:00 First phrase',
			'- 00:02 second phrase',
			'- 00:10 next section'
		].join('\n');

		expect(formatTranscriptForReading(transcript)).toBe('00:00 First phrase second phrase.\n\n00:10 next section.');
	});

	test('adds local punctuation around estimated pauses', () => {
		const transcript = [
			'- 00:00 我们先看一下',
			'- 00:03 接下来继续讲'
		].join('\n');

		expect(formatTranscriptForReading(transcript)).toBe('00:00 我们先看一下，接下来继续讲。');
	});

	test('returns null for content without multiple timestamped cues', () => {
		expect(formatTranscriptForReading('No transcript here')).toBeNull();
		expect(formatTranscriptForReading('- 00:00 Only one cue')).toBeNull();
	});

	test('breaks overlong paragraphs even when cue timestamps are close', () => {
		const transcript = [
			'- 00:00 ' + 'a'.repeat(100),
			'- 00:02 ' + 'b'.repeat(100)
		].join('\n');

		expect(formatTranscriptForReading(transcript)).toBe(`00:00 ${'a'.repeat(100)}.\n\n00:02 ${'b'.repeat(100)}.`);
	});
});
