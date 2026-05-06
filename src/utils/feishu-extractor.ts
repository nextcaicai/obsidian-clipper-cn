import browser from './browser-polyfill';
import { createLogger } from './logger';

const logger = createLogger('Feishu');

export interface FeishuParsedUrl {
	type: 'wiki' | 'docx' | 'doc' | null;
	token: string | null;
}

export interface FeishuStructuredContent {
	title: string;
	author: string;
	content: string;
	wordCount: number;
}

interface FeishuTextElement {
	content?: string;
	text_element_style?: {
		bold?: boolean;
		italic?: boolean;
		strikethrough?: boolean;
		underline?: boolean;
		inline_code?: boolean;
		link?: { url?: string };
	};
}

interface FeishuTextRun {
	content?: string;
	text_element_style?: FeishuTextElement['text_element_style'];
}

interface FeishuMentionUser {
	user_id?: string;
	text_element_style?: FeishuTextElement['text_element_style'];
}

interface FeishuTextBody {
	elements?: Array<{
		text_run?: FeishuTextRun;
		mention_user?: FeishuMentionUser;
		mention_doc?: { token?: string; title?: string; obj_type?: number; text_element_style?: FeishuTextElement['text_element_style'] };
		equation?: { content?: string };
	}>;
	style?: {
		align?: number; // 1=left, 2=center, 3=right
		list?: {
			type?: string; // "number" | "bullet" | "checkBox"
			indentLevel?: number;
			number?: number;
		};
		quote?: boolean;
	};
}

interface FeishuBlock {
	block_id: string;
	parent_id?: string;
	children?: string[];
	block_type: number;
	page?: { elements?: FeishuTextBody['elements']; style?: FeishuTextBody['style'] };
	text?: FeishuTextBody;
	heading1?: FeishuTextBody;
	heading2?: FeishuTextBody;
	heading3?: FeishuTextBody;
	heading4?: FeishuTextBody;
	heading5?: FeishuTextBody;
	heading6?: FeishuTextBody;
	heading7?: FeishuTextBody;
	heading8?: FeishuTextBody;
	heading9?: FeishuTextBody;
	bullet?: FeishuTextBody;
	ordered?: FeishuTextBody;
	code?: FeishuTextBody & { style?: FeishuTextBody['style'] & { language?: number; wrap?: boolean } };
	quote?: FeishuTextBody;
	todo?: FeishuTextBody & { style?: FeishuTextBody['style'] & { done?: boolean } };
	callout?: FeishuTextBody & { style?: FeishuTextBody['style'] & { background_color?: number; emoji_id?: string } };
	quote_container?: object;
	divider?: object;
	image?: { width?: number; height?: number; token?: string };
	table?: { cells?: string[]; property?: { row_size?: number; column_size?: number; merge_info?: Array<{ row_span?: number; col_span?: number }> } };
	table_cell?: object;
	grid?: { column_size?: number };
	grid_column?: object;
	file?: { name?: string; token?: string };
	view?: object;
	undefined_block?: object;
}

const FEISHU_BLOCK_TYPE = {
	PAGE: 1,
	TEXT: 2,
	HEADING1: 3,
	HEADING2: 4,
	HEADING3: 5,
	HEADING4: 6,
	HEADING5: 7,
	HEADING6: 8,
	HEADING7: 9,
	HEADING8: 10,
	HEADING9: 11,
	BULLET: 12,
	ORDERED: 13,
	CODE: 14,
	QUOTE: 15,
	TODO: 17,
	CALLOUT: 19,
	CHAT_CARD: 20,
	DIAGRAM: 21,
	DIVIDER: 22,
	FILE: 23,
	GRID: 24,
	GRID_COLUMN: 25,
	IFRAME: 26,
	IMAGE: 27,
	WIDGET: 28,
	MINDNOTE: 29,
	SHEET: 30,
	TABLE: 31,
	TABLE_CELL: 32,
	VIEW: 33,
	QUOTE_CONTAINER: 34,
} as const;

