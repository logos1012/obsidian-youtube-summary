import Anthropic from '@anthropic-ai/sdk';
import { ProcessedSections, VideoMetadata } from '../types';
import { AIProcessingError, APIKeyMissingError } from '../utils/errors';

export class AIProcessor {
	private client: Anthropic | null = null;
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	private getClient(): Anthropic {
		if (!this.client) {
			if (!this.apiKey) {
				throw new APIKeyMissingError();
			}
			this.client = new Anthropic({
				apiKey: this.apiKey
			});
		}
		return this.client;
	}

	/**
	 * Build the comprehensive prompt for all 7 sections
	 */
	private buildPrompt(transcript: string, metadata: VideoMetadata): string {
		return `You are processing a YouTube video transcript to create comprehensive learning notes in Korean.

VIDEO METADATA:
- Title: ${metadata.title}
- Channel: ${metadata.author}
${metadata.publishDate ? `- Published: ${metadata.publishDate}` : ''}

TRANSCRIPT:
${transcript}

Please generate the following 6 sections based on the transcript. Your response MUST be a valid JSON object with the exact field names below.

IMPORTANT INSTRUCTIONS:
- All content must be in Korean (한국어)
- Be comprehensive and detailed
- Use the transcript content to provide specific examples and explanations
- NEVER include word counts or character counts like (약 200자) or (약 400자)
- Write naturally without meta-commentary about length

Generate these sections:

1. EXECUTIVE SUMMARY (executiveSummary)
   Summarize this video in Korean:
   1) One core message sentence
   2) Three key points as numbered list
   3) Video structure overview in 2 sentences
   4) Target audience

2. CHAPTER ANALYSIS (chapterAnalysis)
   Write detailed narrative notes for each chapter in Korean like a lecture transcript summary.
   For EACH chapter explain thoroughly what the speaker said, their reasoning, examples given, and why it matters.
   Use paragraphs not bullet points.
   Write as if someone could fully understand the video without watching it.
   Cover ALL chapters thoroughly.

3. KEY CONCEPTS (keyConcepts)
   Extract ALL key concepts and terms from this video in Korean.
   Create a table with columns: Term, Definition, Context in video.
   Then explain any frameworks or models mentioned.
   Finally describe how concepts relate to each other.

4. DETAILED NOTES (detailedNotes)
   Create exhaustive learning notes in Korean covering:
   1) Background context and why this matters
   2) All main arguments with supporting evidence
   3) Step-by-step methods or processes explained
   4) Data and statistics mentioned
   5) Limitations acknowledged
   Be comprehensive enough to understand without watching.

5. ACTION ITEMS (actionItems)
   Extract actionable insights in Korean:
   1) Immediate actions as checkbox list
   2) Long-term application areas
   3) Books or resources mentioned
   4) Questions for further exploration

6. FEYNMAN EXPLANATION (feynmanExplanation)
   Using Feynman Technique, explain ALL main concepts from this video in Korean.
   Write comprehensively. Use simple analogies and everyday examples.
   Connect all key concepts naturally. Cover the ENTIRE video content.
   This will be used for InfraNodus knowledge graph analysis.

Return ONLY a valid JSON object in this exact format:
{
  "executiveSummary": "your content here",
  "chapterAnalysis": "your content here",
  "keyConcepts": "your content here",
  "detailedNotes": "your content here",
  "actionItems": "your content here",
  "feynmanExplanation": "your content here"
}`;
	}

	/**
	 * Parse AI response and validate structure
	 */
	private parseResponse(responseText: string): ProcessedSections {
		try {
			// Try to extract JSON from response
			// Sometimes Claude wraps JSON in markdown code blocks
			let jsonText = responseText.trim();

			// Remove markdown code block if present
			if (jsonText.startsWith('```json')) {
				jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
			} else if (jsonText.startsWith('```')) {
				jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
			}

			// Parse JSON
			const parsed = JSON.parse(jsonText);

			// Validate all required fields
			const required = [
				'executiveSummary',
				'chapterAnalysis',
				'keyConcepts',
				'detailedNotes',
				'actionItems',
				'feynmanExplanation'
			];

			for (const field of required) {
				if (!parsed[field] || typeof parsed[field] !== 'string') {
					throw new Error(`Missing or invalid field: ${field}`);
				}
			}

			return parsed as ProcessedSections;

		} catch (error) {
			throw new AIProcessingError(
				`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Process transcript and generate all sections
	 */
	async processAllSections(
		transcript: string,
		metadata: VideoMetadata
	): Promise<ProcessedSections> {
		try {
			const client = this.getClient();

			const prompt = this.buildPrompt(transcript, metadata);

			const response = await client.messages.create({
				model: 'claude-3-5-sonnet-20241022',
				max_tokens: 8000,
				temperature: 0.7,
				messages: [{
					role: 'user',
					content: prompt
				}]
			});

			// Extract text from response
			const content = response.content[0];
			if (content.type !== 'text') {
				throw new AIProcessingError('Unexpected response type from Claude API');
			}

			const responseText = content.text;

			// Parse and validate response
			return this.parseResponse(responseText);

		} catch (error) {
			if (error instanceof APIKeyMissingError || error instanceof AIProcessingError) {
				throw error;
			}

			// Handle Anthropic API errors
			if (error instanceof Error) {
				if ('status' in error) {
					const status = (error as any).status;
					if (status === 429) {
						throw new AIProcessingError('Rate limit reached. Please wait a few minutes and try again.');
					} else if (status === 401) {
						throw new APIKeyMissingError('Invalid API key. Please check your settings.');
					} else if (status === 400) {
						throw new AIProcessingError('Invalid request. The transcript might be too long.');
					}
				}
				throw new AIProcessingError(`AI processing failed: ${error.message}`);
			}

			throw new AIProcessingError('Unknown error occurred during AI processing');
		}
	}
}
