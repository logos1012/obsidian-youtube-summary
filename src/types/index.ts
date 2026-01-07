export interface VideoMetadata {
	title: string;
	author: string;
	duration?: number;
	publishDate?: string;
}

export interface TranscriptResult {
	text: string;
	metadata: VideoMetadata;
}

export interface ProcessedSections {
	executiveSummary: string;
	chapterAnalysis: string;
	keyConcepts: string;
	detailedNotes: string;
	actionItems: string;
	feynmanExplanation: string;
}

export interface YouTubeSummarySettings {
	// AI Configuration
	claudeApiKey: string;

	// Transcript Settings
	preferredLanguages: string[];

	// Processing Options
	createBackup: boolean;

	// Advanced
	maxRetries: number;
	timeoutSeconds: number;
}

export const DEFAULT_SETTINGS: YouTubeSummarySettings = {
	claudeApiKey: '',
	preferredLanguages: ['ko', 'en'],
	createBackup: true,
	maxRetries: 3,
	timeoutSeconds: 120
};
