import { describe, expect, test, vi } from 'vitest';

vi.mock('./browser-polyfill', () => ({
	default: {
		runtime: {
			sendMessage: vi.fn()
		}
	}
}));

import {
	buildBilibiliStructuredHtml,
	buildBilibiliTranscriptMarkdown,
	isBilibiliVideoUrl,
	normalizeBilibiliSubtitleUrl,
	parseBilibiliUrl,
	resolveBilibiliPage
} from './bilibili-extractor';

describe('bilibili extractor', () => {
	test('detects bilibili video pages', () => {
		expect(isBilibiliVideoUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(true);
		expect(isBilibiliVideoUrl('https://www.bilibili.com/video/av123456')).toBe(true);
		expect(isBilibiliVideoUrl('https://www.bilibili.com/read/cv123')).toBe(false);
	});

	test('parses bvid and page from url', () => {
		expect(parseBilibiliUrl('https://www.bilibili.com/video/BV1xx411c7mD?p=2')).toEqual({
			bvid: 'BV1xx411c7mD',
			aid: null,
			page: 2,
			hasExplicitPageParam: true
		});
	});

	test('parses aid style video urls', () => {
		expect(parseBilibiliUrl('https://www.bilibili.com/video/av170001')).toEqual({
			bvid: null,
			aid: 170001,
			page: 1,
			hasExplicitPageParam: false
		});
	});

	test('resolves current page cid from view api payload', () => {
		const pageData = resolveBilibiliPage({
			cid: 111,
			duration: 120,
			pages: [
				{ page: 1, cid: 111, duration: 120, part: 'P1' },
				{ page: 2, cid: 222, duration: 240, part: 'P2' }
			]
		}, 2);

		expect(pageData).toEqual({
			cid: 222,
			page: 2,
			part: 'P2',
			duration: 240
		});
	});

	test('normalizes protocol-relative subtitle urls', () => {
		expect(normalizeBilibiliSubtitleUrl('//i0.hdslb.com/subtitle.json')).toBe('https://i0.hdslb.com/subtitle.json');
		expect(normalizeBilibiliSubtitleUrl('https://i0.hdslb.com/subtitle.json')).toBe('https://i0.hdslb.com/subtitle.json');
	});

	test('groups transcript by chapters in markdown output', () => {
		const markdown = buildBilibiliTranscriptMarkdown(
			[
				{ from: 1, to: 3, content: '开场白' },
				{ from: 65, to: 70, content: '第二段' }
			],
			[
				{ title: '第一章', from: 0, to: 60 },
				{ title: '第二章', from: 60, to: 120 }
			]
		);

		expect(markdown).toContain('### 第一章');
		expect(markdown).toContain('`00:01` 开场白');
		expect(markdown).toContain('### 第二章');
		expect(markdown).toContain('`01:05` 第二段');
	});

	test('builds structured html without unrelated page fragments', () => {
		const html = buildBilibiliStructuredHtml({
			description: '这是简介',
			chapters: [
				{ title: '第一章', from: 0, to: 60 }
			],
			transcript: [
				{ from: 5, to: 10, content: '你好，世界' }
			]
		});

		expect(html).toContain('<h2>简介</h2>');
		expect(html).toContain('<h2>章节</h2>');
		expect(html).toContain('<h2>字幕</h2>');
		expect(html).toContain('你好，世界');
		expect(html).not.toContain('推荐视频');
		expect(html).not.toContain('评论');
	});

	test('builds clean html for videos without subtitles', () => {
		const html = buildBilibiliStructuredHtml({
			description: '仅保留简介和章节',
			chapters: [
				{ title: '第一章', from: 0, to: 60 }
			],
			transcript: []
		});

		expect(html).toContain('<h2>简介</h2>');
		expect(html).toContain('<h2>章节</h2>');
		expect(html).not.toContain('<h2>字幕</h2>');
	});
});
