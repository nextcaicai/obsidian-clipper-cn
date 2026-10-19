interface TranscriptCue {
	timestamp: string;
	seconds: number;
	text: string;
}

const TIMESTAMP = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?`;
const CUE_LINE = new RegExp(
	String.raw`^\s*(?:(?:[-*+]|\d+\.)\s+)?(?:\[(${TIMESTAMP})\]\([^)]*\)|\[?\x60(${TIMESTAMP})\x60\]?|(${TIMESTAMP}))\s+(.+?)\s*$`
);

/**
 * Turns a line-per-cue transcript into readable paragraphs while retaining the
 * first timestamp in each paragraph and the original words.
 * Returns null when the input does not look like a timestamped transcript.
 */
export function formatTranscriptForReading(markdown: string): string | null {
	const lines = markdown.split(/\r?\n/);
	const output: string[] = [];
	let paragraph: TranscriptCue[] = [];
	let cueCount = 0;

	const flushParagraph = (endSentence = false) => {
		if (paragraph.length === 0) return;
		const firstCue = paragraph[0];
		let text = paragraph.reduce((result, cue, index) => {
			if (index === 0) return cue.text;
			const previousText = paragraph[index - 1].text;
			const needsSpace = /[a-zA-Z0-9]$/.test(previousText) && /^[a-zA-Z0-9]/.test(cue.text);
			return result + (needsSpace ? ' ' : '') + cue.text;
		}, '');
		if (endSentence) text = appendPunctuation(text, 'sentence');
		output.push(`${firstCue.timestamp} ${text}`, '');
		paragraph = [];
	};

	for (const line of lines) {
		const match = line.match(CUE_LINE);
		if (!match) {
			flushParagraph(true);
			output.push(line);
			continue;
		}

		const timestamp = match[1] || match[2] || match[3];
		const text = match[4].trim();
		if (!timestamp || !text) {
			flushParagraph();
			output.push(line);
			continue;
		}

		const cue = { timestamp, seconds: timestampToSeconds(timestamp), text };
		const previousCue = paragraph[paragraph.length - 1];
		const paragraphLength = paragraph.reduce((length, item) => length + item.text.length, 0);
		if (previousCue) {
			const interval = cue.seconds - previousCue.seconds;
			if (interval < 0 || interval >= 8 || paragraphLength + text.length > 180) {
				flushParagraph(true);
			} else if (interval >= 3 && /\p{Script=Han}/u.test(previousCue.text)) {
				previousCue.text = appendPunctuation(previousCue.text, 'comma');
			}
		}

		paragraph.push(cue);
		cueCount++;
		if (/[。！？!?；;.]$/.test(text)) flushParagraph();
	}

	flushParagraph(true);
	if (cueCount < 2) return null;

	return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function appendPunctuation(text: string, type: 'sentence' | 'comma'): string {
	if (type === 'sentence' && /[，,]$/.test(text)) text = text.slice(0, -1);
	else if (/[，。！？；：,.!?;:]$/.test(text)) return text;
	const isChinese = /\p{Script=Han}/u.test(text);
	return `${text}${type === 'sentence' ? (isChinese ? '。' : '.') : (isChinese ? '，' : ',')}`;
}

function timestampToSeconds(timestamp: string): number {
	const parts = timestamp.split(':').map(Number);
	const seconds = parts.pop() || 0;
	const minutes = parts.pop() || 0;
	const hours = parts.pop() || 0;
	return hours * 3600 + minutes * 60 + seconds;
}
