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

	const content = convertBlocksToHtml(blocks);
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
