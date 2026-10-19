import { createMarkdownContent as convertToMarkdown } from 'defuddle/full';
import { getClippableImageUrl } from './string-utils';

export function createMarkdownContent(content: string, url: string): string {
	if (!/cdnfile\.sspai\.com/i.test(content)) {
		return convertToMarkdown(content, url);
	}

	// Work on detached output HTML so clipping does not reload images on the
	// source page. Limit rewrites to image attributes, not links or body text.
	const container = document.createElement('div');
	container.innerHTML = content;
	let changed = false;
	container.querySelectorAll('img, picture source').forEach(image => {
		const src = image.getAttribute('src');
		if (src) {
			const normalizedSrc = getClippableImageUrl(src);
			if (src !== normalizedSrc) {
				image.setAttribute('src', normalizedSrc);
				changed = true;
			}
		}

		const srcset = image.getAttribute('srcset');
		if (srcset) {
			const normalizedSrcset = srcset.replace(
				/(^|,\s*)((?:https?:)?\/\/cdnfile\.sspai\.com)(?=\/|[?#]|\s|,|$)/gi,
				'$1https://rssfile.sspai.com',
			);
			if (srcset !== normalizedSrcset) {
				image.setAttribute('srcset', normalizedSrcset);
				changed = true;
			}
		}
	});

	return convertToMarkdown(changed ? container.innerHTML : content, url);
}
