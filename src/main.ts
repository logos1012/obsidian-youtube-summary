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
import * as path from 'path';

export default class YouTubeSummaryPlugin extends Plugin {
	settings: YouTubeSummarySettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon('youtube', 'Process YouTube Note', async () => {
			await this.processCurrentNote();
		});

		// Add command: Process current note
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

		// Add command: Open settings
		this.addCommand({
			id: 'open-settings',
			name: 'Open Settings',
			callback: () => {
				// @ts-ignore - accessing private API
				this.app.setting.open();
				// @ts-ignore - accessing private API
				this.app.setting.openTabById(this.manifest.id);
			}
		});

		// Add settings tab
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

	/**
	 * Main processing function
	 */
	async processCurrentNote(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('❌ No active note. Please open a note first.');
			return;
		}

		try {
			// Step 1: Validate note and extract video ID
			new Notice('📹 Extracting video ID...');
			const videoId = await this.extractVideoIdFromNote(activeFile);

			// Step 2: Download transcript
			new Notice('📥 Downloading transcript...', 4000);
			// @ts-ignore - app.vault.adapter.basePath is available
			const vaultPath = this.app.vault.adapter.basePath;
			// @ts-ignore - manifest.dir is available
			const pluginDir = path.join(vaultPath, this.manifest.dir || '.obsidian/plugins/youtube-deep-learning-note');
			console.log('Plugin directory:', pluginDir);
			const transcriptDownloader = new TranscriptDownloader(this.settings.maxRetries, pluginDir);
			const transcriptResult = await transcriptDownloader.downloadWithMetadata(
				videoId,
				this.settings.preferredLanguages
			);

			new Notice(`✓ Transcript downloaded (${transcriptResult.text.length} characters)`, 3000);

			// Step 3: Process with AI
			new Notice('🤖 Generating AI summary... (this may take 30-60s)', 60000);

			// Check API key
			if (!this.settings.claudeApiKey) {
				throw new APIKeyMissingError();
			}

			const aiProcessor = new AIProcessor(this.settings.claudeApiKey);
			const processedSections = await aiProcessor.processAllSections(
				transcriptResult.text,
				transcriptResult.metadata
			);

			new Notice('✓ AI processing completed', 3000);

			// Step 4: Update note
			new Notice('📝 Updating note...');

			// Create backup if enabled
			if (this.settings.createBackup) {
				await this.createBackup(activeFile);
			}

			// Read current content
			const currentContent = await this.app.vault.read(activeFile);

			// Update content
			const noteUpdater = new NoteUpdater();
			const updatedContent = noteUpdater.updateFlexible(currentContent, processedSections);

			// Save updated content
			await this.app.vault.modify(activeFile, updatedContent);

			new Notice('✅ Note processing completed!', 5000);

		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Extract video ID from note frontmatter
	 */
	private async extractVideoIdFromNote(file: TFile): Promise<string> {
		// Get frontmatter
		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter) {
			throw new Error('No frontmatter found. Is this a YouTube note?');
		}

		const sourceUrl = cache.frontmatter.source_url;
		if (!sourceUrl) {
			throw new Error('No source_url found in frontmatter.');
		}

		// Extract video ID
		const extractor = new VideoIdExtractor();
		return extractor.extract(sourceUrl);
	}

	/**
	 * Create backup of note
	 */
	private async createBackup(file: TFile): Promise<void> {
		try {
			const content = await this.app.vault.read(file);
			const backupPath = file.path.replace(/\.md$/, `.backup-${Date.now()}.md`);

			await this.app.vault.create(backupPath, content);
			console.log(`Backup created: ${backupPath}`);
		} catch (error) {
			console.warn('Failed to create backup:', error);
			// Don't throw - backup failure shouldn't stop processing
		}
	}

	/**
	 * Handle errors with user-friendly messages
	 */
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
