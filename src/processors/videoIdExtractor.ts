import { VideoIdNotFoundError } from '../utils/errors';
import { sanitizeVideoId } from '../utils/helpers';

export class VideoIdExtractor {
	/**
	 * Extract YouTube video ID from various URL formats
	 * Supports:
	 * - https://www.youtube.com/watch?v=VIDEO_ID
	 * - https://youtu.be/VIDEO_ID
	 * - https://www.youtube.com/embed/VIDEO_ID
	 * - URLs with additional parameters (&t=120s, etc.)
	 */
	extract(url: string): string {
		if (!url || typeof url !== 'string') {
			throw new VideoIdNotFoundError('Invalid URL provided');
		}

		// Pattern 1: youtube.com/watch?v=VIDEO_ID
		const watchPattern = /[?&]v=([a-zA-Z0-9_-]{11})/;
		let match = url.match(watchPattern);
		if (match) {
			return sanitizeVideoId(match[1]);
		}

		// Pattern 2: youtu.be/VIDEO_ID
		const shortPattern = /youtu\.be\/([a-zA-Z0-9_-]{11})/;
		match = url.match(shortPattern);
		if (match) {
			return sanitizeVideoId(match[1]);
		}

		// Pattern 3: youtube.com/embed/VIDEO_ID
		const embedPattern = /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/;
		match = url.match(embedPattern);
		if (match) {
			return sanitizeVideoId(match[1]);
		}

		// Pattern 4: Try to extract any 11-character alphanumeric string after common YouTube patterns
		const genericPattern = /(?:youtube\.com|youtu\.be).*?([a-zA-Z0-9_-]{11})/;
		match = url.match(genericPattern);
		if (match) {
			return sanitizeVideoId(match[1]);
		}

		throw new VideoIdNotFoundError(`Could not extract video ID from URL: ${url}`);
	}
}
