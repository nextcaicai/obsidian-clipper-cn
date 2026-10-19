import { afterAll, describe, expect, test, vi } from 'vitest';

vi.hoisted(() => {
	const { DOMParser, parseHTML } = require('linkedom');
	// Turndown chooses its DOM parser when defuddle/full is first imported.
	vi.stubGlobal('window', { DOMParser });
	vi.stubGlobal('DOMParser', DOMParser);
	vi.stubGlobal('document', parseHTML('<html><body></body></html>').document);
});

import { createMarkdownContent } from './markdown-utils';

afterAll(() => vi.unstubAllGlobals());

describe('clipped Markdown images', () => {
	const path = '/2026/02/21/article/2b3a6fbdecd2b17f7f63cc84c6e70829.png';
	const query = '?imageView2/2/w/1120/q/90/interlace/1/ignore-error/1';
	const pageUrl = 'https://sspai.com/post/106477';

	test('uses the SSPAI RSS image host without losing quality parameters or captions', () => {
		const markdown = createMarkdownContent(
			`<figure><img src="https://cdnfile.sspai.com${path}${query}" alt="信息流主线"><figcaption>图 1：采集到回顾</figcaption></figure>`,
			pageUrl,
		);

		expect(markdown).toContain(`![信息流主线](https://rssfile.sspai.com${path}${query})`);
		expect(markdown).toContain('图 1：采集到回顾');
	});

	test('normalizes srcset because the Markdown converter prefers it over src', () => {
		const markdown = createMarkdownContent(
			`<img src="https://cdnfile.sspai.com${path}" srcset="//cdnfile.sspai.com${path}?width=560 560w, https://cdnfile.sspai.com${path}?width=1120 1120w" alt="示意图">`,
			pageUrl,
		);

		expect(markdown).toContain(`https://rssfile.sspai.com${path}?width=1120`);
		expect(markdown).not.toContain('cdnfile.sspai.com');
	});

	test('preserves article links and text that refer to the original CDN', () => {
		const url = `https://cdnfile.sspai.com${path}`;
		const markdown = createMarkdownContent(
			`<p>cdnfile.sspai.com</p><p><a href="${url}">原始链接</a></p><img src="${url}" alt="图片">`,
			pageUrl,
		);

		expect(markdown).toContain(`[原始链接](${url})`);
		expect(markdown).toContain('cdnfile.sspai.com');
		expect(markdown).toContain(`![图片](https://rssfile.sspai.com${path})`);
	});

	test('does not change unrelated, local, data, or lookalike image URLs', () => {
		for (const url of [
			'https://example.com/image.png?source=cdnfile.sspai.com',
			'https://cdnfile.sspai.com.example.com/image.png',
			'https://example.com/cdnfile.sspai.com/image.png',
			'data:image/png;base64,AAAA',
		]) {
			const markdown = createMarkdownContent(`<img src="${url}" alt="图片">`, pageUrl);
			expect(markdown).toContain(url);
		}
		const markdown = createMarkdownContent('<img src="/image.png" alt="图片">', pageUrl);
		expect(markdown).toContain('![图片](/image.png)');
	});
});