export function isFeishuDocUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		const isFeishuHost = parsed.hostname.endsWith('.feishu.cn') || parsed.hostname.endsWith('.larksuite.com');
		if (!isFeishuHost) return false;
		return /^\/(wiki|docx|docs?)\/[\w-]+/.test(parsed.pathname);
	} catch {
		return false;
	}
}

export function parseFeishuUrl(url: string): FeishuParsedUrl {
	try {
		const parsed = new URL(url);
		const match = parsed.pathname.match(/^\/(wiki|docx|docs?)\/([\w-]+)/);
		if (!match) return { type: null, token: null };
		const rawType = match[1];
		const normalizedType = (rawType === 'docs' ? 'doc' : rawType) as 'wiki' | 'docx' | 'doc';
		return {
			type: normalizedType,
			token: match[2],
		};
	} catch {
		return { type: null, token: null };
	}
}

async function fetchFeishuApi(url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<any> {
	const response = await browser.runtime.sendMessage({
		action: 'fetchFeishuApi',
		url,
		options,
	}) as { success?: boolean; data?: any; error?: string };

	if (!response?.success) {
		const errMsg = response?.error || 'Failed to fetch Feishu API';
		logger.warn('API request failed', { error: errMsg, url });
		throw new Error(errMsg);
	}
	return response.data;
}

// ─── Cookie-based image URL generation ───────────────────────────────────────
// Ported from cloud-document-converter (MIT license)
// https://github.com/whale4113/cloud-document-converter

function _feishuMd5Hex(input: string): string {
	function add32(a: number, b: number): number {
		const lo = (a & 0xffff) + (b & 0xffff);
		return ((a >> 16) + (b >> 16) + (lo >> 16)) << 16 | (lo & 0xffff);
	}
	function rol32(n: number, s: number): number { return n << s | n >>> (32 - s); }
	function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
		return add32(rol32(add32(add32(b, q), add32(x, t)), s), a);
	}
	function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b & c | ~b & d, a, b, x, s, t); }
	function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b & d | c & ~d, a, b, x, s, t); }
	function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
	function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

	// UTF-8 encode
	const utf8 = unescape(encodeURIComponent(input));
	const bitLen = utf8.length * 8;

	// Pack string into 32-bit word array
	const words: number[] = [];
	for (let i = 0; i < bitLen; i += 8) {
		words[i >> 5] = (words[i >> 5] || 0) | (utf8.charCodeAt(i / 8) & 0xff) << (i % 32);
	}
	// Append padding bit and length
	words[bitLen >> 5] = (words[bitLen >> 5] || 0) | 0x80 << (bitLen % 32);
	words[14 + ((bitLen + 64 >>> 9) << 4)] = bitLen;

	// MD5 compression
	let h0 = 1732584193, h1 = -271733879, h2 = -1732584194, h3 = 271733878;
	for (let n = 0; n < words.length; n += 16) {
		const [a0, b0, c0, d0] = [h0, h1, h2, h3];
		const w = (i: number) => words[n + i] || 0;
		h0 = ff(h0,h1,h2,h3,w(0),7,-680876936); h3=ff(h3,h0,h1,h2,w(1),12,-389564586);
		h2=ff(h2,h3,h0,h1,w(2),17,606105819); h1=ff(h1,h2,h3,h0,w(3),22,-1044525330);
		h0=ff(h0,h1,h2,h3,w(4),7,-176418897); h3=ff(h3,h0,h1,h2,w(5),12,1200080426);
		h2=ff(h2,h3,h0,h1,w(6),17,-1473231341); h1=ff(h1,h2,h3,h0,w(7),22,-45705983);
		h0=ff(h0,h1,h2,h3,w(8),7,1770035416); h3=ff(h3,h0,h1,h2,w(9),12,-1958414417);
		h2=ff(h2,h3,h0,h1,w(10),17,-42063); h1=ff(h1,h2,h3,h0,w(11),22,-1990404162);
		h0=ff(h0,h1,h2,h3,w(12),7,1804603682); h3=ff(h3,h0,h1,h2,w(13),12,-40341101);
		h2=ff(h2,h3,h0,h1,w(14),17,-1502002290); h1=ff(h1,h2,h3,h0,w(15),22,1236535329);
		h0=gg(h0,h1,h2,h3,w(1),5,-165796510); h3=gg(h3,h0,h1,h2,w(6),9,-1069501632);
		h2=gg(h2,h3,h0,h1,w(11),14,643717713); h1=gg(h1,h2,h3,h0,w(0),20,-373897302);
		h0=gg(h0,h1,h2,h3,w(5),5,-701558691); h3=gg(h3,h0,h1,h2,w(10),9,38016083);
		h2=gg(h2,h3,h0,h1,w(15),14,-660478335); h1=gg(h1,h2,h3,h0,w(4),20,-405537848);
		h0=gg(h0,h1,h2,h3,w(9),5,568446438); h3=gg(h3,h0,h1,h2,w(14),9,-1019803690);
		h2=gg(h2,h3,h0,h1,w(3),14,-187363961); h1=gg(h1,h2,h3,h0,w(8),20,1163531501);
		h0=gg(h0,h1,h2,h3,w(13),5,-1444681467); h3=gg(h3,h0,h1,h2,w(2),9,-51403784);
		h2=gg(h2,h3,h0,h1,w(7),14,1735328473); h1=gg(h1,h2,h3,h0,w(12),20,-1926607734);
		h0=hh(h0,h1,h2,h3,w(5),4,-378558); h3=hh(h3,h0,h1,h2,w(8),11,-2022574463);
		h2=hh(h2,h3,h0,h1,w(11),16,1839030562); h1=hh(h1,h2,h3,h0,w(14),23,-35309556);
		h0=hh(h0,h1,h2,h3,w(1),4,-1530992060); h3=hh(h3,h0,h1,h2,w(4),11,1272893353);
		h2=hh(h2,h3,h0,h1,w(7),16,-155497632); h1=hh(h1,h2,h3,h0,w(10),23,-1094730640);
		h0=hh(h0,h1,h2,h3,w(13),4,681279174); h3=hh(h3,h0,h1,h2,w(0),11,-358537222);
		h2=hh(h2,h3,h0,h1,w(3),16,-722521979); h1=hh(h1,h2,h3,h0,w(6),23,76029189);
		h0=hh(h0,h1,h2,h3,w(9),4,-640364487); h3=hh(h3,h0,h1,h2,w(12),11,-421815835);
		h2=hh(h2,h3,h0,h1,w(15),16,530742520); h1=hh(h1,h2,h3,h0,w(2),23,-995338651);
		h0=ii(h0,h1,h2,h3,w(0),6,-198630844); h3=ii(h3,h0,h1,h2,w(7),10,1126891415);
		h2=ii(h2,h3,h0,h1,w(14),15,-1416354905); h1=ii(h1,h2,h3,h0,w(5),21,-57434055);
		h0=ii(h0,h1,h2,h3,w(12),6,1700485571); h3=ii(h3,h0,h1,h2,w(3),10,-1894986606);
		h2=ii(h2,h3,h0,h1,w(10),15,-1051523); h1=ii(h1,h2,h3,h0,w(1),21,-2054922799);
		h0=ii(h0,h1,h2,h3,w(8),6,1873313359); h3=ii(h3,h0,h1,h2,w(15),10,-30611744);
		h2=ii(h2,h3,h0,h1,w(6),15,-1560198380); h1=ii(h1,h2,h3,h0,w(13),21,1309151649);
		h0=ii(h0,h1,h2,h3,w(4),6,-145523070); h3=ii(h3,h0,h1,h2,w(11),10,-1120210379);
		h2=ii(h2,h3,h0,h1,w(2),15,718787259); h1=ii(h1,h2,h3,h0,w(9),21,-343485551);
		h0=add32(h0,a0); h1=add32(h1,b0); h2=add32(h2,c0); h3=add32(h3,d0);
	}

	// Words to binary string to hex
	const hex = '0123456789abcdef';
	let result = '';
	for (const word of [h0, h1, h2, h3]) {
		for (let i = 0; i < 4; i++) {
			const byte = (word >>> (i * 8)) & 0xff;
			result += hex[byte >>> 4] + hex[byte & 0xf];
		}
	}
	return result;
}

