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

export class TranscriptDownloader {
	private maxRetries: number;
	private readonly RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

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
						'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36'
					}
				});

				const html = pageResponse.text;

				// Extract captions from HTML (different parsing method)
				const splittedHTML = html.split('"captions":');

				if (splittedHTML.length <= 1) {
					if (html.includes('class="g-recaptcha"')) {
						throw new Error('YouTube requires captcha - too many requests');
					}
					if (!html.includes('"playabilityStatus":')) {
						throw new Error('Video unavailable');
					}
					throw new Error('No captions available for this video');
				}

				// Parse captions JSON
				let captionsData;
				try {
					const captionsJSON = splittedHTML[1].split(',"videoDetails')[0].replace('\n', '');
					captionsData = JSON.parse(captionsJSON);
				} catch (e) {
					throw new Error('Could not parse captions data');
				}

				const captions = captionsData?.playerCaptionsTracklistRenderer;
				if (!captions || !captions.captionTracks) {
					throw new Error('No caption tracks available');
				}

				// Find caption track in preferred language
				let captionTrack: CaptionTrack | null = null;
				for (const lang of languages) {
					captionTrack = captions.captionTracks.find((track: CaptionTrack) =>
						track.languageCode?.startsWith(lang)
					);
					if (captionTrack) break;
				}

				// If no preferred language found, use first available
				if (!captionTrack) {
					captionTrack = captions.captionTracks[0];
				}

				if (!captionTrack) {
					throw new Error('No valid caption track found');
				}

				// Get caption URL (use XML format, not JSON3)
				const captionUrl = captionTrack.baseUrl;

				console.log('Downloading transcript from:', captionUrl.substring(0, 100) + '...');

				// Download caption data (XML format)
				const captionResponse = await requestUrl({
					url: captionUrl,
					headers: {
						'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36',
						'Accept-Language': languages.join(',')
					}
				});

				const transcriptXML = captionResponse.text;

				if (!transcriptXML || transcriptXML.trim() === '') {
					throw new Error('Empty response from caption API');
				}

				console.log('Transcript XML length:', transcriptXML.length);

				// Parse XML transcript
				const matches = [...transcriptXML.matchAll(this.RE_XML_TRANSCRIPT)];

				if (matches.length === 0) {
					console.error('No matches found. XML sample:', transcriptXML.substring(0, 500));
					throw new Error('No transcript text found in XML');
				}

				// Extract and decode text
				const texts = matches.map(match => {
					const text = match[3];
					// Decode HTML entities
					return text
						.replace(/&amp;/g, '&')
						.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
						.replace(/&quot;/g, '"')
						.replace(/&#39;/g, "'")
						.replace(/&nbsp;/g, ' ');
				});

				const fullText = texts
					.join(' ')
					.replace(/\s+/g, ' ')
					.trim();

				if (!fullText) {
					throw new Error('Transcript text is empty after parsing');
				}

				console.log('Transcript extracted successfully. Length:', fullText.length);

				// Extract metadata from page
				const metadata = this.extractMetadataFromHtml(html);

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
				await sleep(delay);
			}
		}

		// All retries failed
		const errorMessage = lastError?.message || 'Unknown error';

		if (errorMessage.includes('No captions available') || errorMessage.includes('No caption tracks')) {
			throw new TranscriptNotFoundError('No transcript available for this video');
		} else if (errorMessage.includes('Video unavailable')) {
			throw new TranscriptNotFoundError('Could not access video data. Video may be private or deleted.');
		} else if (errorMessage.includes('captcha')) {
			throw new TranscriptNotFoundError('YouTube is blocking requests. Please try again later.');
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
