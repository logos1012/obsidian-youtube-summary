# YouTube Deep Learning Note

![Version](https://img.shields.io/badge/version-1.0.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Obsidian plugin to automatically process YouTube notes with AI-generated summaries using Claude API.

## Features

- 📥 Automatic YouTube transcript download (no API key required)
- 🤖 AI-powered content analysis using Claude
- 📝 6 comprehensive sections generated automatically:
  - Executive Summary
  - Chapter Analysis
  - Key Concepts
  - Detailed Notes
  - Action Items
  - Feynman Explanation
- 🌐 Multi-language support (Korean and English)
- 💾 Automatic backup before processing
- ⚡ Single-click processing from ribbon or command palette

## Installation

### Manual Installation

1. Copy the plugin folder to your Obsidian vault's `.obsidian/plugins/` directory
2. Make sure the following files are in the plugin folder:
   - `main.js`
   - `manifest.json`
   - `styles.css` (if any)
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### Development Build

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Development mode (auto-rebuild on changes)
npm run dev
```

## Setup

### 1. Get Claude API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an account or sign in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-...`)

### 2. Configure Plugin

1. Open Obsidian Settings
2. Go to Community Plugins → YouTube Deep Learning Note
3. Paste your Claude API key
4. (Optional) Adjust other settings:
   - Preferred languages for transcripts
   - Enable/disable backup creation
   - Max retries and timeout

## Usage

### Quick Start

1. **Clip a YouTube video** using Obsidian Web Clipper
   - The note must have a `source_url` property in frontmatter
   - The URL should be a valid YouTube link

2. **Open the clipped note** in Obsidian

3. **Process the note** using one of these methods:
   - Click the YouTube icon in the left ribbon
   - Open Command Palette (Cmd/Ctrl + P) and search for "Process YouTube Note"

4. **Wait for processing**
   - Downloading transcript: ~2-3 seconds
   - AI processing: ~30-60 seconds
   - Note update: <1 second

5. **Done!** Your note is now filled with comprehensive AI-generated summaries

### Example Workflow

```markdown
---
title: "How AI Works - Deep Dive"
source_url: https://www.youtube.com/watch?v=VIDEO_ID
channel: Tech Explained
created: 2026-01-07
---

## Video
<iframe src="..."></iframe>

## 1. Executive Summary
{{AI will replace this with summary}}

## 2. Chapter Analysis
{{AI will replace this with chapter analysis}}

... (more sections)
```

After processing:

```markdown
---
title: "How AI Works - Deep Dive"
source_url: https://www.youtube.com/watch?v=VIDEO_ID
channel: Tech Explained
created: 2026-01-07
---

## Video
<iframe src="..."></iframe>

## 1. Executive Summary
> [!summary] Executive Summary
> 이 영상은 인공지능의 작동 원리를 설명합니다...
>
> 핵심 포인트:
> 1. ...
> 2. ...

## 2. Chapter Analysis
> [!note] 챕터별 분석
> 첫 번째 챕터에서는...

... (AI-generated content)
```

## Features in Detail

### Transcript Download
- Uses `youtube-transcript` library
- No YouTube API key required
- Supports multiple languages
- Automatic retry on failure
- Extracts video metadata (title, author, date)

### AI Processing
- Single API call for all 6 sections (cost-efficient)
- Comprehensive Korean language output
- Structured JSON response
- Error handling and validation

### Note Update
- Safely replaces template placeholders
- Preserves frontmatter and other content
- Creates backup before modification (optional)
- Validates template patterns

## Cost Estimation

- **Per video**: ~$0.06 (Claude 3.5 Sonnet pricing)
- **Monthly** (10 videos): ~$0.60
- **Yearly**: ~$7.20

Costs may vary based on:
- Transcript length
- Video duration
- Claude API pricing changes

## Changelog

### v1.0.2 (2026-01-07)
- 🐛 Fixed "Unexpected end of JSON input" error when downloading transcripts
- ✅ Added response validation before JSON parsing
- 📝 Improved error messages with detailed logging
- 🔒 Added null/undefined checks for caption data

### v1.0.1 (2026-01-07)
- 🐛 Fixed CORS issues by using Obsidian's requestUrl API
- ⚡ Improved transcript download reliability

### v1.0.0 (2026-01-07)
- 🎉 Initial release
- 📥 YouTube transcript download
- 🤖 Claude AI integration
- 📝 6 comprehensive analysis sections

## Troubleshooting

### "Unexpected end of JSON input" or JSON parse errors
- This has been fixed in v1.0.2
- Update to the latest version
- If still occurring, check internet connection and try again

### "No source_url found in frontmatter"
- Make sure your note has frontmatter with `source_url` field
- Check that the URL is a valid YouTube link

### "No transcript available"
- Video may not have captions
- Try a different video
- Check if video is private or deleted

### "Invalid API key"
- Verify your Claude API key in settings
- Make sure you copied the entire key (starts with `sk-ant-`)
- Check if your API key has expired

### "AI processing failed"
- Check your internet connection
- Verify API key has sufficient credits
- Try again in a few minutes (rate limiting)

### Processing takes too long
- Large transcripts may take longer
- Check timeout setting (default: 120 seconds)
- Close other resource-intensive apps

## Development

### Project Structure

```
youtube-deep-learning-note/
├── src/
│   ├── main.ts              # Plugin entry point
│   ├── settings.ts          # Settings UI
│   ├── processors/
│   │   ├── videoIdExtractor.ts
│   │   ├── transcriptDownloader.ts
│   │   ├── aiProcessor.ts
│   │   └── noteUpdater.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── errors.ts
│       └── helpers.ts
├── manifest.json
├── package.json
└── README.md
```

### Building

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Development mode (watch for changes)
npm run dev
```

### Testing

Test the plugin with various scenarios:
- [ ] Video with Korean transcript
- [ ] Video with English transcript
- [ ] Video with no transcript
- [ ] Long video (>1 hour)
- [ ] Short video (<5 minutes)
- [ ] Private/deleted video
- [ ] Invalid URL
- [ ] Network timeout

## Privacy & Security

- API keys are stored locally in Obsidian's data.json
- No data is sent to third parties except Claude API
- Transcript download doesn't require authentication
- All processing happens locally except AI inference

## Limitations

- Requires internet connection
- Requires Claude API key (paid service)
- Only works with YouTube videos that have transcripts
- Processing time varies (30-60 seconds typical)
- Cannot process videos without captions

## Roadmap

### v1.1 (Planned)
- [ ] Batch processing for multiple notes
- [ ] Custom section templates
- [ ] OpenAI GPT-4 support
- [ ] Caching for repeated videos

### v2.0 (Future)
- [ ] Local LLM support (Ollama)
- [ ] Timestamp-linked notes
- [ ] Video chapter detection
- [ ] Auto-tagging based on content
- [ ] Translation support

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review plugin settings
3. Check browser console for errors (Cmd/Ctrl + Shift + I)
4. Create an issue on GitHub with:
   - Obsidian version
   - Plugin version
   - Error message
   - Steps to reproduce

## License

MIT

## Credits

- Built with [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- Transcript download: [youtube-transcript](https://www.npmjs.com/package/youtube-transcript)
- AI: [Anthropic Claude](https://www.anthropic.com/)

---

**Note**: This plugin is not affiliated with YouTube or Anthropic. Use responsibly and respect content creators' rights.
