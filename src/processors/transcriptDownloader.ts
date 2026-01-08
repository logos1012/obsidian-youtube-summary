/**
 * Based on: https://github.com/glowingjade/obsidian-smart-composer
 * License: MIT
 */

import { requestUrl } from 'obsidian';
import { TranscriptResult, VideoMetadata } from '../types';
import { TranscriptNotFoundError } from '../utils/errors';
import { sleep } from '../utils/helpers';

const RE_YOUTUBE =
	/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;

const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

interface CaptionTrack {
	baseUrl: string;
	languageCode: string;
	name?: { simpleText?: string };
	kind?: string;
}

interface TranscriptSegment {
	text: string;
	duration: number;
	offset: number;
}

export class TranscriptDownloader {
	private maxRetries: number;

	constructor(maxRetries: number = 3) {
		this.maxRetries = maxRetries;
	}

	async download(
		videoId: string,
		languages: string[] = ['ko', 'en']
	): Promise<TranscriptResult> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			try {
				console.log(`Downloading transcript for ${videoId} (attempt ${attempt + 1}/${this.maxRetries})`);

				const videoPageResponse = await requestUrl({
					url: `https://www.youtube.com/watch?v=${videoId}`,
					headers: {
						'User-Agent': USER_AGENT,
						'Accept-Language': languages.join(','),
					},
				});

				const videoPageBody = videoPageResponse.text;

				if (videoPageBody.includes('class="g-recaptcha"')) {
					throw new TranscriptNotFoundError(
						'YouTube is receiving too many requests. Please try again later.'
					);
				}

				if (!videoPageBody.includes('"playabilityStatus":')) {
					throw new TranscriptNotFoundError(
						'Video is unavailable or has been deleted'
					);
				}

				const splittedHTML = videoPageBody.split('"captions":');
				if (splittedHTML.length <= 1) {
					throw new TranscriptNotFoundError(
						'Transcript is disabled on this video'
					);
				}

				let captions: { captionTracks?: CaptionTrack[] } | undefined;
				try {
					const captionsJson = splittedHTML[1].split(',"videoDetails')[0].replace('\n', '');
					captions = JSON.parse(captionsJson)?.playerCaptionsTracklistRenderer;
				} catch (e) {
					throw new TranscriptNotFoundError('Failed to parse captions data');
				}

				if (!captions?.captionTracks?.length) {
					throw new TranscriptNotFoundError('No transcript available for this video');
				}

				const captionTrack = this.findBestCaptionTrack(captions.captionTracks, languages);
				if (!captionTrack) {
					const availableLangs = captions.captionTracks.map(t => t.languageCode).join(', ');
					throw new TranscriptNotFoundError(
						`No transcript available in ${languages.join('/')}. Available: ${availableLangs}`
					);
				}

				console.log(`Found transcript in language: ${captionTrack.languageCode}`);

				const transcriptResponse = await requestUrl({
					url: captionTrack.baseUrl,
					headers: { 'User-Agent': USER_AGENT },
				});

				if (transcriptResponse.status !== 200) {
					throw new TranscriptNotFoundError('Failed to download transcript');
				}

				const segments = this.parseTranscriptXML(transcriptResponse.text);

				if (segments.length === 0) {
					throw new TranscriptNotFoundError('Transcript is empty');
				}

				const fullText = segments
					.map(s => this.decodeHTMLEntities(s.text))
					.join(' ')
					.replace(/\s+/g, ' ')
					.trim();

				console.log(`Transcript downloaded: ${fullText.length} characters`);

				return {
					text: fullText,
					metadata: this.extractMetadataFromPage(videoPageBody)
				};

			} catch (error) {
				lastError = error as Error;
				console.error(`Attempt ${attempt + 1} failed:`, (error as Error).message);

				if (error instanceof TranscriptNotFoundError) {
					throw error;
				}

				if (attempt === this.maxRetries - 1) {
					break;
				}

				const delay = 1000 * Math.pow(2, attempt);
				console.log(`Waiting ${delay}ms before retry...`);
				await sleep(delay);
			}
		}

		throw new TranscriptNotFoundError(
			`Failed to download transcript after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
		);
	}

	private findBestCaptionTrack(
		tracks: CaptionTrack[],
		preferredLanguages: string[]
	): CaptionTrack | null {
		for (const lang of preferredLanguages) {
			const exactMatch = tracks.find(t => t.languageCode === lang);
			if (exactMatch) return exactMatch;
		}

		for (const lang of preferredLanguages) {
			const partialMatch = tracks.find(t => t.languageCode.startsWith(lang));
			if (partialMatch) return partialMatch;
		}

		const manualTrack = tracks.find(t => t.kind !== 'asr');
		if (manualTrack) return manualTrack;

		return tracks[0] || null;
	}

	private parseTranscriptXML(xml: string): TranscriptSegment[] {
		const results: TranscriptSegment[] = [];
		let match;

		while ((match = RE_XML_TRANSCRIPT.exec(xml)) !== null) {
			results.push({
				offset: parseFloat(match[1]),
				duration: parseFloat(match[2]),
				text: match[3]
			});
		}

		RE_XML_TRANSCRIPT.lastIndex = 0;

		return results;
	}

	private decodeHTMLEntities(text: string): string {
		const entities: Record<string, string> = {
			'&amp;': '&',
			'&lt;': '<',
			'&gt;': '>',
			'&quot;': '"',
			'&#39;': "'",
			'&apos;': "'",
			'&#x27;': "'",
			'&#x2F;': '/',
			'&#32;': ' ',
			'&nbsp;': ' ',
		};

		let decoded = text;
		for (const [entity, char] of Object.entries(entities)) {
			decoded = decoded.replace(new RegExp(entity, 'g'), char);
		}

		decoded = decoded.replace(/&#(\d+);/g, (_, num) => 
			String.fromCharCode(parseInt(num, 10))
		);
		decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => 
			String.fromCharCode(parseInt(hex, 16))
		);

		return decoded;
	}

	private extractMetadataFromPage(html: string): VideoMetadata {
		const titleMatch = html.match(/<title>(.*?)<\/title>/);
		const title = titleMatch
			? titleMatch[1].replace(' - YouTube', '').trim()
			: 'Unknown';

		const authorMatch = html.match(/"author":"([^"]+)"/);
		const author = authorMatch ? authorMatch[1] : 'Unknown';

		const dateMatch = html.match(/"publishDate":"([^"]+)"/);
		const publishDate = dateMatch ? dateMatch[1] : undefined;

		const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
		const duration = durationMatch ? parseInt(durationMatch[1], 10) : undefined;

		return { title, author, publishDate, duration };
	}

	async downloadWithMetadata(
		videoId: string,
		languages: string[] = ['ko', 'en']
	): Promise<TranscriptResult> {
		return this.download(videoId, languages);
	}

	static extractVideoId(url: string): string | null {
		if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
			return url;
		}

		const match = url.match(RE_YOUTUBE);
		return match ? match[1] : null;
	}
}
