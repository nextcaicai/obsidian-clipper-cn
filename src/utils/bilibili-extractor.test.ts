import { describe, expect, test, vi } from 'vitest';
import { parseHTML } from 'linkedom';

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
	extractBilibiliStructuredContent,
	isBilibiliVideoUrl,
	normalizeBilibiliSubtitleUrl,
	parseBilibiliUrl,
	resolveBilibiliPage
} from './bilibili-extractor';
import browser from './browser-polyfill';

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

	test('falls back to page-context player data when proxied player response has no subtitle tracks', async () => {
		const sendMessage = vi.mocked(browser.runtime.sendMessage);
		sendMessage.mockReset();
		sendMessage.mockImplementation(async (message: any) => {
			if (message.action === 'fetchBilibiliJson' && message.url.includes('/x/web-interface/view')) {
				return {
					success: true,
					data: {
						code: 0,
						data: {
							aid: 123,
							bvid: 'BV1cGigBQE6n',
							title: '测试视频',
							desc: '测试简介',
							cid: 456,
							pages: [{ page: 1, cid: 456, duration: 30, part: 'P1' }]
						}
					}
				};
			}
			if (message.action === 'fetchBilibiliJson' && message.url.includes('/x/player/wbi/v2')) {
				return {
					success: true,
					data: {
						code: 0,
						data: {
							subtitle: { subtitles: [] },
							view_points: []
						}
					}
				};
			}
			if (message.action === 'fetchBilibiliJsonViaMainWorld') {
				return {
					success: true,
					data: {
						code: 0,
						data: {
							subtitle: {
								subtitles: [{
									lan: 'ai-zh',
									lan_doc: '中文（自动生成）',
									subtitle_url: '//i0.hdslb.com/bfs/subtitle/test.json'
								}]
							},
							view_points: []
						}
					}
				};
			}
			if (message.action === 'fetchBilibiliJson' && message.url.includes('/bfs/subtitle/test.json')) {
				return {
					success: true,
					data: {
						body: [{ from: 1, to: 3, content: 'Safari 字幕' }]
					}
				};
			}
			throw new Error(`Unexpected message ${message.action}: ${message.url || ''}`);
		});

		const { document: doc } = parseHTML('<html><head><title>Bilibili</title></head><body></body></html>');
		Object.defineProperty(doc, 'URL', {
			value: 'https://www.bilibili.com/video/BV1cGigBQE6n/',
			configurable: true
		});

		const content = await extractBilibiliStructuredContent(doc as unknown as Document);

		expect(content?.transcriptText).toBe('Safari 字幕');
		expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
			action: 'fetchBilibiliJsonViaMainWorld'
		}));
	});
});
