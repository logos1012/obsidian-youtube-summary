import { ProcessedSections } from '../types';

export class NoteUpdater {
	/**
	 * Section mapping: maps section IDs to their corresponding callout info
	 */
	private readonly sectionMapping = {
		executiveSummary: {
			searchText: 'Executive Summary',
			calloutType: 'summary',
			calloutTitle: 'Executive Summary'
		},
		chapterAnalysis: {
			searchText: '챕터별 분석',
			calloutType: 'note',
			calloutTitle: '챕터별 분석'
		},
		keyConcepts: {
			searchText: '핵심 개념',
			calloutType: 'info',
			calloutTitle: '핵심 개념'
		},
		detailedNotes: {
			searchText: '상세 학습 노트',
			calloutType: 'note',
			calloutTitle: '상세 학습 노트'
		},
		actionItems: {
			searchText: '실행 아이템',
			calloutType: 'tip',
			calloutTitle: '실행 아이템'
		},
		feynmanExplanation: {
			searchText: '쉬운 설명',
			calloutType: 'tip',
			calloutTitle: '쉬운 설명'
		}
	};

	/**
	 * Update note content by replacing template prompts with AI-generated content
	 */
	update(currentContent: string, sections: ProcessedSections): string {
		let updatedContent = currentContent;

		// Process each section
		for (const [sectionKey, sectionInfo] of Object.entries(this.sectionMapping)) {
			const generatedContent = sections[sectionKey as keyof ProcessedSections];

			// Find the template pattern for this section
			// Pattern: {{"....."|callout:("type", "title", false)}}
			// We need to find this and replace with proper callout format

			// Create regex to find the specific callout template
			// This matches the entire {{...}} block that contains this section's info
			const calloutPattern = new RegExp(
				`\\{\\{[^}]*?callout:\\s*\\(\\s*["']${sectionInfo.calloutType}["']\\s*,\\s*["']${sectionInfo.calloutTitle}["'][^)]*\\)\\s*\\}\\}`,
				'g'
			);

			// Replace with proper callout format
			const calloutReplacement = this.formatCallout(
				sectionInfo.calloutType,
				sectionInfo.calloutTitle,
				generatedContent
			);

			updatedContent = updatedContent.replace(calloutPattern, calloutReplacement);
		}

		return updatedContent;
	}

	/**
	 * Format content as an Obsidian callout
	 */
	private formatCallout(type: string, title: string, content: string): string {
		// Split content into lines and indent each line
		const lines = content.split('\n');
		const indentedLines = lines.map(line => `> ${line}`).join('\n');

		return `> [!${type}] ${title}\n${indentedLines}`;
	}

	/**
	 * Alternative update method using more flexible pattern matching
	 * This is a fallback if the primary method doesn't work
	 */
	updateFlexible(currentContent: string, sections: ProcessedSections): string {
		let updatedContent = currentContent;

		// For each section, try to find and replace the corresponding template
		const replacements: Array<{ pattern: RegExp, content: string }> = [
			{
				// Executive Summary
				pattern: /\{\{[^}]*Executive Summary[^}]*\}\}/g,
				content: this.formatCallout('summary', 'Executive Summary', sections.executiveSummary)
			},
			{
				// Chapter Analysis (챕터별 분석)
				pattern: /\{\{[^}]*챕터별 분석[^}]*\}\}/g,
				content: this.formatCallout('note', '챕터별 분석', sections.chapterAnalysis)
			},
			{
				// Key Concepts (핵심 개념)
				pattern: /\{\{[^}]*핵심 개념[^}]*\}\}/g,
				content: this.formatCallout('info', '핵심 개념', sections.keyConcepts)
			},
			{
				// Detailed Notes (상세 학습 노트)
				pattern: /\{\{[^}]*상세 학습 노트[^}]*\}\}/g,
				content: this.formatCallout('note', '상세 학습 노트', sections.detailedNotes)
			},
			{
				// Action Items (실행 아이템)
				pattern: /\{\{[^}]*실행 아이템[^}]*\}\}/g,
				content: this.formatCallout('tip', '실행 아이템', sections.actionItems)
			},
			{
				// Feynman Explanation (쉬운 설명)
				pattern: /\{\{[^}]*쉬운 설명[^}]*\}\}/g,
				content: this.formatCallout('tip', '쉬운 설명', sections.feynmanExplanation)
			}
		];

		for (const { pattern, content } of replacements) {
			updatedContent = updatedContent.replace(pattern, content);
		}

		return updatedContent;
	}

	/**
	 * Check if content has template patterns that need to be processed
	 */
	hasTemplatesToProcess(content: string): boolean {
		// Check if content contains any {{...}} patterns with callout
		const templatePattern = /\{\{[^}]*callout:[^}]*\}\}/;
		return templatePattern.test(content);
	}

	/**
	 * Count how many templates are in the content
	 */
	countTemplates(content: string): number {
		const templatePattern = /\{\{[^}]*callout:[^}]*\}\}/g;
		const matches = content.match(templatePattern);
		return matches ? matches.length : 0;
	}
}
