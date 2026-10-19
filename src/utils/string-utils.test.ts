import { describe, expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { getClippableImageUrl, normalizeImageSources } from './string-utils';

describe('getClippableImageUrl', () => {
	test.each(['https://cdnfile.sspai.com', 'http://cdnfile.sspai.com', '//cdnfile.sspai.com', 'https://CDNFILE.SSPAI.COM'])(
		'normalizes %s and preserves the exact image path, query, and fragment',
		host => {
			const suffix = '/article/photo.png?imageView2/2/w/1120&q=90#image';
			expect(getClippableImageUrl(host + suffix)).toBe('https://rssfile.sspai.com' + suffix);
		},
	);

	test.each([
		'https://rssfile.sspai.com/photo.png',
		'https://cdnfile.sspai.com.example.com/photo.png',
		'https://cdnfile.sspai.com@other.example/photo.png',
		'https://example.com/cdnfile.sspai.com/photo.png',
		'data:image/png;base64,AAAA',
		'assets/photo.png',
		'',
	])('preserves other URLs: %s', url => {
		expect(getClippableImageUrl(url)).toBe(url);
	});
});

describe('normalizeImageSources', () => {
	test('uses lazy-loaded image URLs before markdown extraction', () => {
		const { document } = parseHTML(`
			<article>
				<img src="https://mmbiz.qpic.cn/first.png" />
				<img src="" data-src="https://mmbiz.qpic.cn/second.png?wx_fmt=png&wx_lazy=1#imgIndex=2" />
				<img data-src="https://mmbiz.qpic.cn/third.png?wx_fmt=png&wx_lazy=1#imgIndex=3" />
			</article>
		`);

		normalizeImageSources(document as unknown as Document);

		const images = Array.from(document.querySelectorAll('img'));
		expect(images.map(img => img.getAttribute('src'))).toEqual([
			'https://mmbiz.qpic.cn/first.png',
			'https://mmbiz.qpic.cn/second.png?wx_fmt=png&wx_lazy=1#imgIndex=2',
			'https://mmbiz.qpic.cn/third.png?wx_fmt=png&wx_lazy=1#imgIndex=3',
		]);
	});
});
