import { App, PluginSettingTab, Setting } from 'obsidian';
import YouTubeSummaryPlugin from './main';
import { YouTubeSummarySettings } from './types';

export class YouTubeSummarySettingTab extends PluginSettingTab {
	plugin: YouTubeSummaryPlugin;

	constructor(app: App, plugin: YouTubeSummaryPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'YouTube Deep Learning Note Settings' });

		// API Configuration Section
		containerEl.createEl('h3', { text: 'API Configuration' });

		new Setting(containerEl)
			.setName('Claude API Key')
			.setDesc('Enter your Anthropic Claude API key (get it from console.anthropic.com)')
			.addText(text => text
				.setPlaceholder('sk-ant-...')
				.setValue(this.plugin.settings.claudeApiKey)
				.onChange(async (value) => {
					this.plugin.settings.claudeApiKey = value;
					await this.plugin.saveSettings();
				}));

		// Transcript Settings Section
		containerEl.createEl('h3', { text: 'Transcript Settings' });

		new Setting(containerEl)
			.setName('Preferred Languages')
			.setDesc('Comma-separated language codes for transcript (e.g., ko,en). First language is preferred.')
			.addText(text => text
				.setPlaceholder('ko,en')
				.setValue(this.plugin.settings.preferredLanguages.join(','))
				.onChange(async (value) => {
					this.plugin.settings.preferredLanguages =
						value.split(',').map(s => s.trim()).filter(s => s.length > 0);
					await this.plugin.saveSettings();
				}));

		// Processing Options Section
		containerEl.createEl('h3', { text: 'Processing Options' });

		new Setting(containerEl)
			.setName('Create Backup')
			.setDesc('Create a backup copy of the note before processing')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.createBackup)
				.onChange(async (value) => {
					this.plugin.settings.createBackup = value;
					await this.plugin.saveSettings();
				}));

		// Advanced Settings Section
		containerEl.createEl('h3', { text: 'Advanced Settings' });

		new Setting(containerEl)
			.setName('Max Retries')
			.setDesc('Maximum number of retry attempts for transcript download')
			.addText(text => text
				.setPlaceholder('3')
				.setValue(String(this.plugin.settings.maxRetries))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0 && num <= 10) {
						this.plugin.settings.maxRetries = num;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Timeout (seconds)')
			.setDesc('Maximum time to wait for AI processing')
			.addText(text => text
				.setPlaceholder('120')
				.setValue(String(this.plugin.settings.timeoutSeconds))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0 && num <= 600) {
						this.plugin.settings.timeoutSeconds = num;
						await this.plugin.saveSettings();
					}
				}));

		// Help Section
		containerEl.createEl('h3', { text: 'Usage' });
		const usageDiv = containerEl.createDiv();
		usageDiv.innerHTML = `
			<p><strong>How to use:</strong></p>
			<ol>
				<li>Clip a YouTube video using Obsidian Web Clipper</li>
				<li>Open the clipped note in Obsidian</li>
				<li>Click the YouTube icon in the ribbon or use the command palette</li>
				<li>Wait for processing (usually 30-60 seconds)</li>
				<li>The note will be automatically updated with AI-generated summaries</li>
			</ol>
			<p><strong>Note:</strong> Make sure the note has a <code>source_url</code> property in the frontmatter with the YouTube URL.</p>
			<p><strong>Cost:</strong> Each video costs approximately $0.06 in Claude API credits.</p>
		`;
	}
}
