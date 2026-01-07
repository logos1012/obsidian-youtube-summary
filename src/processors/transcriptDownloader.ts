import { requestUrl } from 'obsidian';
import { TranscriptResult, VideoMetadata } from '../types';
import { TranscriptNotFoundError } from '../utils/errors';
import { sleep } from '../utils/helpers';

interface CaptionTrack {
	baseUrl: string;
	name?: {
		simpleText: string;
	};
	languageCode?: string;
}

interface TranscriptSegment {
	segs?: Array<{
		utf8?: string;
	}>;
}

export class TranscriptDownloader {
	private maxRetries: number;

	constructor(maxRetries: number = 3) {
		this.maxRetries = maxRetries;
	}

	/**
	 * Download YouTube transcript with retry logic using Obsidian's requestUrl
	 */
	async download(
		videoId: string,
		languages: string[] = ['ko', 'en']
	): Promise<TranscriptResult> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			try {
				// Fetch YouTube page HTML
				const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
				const pageResponse = await requestUrl({
					url: pageUrl,
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
					}
				});

				const html = pageResponse.text;

				// Extract ytInitialPlayerResponse
				const playerResponseMatch = html.match(/var ytInitialPlayerResponse = ({.*?});/);
				if (!playerResponseMatch) {
					throw new Error('Could not find ytInitialPlayerResponse');
				}

				const playerResponse = JSON.parse(playerResponseMatch[1]);

				// Get caption tracks
				const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
				if (!captions || captions.length === 0) {
					throw new Error('No captions available for this video');
				}

				// Find caption track in preferred language
				let captionTrack: CaptionTrack | null = null;
				for (const lang of languages) {
					captionTrack = captions.find((track: CaptionTrack) =>
						track.languageCode?.startsWith(lang)
					);
					if (captionTrack) break;
				}

				// If no preferred language found, use first available
				if (!captionTrack) {
					captionTrack = captions[0];
				}

				// Get caption URL and request JSON format

				// Double-check we have a valid caption track
				if (!captionTrack) {
					throw new Error('No valid caption track found');
				}

				let captionUrl = captionTrack.baseUrl;
				if (captionUrl.includes('?')) {
					captionUrl += '&fmt=json3';
				} else {
					captionUrl += '?fmt=json3';
				}

				// Download caption data
				const captionResponse = await requestUrl({
					url: captionUrl,
					headers: {
						'User-Agent': 'Mozilla/5.0',
						'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
					}
				});

				// Validate response before parsing
				if (!captionResponse.text || captionResponse.text.trim() === '') {
					throw new Error('Empty response from YouTube caption API');
				}

				// Parse caption JSON with error handling
				let captionData;
				try {
					captionData = captionResponse.json;
				} catch (parseError) {
					console.error('JSON parse error. Response text:', captionResponse.text.substring(0, 500));
					throw new Error(`Failed to parse caption JSON: ${parseError.message}`);
				}

				if (!captionData) {
					throw new Error('Caption data is null or undefined');
				}

				const events = captionData.events || [];

				// Extract text from segments
				const texts: string[] = [];
				for (const event of events) {
					if (event.segs) {
						for (const seg of event.segs) {
							if (seg.utf8) {
								texts.push(seg.utf8);
							}
						}
					}
				}

				if (texts.length === 0) {
					throw new Error('No transcript text found');
				}

				const fullText = texts
					.join('')
					.replace(/\s+/g, ' ')
					.trim();

				// Extract metadata from page
				const metadata = this.extractMetadataFromHtml(html);

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

		if (errorMessage.includes('No captions available')) {
			throw new TranscriptNotFoundError('No transcript available for this video');
		} else if (errorMessage.includes('ytInitialPlayerResponse')) {
			throw new TranscriptNotFoundError('Could not access video data. Video may be private or deleted.');
		} else {
			throw new TranscriptNotFoundError(
				`Failed to download transcript after ${this.maxRetries} attempts: ${errorMessage}`
			);
		}
	}

	/**
	 * Extract video metadata from HTML
	 */
	private extractMetadataFromHtml(html: string): VideoMetadata {
		try {
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
		// Since download() now includes metadata extraction, just call it
		return this.download(videoId, languages);
	}
}
