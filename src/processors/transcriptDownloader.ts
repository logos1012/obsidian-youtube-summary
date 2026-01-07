import { YoutubeTranscript } from 'youtube-transcript';
import { TranscriptResult, VideoMetadata } from '../types';
import { TranscriptNotFoundError } from '../utils/errors';
import { sleep } from '../utils/helpers';

export class TranscriptDownloader {
	private maxRetries: number;

	constructor(maxRetries: number = 3) {
		this.maxRetries = maxRetries;
	}

	/**
	 * Download YouTube transcript with retry logic
	 */
	async download(
		videoId: string,
		languages: string[] = ['ko', 'en']
	): Promise<TranscriptResult> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			try {
				const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
					lang: languages.join(',')
				});

				// Combine all transcript segments into full text
				const fullText = transcript
					.map(segment => segment.text)
					.join(' ')
					.replace(/\s+/g, ' ')
					.trim();

				// Extract metadata (we'll get more metadata later if possible)
				const metadata: VideoMetadata = {
					title: 'Unknown',
					author: 'Unknown'
				};

				return {
					text: fullText,
					metadata
				};

			} catch (error) {
				lastError = error as Error;

				// If it's the last attempt, throw
				if (attempt === this.maxRetries - 1) {
					break;
				}

				// Exponential backoff: wait 1s, 2s, 4s...
				const delay = 1000 * Math.pow(2, attempt);
				await sleep(delay);
			}
		}

		// All retries failed
		const errorMessage = lastError?.message || 'Unknown error';

		if (errorMessage.includes('Transcript is disabled')) {
			throw new TranscriptNotFoundError('Transcript is disabled for this video');
		} else if (errorMessage.includes('No transcript found')) {
			throw new TranscriptNotFoundError('No transcript available for this video');
		} else {
			throw new TranscriptNotFoundError(
				`Failed to download transcript after ${this.maxRetries} attempts: ${errorMessage}`
			);
		}
	}

	/**
	 * Get video metadata from YouTube (title, author, etc.)
	 * This is a helper method that can be called separately
	 */
	async getVideoMetadata(videoId: string): Promise<VideoMetadata> {
		try {
			// Fetch video page to extract metadata
			const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
			const html = await response.text();

			// Extract title
			const titleMatch = html.match(/<title>(.+?)<\/title>/);
			const title = titleMatch
				? titleMatch[1].replace(' - YouTube', '').trim()
				: 'Unknown';

			// Extract channel name (simplified - may need adjustment)
			const authorMatch = html.match(/"author":"(.+?)"/);
			const author = authorMatch ? authorMatch[1] : 'Unknown';

			// Extract publish date if available
			const dateMatch = html.match(/"publishDate":"(.+?)"/);
			const publishDate = dateMatch ? dateMatch[1] : undefined;

			return {
				title,
				author,
				publishDate
			};
		} catch (error) {
			console.warn('Failed to fetch video metadata:', error);
			return {
				title: 'Unknown',
				author: 'Unknown'
			};
		}
	}

	/**
	 * Download transcript with full metadata
	 */
	async downloadWithMetadata(
		videoId: string,
		languages: string[] = ['ko', 'en']
	): Promise<TranscriptResult> {
		// Download transcript and metadata in parallel
		const [transcriptResult, metadata] = await Promise.all([
			this.download(videoId, languages),
			this.getVideoMetadata(videoId)
		]);

		// Merge metadata
		return {
			text: transcriptResult.text,
			metadata: {
				...transcriptResult.metadata,
				...metadata
			}
		};
	}
}
