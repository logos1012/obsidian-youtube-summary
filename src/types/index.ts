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

export type ClaudeModel = 
	| 'claude-sonnet-4-20250514'
	| 'claude-3-7-sonnet-20250219'
	| 'claude-3-5-sonnet-20241022'
	| 'claude-3-5-haiku-20241022'
	| 'claude-3-opus-20240229'
	| 'claude-3-haiku-20240307';

export const CLAUDE_MODELS: { value: ClaudeModel; label: string }[] = [
	{ value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Latest)' },
	{ value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
	{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
	{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
	{ value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Most Capable)' },
	{ value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fastest)' },
];

export interface YouTubeSummarySettings {
	claudeApiKey: string;
	preferredLanguages: string[];
	maxRetries: number;
	timeoutSeconds: number;
	aiModel: ClaudeModel;
	maxTokens: number;
}

export const DEFAULT_SETTINGS: YouTubeSummarySettings = {
	claudeApiKey: '',
	preferredLanguages: ['ko', 'en'],
	maxRetries: 3,
	timeoutSeconds: 120,
	aiModel: 'claude-sonnet-4-20250514',
	maxTokens: 16000
};
