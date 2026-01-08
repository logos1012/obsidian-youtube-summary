export interface VideoMetadata {
	title: string;
	author: string;
	duration?: number;
	publishDate?: string;
}

export interface TranscriptSegment {
	text: string;
	offset: number;
	duration: number;
}

export interface TranscriptResult {
	text: string;
	segments: TranscriptSegment[];
	metadata: VideoMetadata;
}

export interface ProcessedSections {
	executiveSummary: string;
	chapterAnalysis: string;
	keyConcepts: string;
	detailedNotes: string;
	actionItems: string;
	feynmanExplanation: string;
	category: string;
	topicsKr: string;
}

export interface YouTubeSummarySettings {
	claudeApiKey: string;
	preferredLanguages: string[];
	maxRetries: number;
	timeoutSeconds: number;
}

export const DEFAULT_SETTINGS: YouTubeSummarySettings = {
	claudeApiKey: '',
	preferredLanguages: ['ko', 'en'],
	maxRetries: 3,
	timeoutSeconds: 120
};
