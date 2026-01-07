import { TranscriptResult, VideoMetadata } from '../types';
import { TranscriptNotFoundError } from '../utils/errors';
import { sleep } from '../utils/helpers';
import { requestUrl } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export class TranscriptDownloader {
	private maxRetries: number;
	private pluginDir: string;

	constructor(maxRetries: number = 3, pluginDir?: string) {
		this.maxRetries = maxRetries;
		// @ts-ignore - app.vault.adapter.basePath is available in Obsidian
		this.pluginDir = pluginDir || '';
	}

	/**
	 * Download YouTube transcript using Python script
	 */
	async download(
		videoId: string,
		languages: string[] = ['ko', 'en']
	): Promise<TranscriptResult> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			try {
				console.log(`Attempting to download transcript for video ${videoId} (attempt ${attempt + 1}/${this.maxRetries})`);

				// Path to Python script
				const scriptPath = path.join(this.pluginDir, 'scripts', 'download_transcript.py');

				// Build command
				const languageArgs = languages.join(' ');
				const command = `python3 "${scriptPath}" "${videoId}" ${languageArgs}`;

				console.log(`Executing: ${command}`);

				// Execute Python script
				const { stdout, stderr } = await execAsync(command, {
					timeout: 30000, // 30 second timeout
					maxBuffer: 1024 * 1024 * 10 // 10MB buffer
				});

				if (stderr) {
					console.warn('Python script stderr:', stderr);
				}

				// Parse JSON output
				const result = JSON.parse(stdout);

				if (!result.success) {
					throw new Error(result.error || 'Unknown error from Python script');
				}

				const fullText = result.text.replace(/\s+/g, ' ').trim();

				console.log(`Transcript downloaded successfully. Length: ${fullText.length} characters, Language: ${result.language}`);

				// Get video metadata
				const metadata = await this.extractMetadata(videoId);

				return {
					text: fullText,
					metadata
				};

			} catch (error) {
				lastError = error as Error;
				console.error(`Attempt ${attempt + 1} failed:`, error.message);

				// Check if it's a Python-related error
				if (error.message.includes('python3') || error.message.includes('not found')) {
					throw new TranscriptNotFoundError(
						'Python 3 is required but not found. Please install Python 3 to use this plugin.'
					);
				}

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
		if (errorMessage.includes('Transcript is disabled')) {
			throw new TranscriptNotFoundError('Transcript is disabled for this video');
		} else if (errorMessage.includes('No transcript available')) {
			throw new TranscriptNotFoundError('No transcript available for this video');
		} else if (errorMessage.includes('Video is unavailable')) {
			throw new TranscriptNotFoundError('Video is unavailable or has been deleted');
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

	/**
	 * Set plugin directory for finding Python script
	 */
	setPluginDir(dir: string) {
		this.pluginDir = dir;
	}
}
