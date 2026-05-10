import { describe, expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { normalizeImageSources } from './string-utils';

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
