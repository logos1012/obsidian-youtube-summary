/**
 * Based on: https://github.com/ljantzen/obsidian-youtube-transcript
 * License: MIT
 */

import { requestUrl } from 'obsidian';
import { TranscriptResult, VideoMetadata, TranscriptSegment } from '../types';
import { TranscriptNotFoundError } from '../utils/errors';
import { sleep } from '../utils/helpers';

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

interface CaptionTrack {
	baseUrl: string;
	languageCode: string;
	name?: { simpleText?: string };
	kind?: string;
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

				const watchPageResponse = await requestUrl({
					url: `https://www.youtube.com/watch?v=${videoId}`,
					headers: {
						'User-Agent': USER_AGENT,
						'Accept-Language': 'en-US,en;q=0.9',
					},
				});

				const pageHtml = watchPageResponse.text;

				if (pageHtml.includes('class="g-recaptcha"')) {
					throw new TranscriptNotFoundError(
						'YouTube is receiving too many requests. Please try again later.'
					);
				}

				const apiKeyMatch = pageHtml.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
				if (!apiKeyMatch?.[1]) {
					throw new TranscriptNotFoundError('Could not extract YouTube API key');
				}

				const innertubeResponse = await requestUrl({
					url: `https://www.youtube.com/youtubei/v1/player?key=${apiKeyMatch[1]}`,
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'User-Agent': USER_AGENT,
						'Accept': 'application/json',
					},
					body: JSON.stringify({
						context: {
							client: {
								clientName: 'WEB',
								clientVersion: '2.20231219.00.00',
								hl: 'en',
								gl: 'US',
							},
						},
						videoId: videoId,
					}),
				});

				const videoData = innertubeResponse.json;

				const videoDetails = videoData?.videoDetails;
				const metadata: VideoMetadata = {
					title: videoDetails?.title || 'Unknown',
					author: videoDetails?.author || 'Unknown',
					duration: videoDetails?.lengthSeconds ? parseInt(videoDetails.lengthSeconds, 10) : undefined,
				};

				const captionTracks: CaptionTrack[] = 
					videoData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

				if (!captionTracks?.length) {
					throw new TranscriptNotFoundError('No transcript available for this video');
				}

				const captionTrack = this.findBestCaptionTrack(captionTracks, languages);
				if (!captionTrack) {
					const availableLangs = captionTracks.map(t => t.languageCode).join(', ');
					throw new TranscriptNotFoundError(
						`No transcript in ${languages.join('/')}. Available: ${availableLangs}`
					);
				}

				console.log(`Found transcript in language: ${captionTrack.languageCode}`);

				const transcriptResponse = await requestUrl({
					url: captionTrack.baseUrl,
					headers: { 'User-Agent': USER_AGENT },
				});

				const transcriptXml = transcriptResponse.text;
				if (!transcriptXml?.trim()) {
					throw new TranscriptNotFoundError('Transcript response is empty');
				}

				const segments = this.parseTranscriptXML(transcriptXml);
				if (segments.length === 0) {
					throw new TranscriptNotFoundError('Could not parse transcript');
				}

				const decodedSegments = segments.map(s => ({
					...s,
					text: this.decodeHTMLEntities(s.text)
				}));

				const fullText = decodedSegments
					.map(s => s.text)
					.join(' ')
					.replace(/\s+/g, ' ')
					.trim();

				console.log(`Transcript downloaded: ${fullText.length} characters`);

				return { text: fullText, segments: decodedSegments, metadata };

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
			`Failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
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

	formatTimestamp(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		
		if (h > 0) {
			return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		}
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	private decodeHTMLEntities(text: string): string {
		const entities: Record<string, string> = {
			'&amp;': '&',
			'&lt;': '<',
			'&gt;': '>',
			'&quot;': '"',
			'&#39;': "'",
			'&apos;': "'",
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

	async downloadWithMetadata(
		videoId: string,
		languages: string[] = ['ko', 'en']
	): Promise<TranscriptResult> {
		return this.download(videoId, languages);
	}
}
