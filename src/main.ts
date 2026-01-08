import { Notice, Plugin, TFile } from 'obsidian';
import { YouTubeSummarySettings, DEFAULT_SETTINGS } from './types';
import { YouTubeSummarySettingTab } from './settings';
import { VideoIdExtractor } from './processors/videoIdExtractor';
import { TranscriptDownloader } from './processors/transcriptDownloader';
import { AIProcessor } from './processors/aiProcessor';
import { NoteUpdater } from './processors/noteUpdater';
import {
	VideoIdNotFoundError,
	TranscriptNotFoundError,
	AIProcessingError,
	APIKeyMissingError
} from './utils/errors';

export default class YouTubeSummaryPlugin extends Plugin {
	settings: YouTubeSummarySettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('youtube', 'Process YouTube Note', async () => {
			await this.processCurrentNote();
		});

		this.addCommand({
			id: 'process-youtube-note',
			name: 'Process current note',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						this.processCurrentNote();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'open-settings',
			name: 'Open Settings',
			callback: () => {
				// @ts-ignore
				this.app.setting.open();
				// @ts-ignore
				this.app.setting.openTabById(this.manifest.id);
			}
		});

		this.addSettingTab(new YouTubeSummarySettingTab(this.app, this));

		console.log('YouTube Deep Learning Note plugin loaded');
	}

	onunload() {
		console.log('YouTube Deep Learning Note plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async processCurrentNote(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('❌ No active note. Please open a note first.');
			return;
		}

		try {
			new Notice('📹 Extracting video ID...');
			const videoId = await this.extractVideoIdFromNote(activeFile);

			new Notice('📥 Downloading transcript...', 4000);

			const transcriptDownloader = new TranscriptDownloader(this.settings.maxRetries);
			const transcriptResult = await transcriptDownloader.downloadWithMetadata(
				videoId,
				this.settings.preferredLanguages
			);

			new Notice(`✓ Transcript downloaded (${transcriptResult.text.length} characters)`, 3000);

			new Notice('🤖 Generating AI summary... (this may take 30-60s)', 60000);

			if (!this.settings.claudeApiKey) {
				throw new APIKeyMissingError();
			}

			const aiProcessor = new AIProcessor(this.settings.claudeApiKey);
			const processedSections = await aiProcessor.processAllSections(
				transcriptResult.text,
				transcriptResult.metadata
			);

			new Notice('✓ AI processing completed', 3000);

			new Notice('📝 Updating note...');

			const currentContent = await this.app.vault.read(activeFile);

			const noteUpdater = new NoteUpdater();
			const updatedContent = noteUpdater.updateFlexible(
				currentContent, 
				processedSections, 
				transcriptResult.segments,
				videoId
			);

			await this.app.vault.modify(activeFile, updatedContent);

			new Notice('✅ Note processing completed!', 5000);

		} catch (error) {
			this.handleError(error);
		}
	}

	private async extractVideoIdFromNote(file: TFile): Promise<string> {
		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter) {
			throw new Error('No frontmatter found. Is this a YouTube note?');
		}

		const sourceUrl = cache.frontmatter.source_url;
		if (!sourceUrl) {
			throw new Error('No source_url found in frontmatter.');
		}

		const extractor = new VideoIdExtractor();
		return extractor.extract(sourceUrl);
	}

	private handleError(error: unknown): void {
		console.error('Processing error:', error);

		if (error instanceof APIKeyMissingError) {
			new Notice('❌ ' + error.message + '\n\nPlease configure your API key in settings.', 8000);
		} else if (error instanceof VideoIdNotFoundError) {
			new Notice('❌ ' + error.message + '\n\nMake sure the source_url is a valid YouTube URL.', 8000);
		} else if (error instanceof TranscriptNotFoundError) {
			new Notice('❌ ' + error.message + '\n\nThe video may not have captions available.', 8000);
		} else if (error instanceof AIProcessingError) {
			new Notice('❌ ' + error.message, 8000);
		} else if (error instanceof Error) {
			new Notice('❌ Error: ' + error.message, 8000);
		} else {
			new Notice('❌ An unknown error occurred. Check the console for details.', 8000);
		}
	}
}
