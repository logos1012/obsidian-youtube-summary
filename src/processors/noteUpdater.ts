import { ProcessedSections, TranscriptSegment } from '../types';

export class NoteUpdater {

	updateFlexible(currentContent: string, sections: ProcessedSections, segments?: TranscriptSegment[], videoId?: string): string {
		let updatedContent = this.updateFrontmatter(currentContent, sections);
		
		updatedContent = this.removeExistingSections(updatedContent);
		
		const generatedSections = this.generateAllSections(sections, segments, videoId);
		
		const insertPosition = this.findInsertPosition(updatedContent);
		updatedContent = 
			updatedContent.slice(0, insertPosition) + 
			'\n' + generatedSections + 
			updatedContent.slice(insertPosition);

		return updatedContent;
	}

	private removeExistingSections(content: string): string {
		const sectionPattern = /\n---\n\n## [0-9]+\. [\s\S]*$/;
		return content.replace(sectionPattern, '');
	}

	private findInsertPosition(content: string): number {
		const clippedMatch = content.match(/\*Clipped:.*?\*/);
		if (clippedMatch) {
			return content.indexOf(clippedMatch[0]) + clippedMatch[0].length;
		}
		
		return content.length;
	}

	private generateAllSections(sections: ProcessedSections, segments?: TranscriptSegment[], videoId?: string): string {
		let content = `
---

## 1. Executive Summary

${this.formatCallout('summary', 'Executive Summary', sections.executiveSummary)}

---

## 2. Chapter Analysis

${this.formatCallout('note', '챕터별 분석', sections.chapterAnalysis)}

---

## 3. Key Concepts

${this.formatCallout('info', '핵심 개념', sections.keyConcepts)}

---

## 4. 본문 (Transcript)

${this.formatTranscript(segments, videoId)}
`;
		return content;
	}

	private formatTranscript(segments?: TranscriptSegment[], videoId?: string): string {
		if (!segments || segments.length === 0) {
			return '*자막 없음*';
		}

		const mergedSegments = this.mergeSegments(segments, 30);

		return mergedSegments.map(seg => {
			const timestamp = this.formatTimestamp(seg.offset);
			const link = videoId 
				? `[${timestamp}](https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seg.offset)}s)`
				: timestamp;
			return `**${link}** ${seg.text}`;
		}).join('\n\n');
	}

	private mergeSegments(segments: TranscriptSegment[], intervalSeconds: number): TranscriptSegment[] {
		if (segments.length === 0) return [];

		const merged: TranscriptSegment[] = [];
		let currentGroup: TranscriptSegment = { ...segments[0] };

		for (let i = 1; i < segments.length; i++) {
			const seg = segments[i];
			const groupEndTime = currentGroup.offset + currentGroup.duration;
			
			if (seg.offset - currentGroup.offset < intervalSeconds) {
				currentGroup.text += ' ' + seg.text;
				currentGroup.duration = (seg.offset + seg.duration) - currentGroup.offset;
			} else {
				merged.push(currentGroup);
				currentGroup = { ...seg };
			}
		}
		merged.push(currentGroup);

		return merged;
	}

	private formatTimestamp(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		
		if (h > 0) {
			return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		}
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	private formatCallout(type: string, title: string, content: string): string {
		const lines = content.split('\n');
		const indentedLines = lines.map(line => `> ${line}`).join('\n');
		return `> [!${type}] ${title}\n${indentedLines}`;
	}

	private updateFrontmatter(content: string, sections: ProcessedSections): string {
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) return content;

		let frontmatter = frontmatterMatch[1];

		// Update topics_kr if empty
		const topicsEmptyPattern = /^topics_kr:\s*""?\s*$(\n\s+-\s*"[^"]*"\s*$)*/m;
		const topicsEmptyMatch = frontmatter.match(topicsEmptyPattern);
		if (topicsEmptyMatch) {
			frontmatter = frontmatter.replace(topicsEmptyPattern, `topics_kr: "${sections.topicsKr}"`);
		}

		return content.replace(/^---\n[\s\S]*?\n---/, `---\n${frontmatter}\n---`);
	}
}
