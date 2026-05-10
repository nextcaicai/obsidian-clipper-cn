# Obsidian Web Clipper (Chinese Content Enhanced)

> This is a fork of the official [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper), enhanced for Chinese content platforms.

[中文说明](./README.md)

## What's different from the official version?

This fork adds enhanced support for Chinese content platforms:

### Bilibili video support

Adds **Bilibili video support** in Reader Mode, bringing the same experience as the official YouTube integration:

- **Content extraction** — Extracts video description, chapters, and subtitles/transcript from Bilibili pages
- **Video embed** — Embeds Bilibili player in Reader Mode with sticky pin-player support
- **Clickable timestamps** — Click any subtitle or chapter timestamp to seek the video
- **Auto-scroll** — Automatically scrolls the transcript to follow playback
- **Highlight active line** — Highlights the current subtitle line during playback
- **Cross-browser support** — Works on Chrome and Firefox with proper `Referer` header handling

### Feishu document full extraction

The official version extracts Feishu document content via generic DOM parsing, which often returns incomplete results due to Feishu's dynamic rendering. This fork integrates the **Feishu Open Platform API** to fetch document content through structured endpoints:

- **Complete content** — Retrieves all document blocks including text, headings, lists, code blocks, tables, quotes, and more
- **Image support** — Downloads document images via Feishu's internal web API without requiring extra permissions — images display correctly for any document the user can open in their browser
- **Wiki support** — Works with both Feishu Wiki (`/wiki/`) and regular document (`/docx/`) URLs
- **Structure preserved** — Maintains the original document hierarchy, converted to standard HTML for Obsidian Clipper to process

> **Image size note**: Images are embedded into the note as base64 data URLs, which can make Markdown files larger. If file size matters, search for and install the **Local Image Plus** plugin from Obsidian's community plugin marketplace. After each document is clipped into Obsidian, the plugin can automatically download images in the note as local image files (with a customizable save directory) and replace the base64 data URLs with local image URLs.

**Setup:**

1. Go to [Feishu Open Platform](https://open.feishu.cn/app) and create a custom app
2. Grant the app these permissions: `docx:document:readonly`, `wiki:node:read`
3. Get the App ID and App Secret (see [official docs: Get access token](https://open.feishu.cn/document/server-docs/api-call-guide/calling-process/get-access-token#63c75bdc))
4. Open Obsidian Web Clipper → click **Settings** (top-right) → **General** → find the **Feishu / Lark** section → enter your App ID and App Secret

> **Privacy note**: App ID and App Secret are stored only in your local browser storage (`browser.storage.local`) and are never sent to any third-party server.

### WeChat Official Account article extraction

The official version relies on the generic content extractor for WeChat Official Account articles. Because WeChat uses lazy-loaded images and a dynamic article structure, clipping can miss most body images and keep only the first one. This fork adds dedicated handling for `mp.weixin.qq.com`:

- **Full article container** — Uses WeChat's original `#js_content` article container to avoid generic extraction trimming later images
- **Lazy-loaded image normalization** — Detects image URLs from `data-src`, `data-original`, `data-lazy-src`, and similar attributes, then restores them as standard `src` values
- **Multi-image article support** — Preserves multiple `mmbiz.qpic.cn` images in the article body instead of only clipping the first image
- **Consistent extraction paths** — Normalizes image sources across the browser extension, CLI, and programmatic API to reduce output differences between entry points

### Why not merged upstream?

The official maintainer [indicated](https://github.com/obsidianmd/obsidian-clipper/pull/1) that site-specific content extractors should be implemented in [Defuddle](https://github.com/kepano/defuddle) (the content extraction library), not in the Web Clipper extension itself. Since integrating Bilibili support into Defuddle would require a different architectural approach, this fork maintains the feature independently for users who need it now.

## Get started

### Download a release package

If you only want to install and use the extension, download the package for your browser from this repository's [Releases](https://github.com/nextcaicai/obsidian-clipper-cn/releases) page:

- `obsidian-clipper-cn-*-chrome.zip` — Chrome, Brave, Edge, Arc, and other Chromium browsers
- `obsidian-clipper-cn-*-firefox.zip` — Firefox
- `obsidian-clipper-cn-*-safari.zip` — Safari

After downloading, unzip the package and follow the local installation steps below for the corresponding browser.

### Build from source

```bash
npm install
npm run build
```

Build outputs:
- `dist/` — Chromium version
- `dist_firefox/` — Firefox version
- `dist_safari/` — Safari version

### Install the extension locally

For Chromium browsers (Chrome, Brave, Edge, Arc):

1. Open your browser and navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist` directory

For Firefox:

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Navigate to the `dist_firefox` directory and select the `manifest.json` file

To install permanently on Firefox Nightly or Developer Edition:

1. Type `about:config` in the URL bar
2. Search for `xpinstall.signatures.required`
3. Double-click to set it to `false`
4. Go to `about:addons` > gear icon > **Install Add-on From File…**

## License

MIT — Same as the [original project](https://github.com/obsidianmd/obsidian-clipper).
