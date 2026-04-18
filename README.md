# Page to Markdown

A minimal Chrome extension that converts any webpage into clean Markdown with a single click — including pages behind login or auth, since it reads directly from the live DOM.

## How it works

1. Click the **MD** icon in the Chrome toolbar
2. The extension reads the current page's DOM and converts it to Markdown
3. A toast appears bottom-right: content is **copied to clipboard** automatically
4. Optionally hit **Save .md** in the toast to download the file

No popup, no extra steps.

## What gets extracted

- Title, URL, description, author, published date
- Full content with proper heading hierarchy (`#` → `######`)
- Fenced code blocks with language hints
- Bold, italic, strikethrough inline formatting
- Ordered and unordered lists (with nesting)
- Tables as Markdown tables
- Inline links
- Images

## Installation (Developer Mode)

Until this is published to the Chrome Web Store:

1. Clone or download this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `page-to-md` folder
5. Pin the **MD** icon from the extensions puzzle-piece menu

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Read the current tab's DOM |
| `scripting` | Inject the content script |
| `clipboardWrite` | Copy Markdown to clipboard |
| `downloads` | Save the `.md` file to disk |

## Project structure

```
page-to-md/
├── manifest.json   # MV3 extension manifest
├── background.js   # Service worker — handles icon click, badge, downloads
├── content.js      # DOM → Markdown converter + toast UI
└── icons/          # Extension icons (16, 48, 128px)
```

## License

MIT