function _feishuRandomSeed(len: number): string {
	const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	let result = '';
	for (let i = 0; i < len; i++) {
		result += chars[Math.floor(Math.random() * chars.length)];
	}
	return result;
}

function feishuEncodeToken(token: string): string {
	const t = Math.round(Date.now() / 1000);
	const n = t + 3600;
	const r = `${t}:${n}`;
	const tokenStr = `Token:${token}`;
	const s = _feishuRandomSeed(32);
	const hash = _feishuMd5Hex(`${s}_${tokenStr}_${r}_V4`);
	return `${hash}_${s}_${tokenStr}_${r}_V4`;
}

function feishuBase64Url(str: string): string {
	return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getFeishuImageApiBase(): string {
	if (typeof window === 'undefined') return '';
	const host = (window as any).local?.apiHost ?? ('https://' + location.host);
	return host + '/space';
}

function getCsrfToken(): string {
	if (typeof document === 'undefined') return '';
	const match = /(?:^|;)\s*_csrf_token=([^;]+)/.exec(document.cookie);
	return match ? decodeURIComponent(match[1]) : '';
}

function generateFeishuInternalImageUrl(token: string): string {
	const encoded = feishuBase64Url(feishuEncodeToken(token));
	return `${getFeishuImageApiBase()}/api/box/stream/download/asynccode/?code=${encoded}`;
}

async function activateFeishuImageUrls(tokenToCode: Record<string, string>): Promise<boolean> {
	if (typeof fetch === 'undefined' || typeof location === 'undefined') return false;
	try {
		const base = (window as any).local?.apiHost ?? ('https://' + location.host);
		const url = `${base}/space/api/docx/resources/copy_out`;
		const csrf = getCsrfToken();
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (csrf) headers['X-Csrftoken'] = csrf;
		const res = await fetch(url, {
			method: 'POST',
			headers,
			credentials: 'include',
			body: JSON.stringify({ tokens: tokenToCode }),
		});
		const data = await res.json() as { code?: number };
		return data.code === 0;
	} catch {
		return false;
	}
}
// ─── End cookie-based image URL generation ───────────────────────────────────

async function fetchFeishuImageDataUrl(fileToken: string): Promise<string | null> {
	try {
		const response = await browser.runtime.sendMessage({
			action: 'fetchFeishuImage',
			fileToken,
		}) as { success?: boolean; dataUrl?: string; error?: string };

		if (!response?.success || !response.dataUrl) {
			logger.warn(`Image binary fetch failed [${fileToken}]: ${response?.error}`);
			return null;
		}
		return response.dataUrl;
	} catch (err) {
		logger.warn(`Image binary fetch error [${fileToken}]: ${String(err)}`);
		return null;
	}
}

async function resolveFeishuImages(html: string): Promise<string> {
	const tokenPattern = /feishu-image:\/\/([A-Za-z0-9_-]+)/g;
	const tokens = new Set<string>();
	let match: RegExpExecArray | null;

	while ((match = tokenPattern.exec(html)) !== null) {
		tokens.add(match[1]);
	}

	if (tokens.size === 0) return html;

	const tokenList = Array.from(tokens);
	logger.debug(`Resolving ${tokenList.length} Feishu image(s)`);

	// Strategy 1: cookie-based internal URL (works for any doc the user can view, no credentials needed)
	const cookieUrls = new Map<string, string>();
	if (typeof window !== 'undefined' && getFeishuImageApiBase()) {
		const tokenToCode: Record<string, string> = {};
		for (const token of tokenList) {
			const code = feishuBase64Url(feishuEncodeToken(token));
			tokenToCode[token] = code;
			cookieUrls.set(token, `${getFeishuImageApiBase()}/api/box/stream/download/asynccode/?code=${code}`);
		}
		// Activate the URLs so they're accessible (uses browser session cookies)
		await activateFeishuImageUrls(tokenToCode);
	}

	// Strategy 2: for tokens not resolved via cookie URL, fall back to Open Platform API binary download
	const missingTokens = tokenList.filter(t => !cookieUrls.has(t));
	const base64Results = new Map<string, string>();

	if (missingTokens.length > 0) {
		logger.debug(`Falling back to binary download for ${missingTokens.length} image(s)`);
		await Promise.all(
			missingTokens.map(async (token) => {
				const dataUrl = await fetchFeishuImageDataUrl(token);
				if (dataUrl) {
					base64Results.set(token, dataUrl);
				}
			})
		);
	}

	let resolved = html;
	for (const token of tokenList) {
		const replacement = cookieUrls.get(token) || base64Results.get(token);
		if (replacement) {
			resolved = resolved.split(`feishu-image://${token}`).join(replacement);
		} else {
			logger.warn(`Could not resolve image [${token}]`);
		}
	}

	return resolved;
}

async function resolveDocumentId(parsedUrl: FeishuParsedUrl): Promise<{ documentId: string; objType: string } | null> {
	if (!parsedUrl.token) return null;

	if (parsedUrl.type === 'wiki') {
		const result = await fetchFeishuApi(
			`https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${parsedUrl.token}`
		);
		const node = result?.data?.node;
		if (!node?.obj_token) {
			logger.warn('Wiki get_node returned no obj_token', { result });
			return null;
		}
		return { documentId: node.obj_token, objType: node.obj_type || 'docx' };
	}

	return { documentId: parsedUrl.token, objType: parsedUrl.type === 'doc' ? 'doc' : 'docx' };
}

async function fetchAllBlocks(documentId: string): Promise<FeishuBlock[]> {
	const allBlocks: FeishuBlock[] = [];
	let pageToken: string | undefined;

	do {
		const params = new URLSearchParams({ page_size: '500', document_revision_id: '-1' });
		if (pageToken) params.set('page_token', pageToken);

		const result = await fetchFeishuApi(
			`https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks?${params.toString()}`
		);

		const items = result?.data?.items;
		if (Array.isArray(items)) {
			allBlocks.push(...items);
		}

		pageToken = result?.data?.has_more ? result.data.page_token : undefined;
	} while (pageToken);

	return allBlocks;
}

async function fetchDocumentMeta(documentId: string): Promise<{ title: string; owner?: string } | null> {
	try {
		const result = await fetchFeishuApi(
			`https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}`
		);
		const doc = result?.data?.document;
		return doc ? { title: doc.title || '', owner: doc.owner_id } : null;
	} catch {
		return null;
	}
}

function renderTextElements(elements: FeishuTextBody['elements']): string {
	if (!elements || !elements.length) return '';

	return elements.map((el) => {
		if (el.equation?.content) {
			return `<code>${escapeHtml(el.equation.content)}</code>`;
		}

		if (el.mention_doc?.title) {
			return escapeHtml(el.mention_doc.title);
		}

		const run = el.text_run || el.mention_user;
		if (!run) return '';

		const text = el.text_run?.content ?? '';
		if (!text) return '';

		const style = run.text_element_style;
		let html = escapeHtml(text);

		if (style?.inline_code) {
			html = `<code>${html}</code>`;
		}
		if (style?.bold) {
			html = `<strong>${html}</strong>`;
		}
		if (style?.italic) {
			html = `<em>${html}</em>`;
		}
		if (style?.strikethrough) {
			html = `<s>${html}</s>`;
		}
		if (style?.underline) {
			html = `<u>${html}</u>`;
		}
		if (style?.link?.url) {
			try {
				const decoded = decodeURIComponent(style.link.url);
				html = `<a href="${escapeAttr(decoded)}">${html}</a>`;
			} catch {
				html = `<a href="${escapeAttr(style.link.url)}">${html}</a>`;
			}
		}

		return html;
	}).join('');
}

function getTextBody(block: FeishuBlock): FeishuTextBody | undefined {
	switch (block.block_type) {
		case FEISHU_BLOCK_TYPE.TEXT: return block.text;
		case FEISHU_BLOCK_TYPE.HEADING1: return block.heading1;
		case FEISHU_BLOCK_TYPE.HEADING2: return block.heading2;
		case FEISHU_BLOCK_TYPE.HEADING3: return block.heading3;
		case FEISHU_BLOCK_TYPE.HEADING4: return block.heading4;
		case FEISHU_BLOCK_TYPE.HEADING5: return block.heading5;
		case FEISHU_BLOCK_TYPE.HEADING6: return block.heading6;
		case FEISHU_BLOCK_TYPE.HEADING7: return block.heading7;
		case FEISHU_BLOCK_TYPE.HEADING8: return block.heading8;
		case FEISHU_BLOCK_TYPE.HEADING9: return block.heading9;
		case FEISHU_BLOCK_TYPE.BULLET: return block.bullet;
		case FEISHU_BLOCK_TYPE.ORDERED: return block.ordered;
		case FEISHU_BLOCK_TYPE.CODE: return block.code;
		case FEISHU_BLOCK_TYPE.QUOTE: return block.quote;
		case FEISHU_BLOCK_TYPE.TODO: return block.todo;
		case FEISHU_BLOCK_TYPE.CALLOUT: return block.callout;
		default: return undefined;
	}
}

function convertBlocksToHtml(blocks: FeishuBlock[]): string {
	const blockMap = new Map<string, FeishuBlock>();
	for (const b of blocks) {
		blockMap.set(b.block_id, b);
	}

	const pageBlock = blocks.find(b => b.block_type === FEISHU_BLOCK_TYPE.PAGE);
	if (!pageBlock?.children?.length) {
		return blocks.filter(b => b.block_type !== FEISHU_BLOCK_TYPE.PAGE)
			.map(b => renderBlock(b, blockMap))
			.join('');
	}

	return renderChildren(pageBlock.children, blockMap);
}

function renderChildren(childIds: string[], blockMap: Map<string, FeishuBlock>): string {
	const parts: string[] = [];
	let i = 0;

	while (i < childIds.length) {
		const block = blockMap.get(childIds[i]);
		if (!block) { i++; continue; }

		if (block.block_type === FEISHU_BLOCK_TYPE.BULLET) {
			const listItems: string[] = [];
			while (i < childIds.length) {
				const b = blockMap.get(childIds[i]);
				if (!b || b.block_type !== FEISHU_BLOCK_TYPE.BULLET) break;
				listItems.push(renderListItem(b, blockMap));
				i++;
			}
			parts.push(`<ul>${listItems.join('')}</ul>`);
			continue;
		}

		if (block.block_type === FEISHU_BLOCK_TYPE.ORDERED) {
			const listItems: string[] = [];
			while (i < childIds.length) {
				const b = blockMap.get(childIds[i]);
				if (!b || b.block_type !== FEISHU_BLOCK_TYPE.ORDERED) break;
				listItems.push(renderListItem(b, blockMap));
				i++;
			}
			parts.push(`<ol>${listItems.join('')}</ol>`);
			continue;
		}

		if (block.block_type === FEISHU_BLOCK_TYPE.TODO) {
			const listItems: string[] = [];
			while (i < childIds.length) {
				const b = blockMap.get(childIds[i]);
				if (!b || b.block_type !== FEISHU_BLOCK_TYPE.TODO) break;
				const done = (b.todo as any)?.style?.done === true;
				const inner = renderTextElements(b.todo?.elements);
				const checkbox = done ? '[x] ' : '[ ] ';
				listItems.push(`<li>${escapeHtml(checkbox)}${inner}${renderBlockChildren(b, blockMap)}</li>`);
				i++;
			}
			parts.push(`<ul class="feishu-todo">${listItems.join('')}</ul>`);
			continue;
		}

		parts.push(renderBlock(block, blockMap));
		i++;
	}

	return parts.join('');
}

function renderListItem(block: FeishuBlock, blockMap: Map<string, FeishuBlock>): string {
	const body = getTextBody(block);
	const inner = renderTextElements(body?.elements);
	const children = renderBlockChildren(block, blockMap);
	return `<li>${inner}${children}</li>`;
}

function renderBlockChildren(block: FeishuBlock, blockMap: Map<string, FeishuBlock>): string {
	if (!block.children?.length) return '';
	return renderChildren(block.children, blockMap);
}

function renderBlock(block: FeishuBlock, blockMap: Map<string, FeishuBlock>): string {
	switch (block.block_type) {
		case FEISHU_BLOCK_TYPE.PAGE:
			return renderBlockChildren(block, blockMap);

		case FEISHU_BLOCK_TYPE.TEXT: {
			const inner = renderTextElements(block.text?.elements);
			if (!inner.trim()) return '';
			return `<p>${inner}</p>`;
		}

		case FEISHU_BLOCK_TYPE.HEADING1:
			return `<h1>${renderTextElements(block.heading1?.elements)}</h1>`;
		case FEISHU_BLOCK_TYPE.HEADING2:
			return `<h2>${renderTextElements(block.heading2?.elements)}</h2>`;
		case FEISHU_BLOCK_TYPE.HEADING3:
			return `<h3>${renderTextElements(block.heading3?.elements)}</h3>`;
		case FEISHU_BLOCK_TYPE.HEADING4:
			return `<h4>${renderTextElements(block.heading4?.elements)}</h4>`;
		case FEISHU_BLOCK_TYPE.HEADING5:
			return `<h5>${renderTextElements(block.heading5?.elements)}</h5>`;
		case FEISHU_BLOCK_TYPE.HEADING6:
			return `<h6>${renderTextElements(block.heading6?.elements)}</h6>`;
		case FEISHU_BLOCK_TYPE.HEADING7:
		case FEISHU_BLOCK_TYPE.HEADING8:
		case FEISHU_BLOCK_TYPE.HEADING9: {
			const body = getTextBody(block);
			return `<h6>${renderTextElements(body?.elements)}</h6>`;
		}

		case FEISHU_BLOCK_TYPE.BULLET:
			return `<ul>${renderListItem(block, blockMap)}</ul>`;
		case FEISHU_BLOCK_TYPE.ORDERED:
			return `<ol>${renderListItem(block, blockMap)}</ol>`;

		case FEISHU_BLOCK_TYPE.CODE: {
			const inner = renderTextElements(block.code?.elements);
			return `<pre><code>${inner}</code></pre>`;
		}

		case FEISHU_BLOCK_TYPE.QUOTE: {
			const inner = renderTextElements(block.quote?.elements);
			return `<blockquote><p>${inner}</p></blockquote>`;
		}

		case FEISHU_BLOCK_TYPE.QUOTE_CONTAINER: {
			const children = renderBlockChildren(block, blockMap);
			return `<blockquote>${children}</blockquote>`;
		}

		case FEISHU_BLOCK_TYPE.TODO: {
			const done = (block.todo as any)?.style?.done === true;
			const inner = renderTextElements(block.todo?.elements);
			const checkbox = done ? '[x] ' : '[ ] ';
			return `<ul class="feishu-todo"><li>${escapeHtml(checkbox)}${inner}</li></ul>`;
		}

		case FEISHU_BLOCK_TYPE.CALLOUT: {
			const inner = renderTextElements(block.callout?.elements);
			const children = renderBlockChildren(block, blockMap);
			return `<blockquote class="feishu-callout">${inner ? `<p>${inner}</p>` : ''}${children}</blockquote>`;
		}

		case FEISHU_BLOCK_TYPE.DIVIDER:
			return '<hr>';

		case FEISHU_BLOCK_TYPE.IMAGE: {
			const img = block.image;
			if (img?.token) {
				return `<figure><img src="feishu-image://${img.token}" alt="" width="${img.width || ''}" height="${img.height || ''}"></figure>`;
			}
			return '';
		}

		case FEISHU_BLOCK_TYPE.FILE: {
			const file = block.file;
			if (file?.name) {
				return `<p>[File: ${escapeHtml(file.name)}]</p>`;
			}
			return '';
		}

		case FEISHU_BLOCK_TYPE.TABLE: {
			return renderTable(block, blockMap);
		}

		case FEISHU_BLOCK_TYPE.GRID: {
			return renderBlockChildren(block, blockMap);
		}

		case FEISHU_BLOCK_TYPE.GRID_COLUMN: {
			return renderBlockChildren(block, blockMap);
		}

		case FEISHU_BLOCK_TYPE.IFRAME:
		case FEISHU_BLOCK_TYPE.WIDGET:
		case FEISHU_BLOCK_TYPE.SHEET:
		case FEISHU_BLOCK_TYPE.MINDNOTE:
		case FEISHU_BLOCK_TYPE.DIAGRAM:
		case FEISHU_BLOCK_TYPE.CHAT_CARD:
			return `<p>[Embedded content: type ${block.block_type}]</p>`;

		default:
			return '';
	}
}

function renderTable(block: FeishuBlock, blockMap: Map<string, FeishuBlock>): string {
	const table = block.table;
	if (!table?.property) return '';

	const rowSize = table.property.row_size || 0;
	const colSize = table.property.column_size || 0;
	const cellIds = block.children || [];

	if (!rowSize || !colSize || !cellIds.length) return '';

	const rows: string[] = [];
	for (let r = 0; r < rowSize; r++) {
		const cells: string[] = [];
		for (let c = 0; c < colSize; c++) {
			const idx = r * colSize + c;
			const cellId = cellIds[idx];
			const cellBlock = cellId ? blockMap.get(cellId) : undefined;
			const tag = r === 0 ? 'th' : 'td';
			if (cellBlock?.children?.length) {
				const content = renderChildren(cellBlock.children, blockMap);
				cells.push(`<${tag}>${content}</${tag}>`);
			} else {
				cells.push(`<${tag}></${tag}>`);
			}
		}
		rows.push(`<tr>${cells.join('')}</tr>`);
	}

	return `<table>${rows.join('')}</table>`;
}

export async function extractFeishuStructuredContent(doc: Document): Promise<FeishuStructuredContent | null> {
	if (!isFeishuDocUrl(doc.URL)) return null;

	const parsedUrl = parseFeishuUrl(doc.URL);
	if (!parsedUrl.token || !parsedUrl.type) {
		logger.warn('Failed to parse URL', { url: doc.URL });
		return null;
	}

	const resolved = await resolveDocumentId(parsedUrl);
	if (!resolved) {
		logger.warn('Failed to resolve document ID', { token: parsedUrl.token, type: parsedUrl.type });
		return null;
	}

	logger.debug('Resolved document', { documentId: resolved.documentId, objType: resolved.objType });

	const [blocks, meta] = await Promise.all([
		fetchAllBlocks(resolved.documentId),
		fetchDocumentMeta(resolved.documentId),
	]);

	if (!blocks.length) {
		logger.warn('No blocks returned', { documentId: resolved.documentId });
		return null;
	}

	logger.info('Extraction complete', { documentId: resolved.documentId, blockCount: blocks.length });

	const rawContent = convertBlocksToHtml(blocks);
	const content = await resolveFeishuImages(rawContent);
	const title = meta?.title || doc.title || '';

	const textContent = blocks
		.map(b => {
			const body = getTextBody(b);
			if (!body?.elements) return '';
			return body.elements
				.map(el => el.text_run?.content || '')
				.join('');
		})
		.join('\n')
		.trim();

	const wordCount = textContent.split(/\s+/).filter(Boolean).length || textContent.length;

	return {
		title,
		author: meta?.owner || '',
		content,
		wordCount,
	};
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
