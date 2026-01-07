import { YoutubeTranscript } from 'youtube-transcript';
import { TranscriptResult, VideoMetadata } from '../types';
import { TranscriptNotFoundError } from '../utils/errors';
import { sleep } from '../utils/helpers';
import { requestUrl } from 'obsidian';

export class TranscriptDownloader {
	private maxRetries: number;

	constructor(maxRetries: number = 3) {
		this.maxRetries = maxRetries;
	}

	/**
	 * Download YouTube transcript using youtube-transcript library
	 */
	async download(
		videoId: string,
		languages: string[] = ['ko', 'en']
	): Promise<TranscriptResult> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			try {
				console.log(`Attempting to download transcript for video ${videoId} (attempt ${attempt + 1}/${this.maxRetries})`);

				// Try each language in order
				let transcript = null;
				let usedLang = languages[0];

				for (const lang of languages) {
					try {
						console.log(`Trying language: ${lang}`);
						transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
						usedLang = lang;
						console.log(`Successfully fetched transcript in ${lang}`);
						break;
					} catch (langError) {
						console.log(`Failed to fetch in ${lang}:`, langError.message);
						// Try next language
						continue;
					}
				}

				// If no language worked, try without specifying language
				if (!transcript) {
					console.log('Trying to fetch transcript without language specification');
					transcript = await YoutubeTranscript.fetchTranscript(videoId);
				}

				if (!transcript || transcript.length === 0) {
					throw new Error('No transcript data received');
				}

				// Combine all transcript segments
				const fullText = transcript
					.map((item: any) => item.text)
					.join(' ')
					.replace(/\s+/g, ' ')
					.trim();

				console.log(`Transcript downloaded successfully. Length: ${fullText.length} characters`);

				// Get video metadata
				const metadata = await this.extractMetadata(videoId);

				return {
					text: fullText,
					metadata
				};

			} catch (error) {
				lastError = error as Error;
				console.error(`Attempt ${attempt + 1} failed:`, error.message);

				// If it's the last attempt, throw
				if (attempt === this.maxRetries - 1) {
					break;
				}

				// Exponential backoff: wait 1s, 2s, 4s...
				const delay = 1000 * Math.pow(2, attempt);
				console.log(`Waiting ${delay}ms before retry...`);
				await sleep(delay);
			}
		}

		// All retries failed
		const errorMessage = lastError?.message || 'Unknown error';

		console.error('All attempts failed. Last error:', errorMessage);

		// Map common errors to user-friendly messages
		if (errorMessage.includes('No transcripts are available')) {
			throw new TranscriptNotFoundError('No transcript available for this video');
		} else if (errorMessage.includes('video is no longer available')) {
			throw new TranscriptNotFoundError('Video is unavailable or has been deleted');
		} else if (errorMessage.includes('Transcript is disabled')) {
			throw new TranscriptNotFoundError('Transcript is disabled for this video');
		} else if (errorMessage.includes('too many requests')) {
			throw new TranscriptNotFoundError('YouTube is receiving too many requests. Please try again later.');
		} else {
			throw new TranscriptNotFoundError(
				`Failed to download transcript after ${this.maxRetries} attempts: ${errorMessage}`
			);
		}
	}

	/**
	 * Extract video metadata from YouTube page
	 */
	private async extractMetadata(videoId: string): Promise<VideoMetadata> {
		try {
			const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
			const pageResponse = await requestUrl({
				url: pageUrl,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36'
				}
			});

			const html = pageResponse.text;

			// Extract title
			const titleMatch = html.match(/<title>(.+?)<\/title>/);
			const title = titleMatch
				? titleMatch[1].replace(' - YouTube', '').trim()
				: 'Unknown';

			// Extract channel name
			const authorMatch = html.match(/"author":"(.+?)"/);
			const author = authorMatch ? authorMatch[1] : 'Unknown';

			// Extract publish date
			const dateMatch = html.match(/"publishDate":"(.+?)"/);
			const publishDate = dateMatch ? dateMatch[1] : undefined;

			return {
				title,
				author,
				publishDate
			};
		} catch (error) {
			console.warn('Failed to extract metadata:', error);
			return {
				title: 'Unknown',
				author: 'Unknown'
			};
		}
	}

	/**
	 * Download transcript with full metadata (same as download now)
	 */
	async downloadWithMetadata(
		videoId: string,
		languages: string[] = ['ko', 'en']
	): Promise<TranscriptResult> {
		return this.download(videoId, languages);
	}
}
