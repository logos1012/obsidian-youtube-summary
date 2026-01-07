export class VideoIdNotFoundError extends Error {
	constructor(message: string = 'Could not extract video ID from URL') {
		super(message);
		this.name = 'VideoIdNotFoundError';
	}
}

export class TranscriptNotFoundError extends Error {
	constructor(message: string = 'No transcript available for this video') {
		super(message);
		this.name = 'TranscriptNotFoundError';
	}
}

export class AIProcessingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AIProcessingError';
	}
}

export class APIKeyMissingError extends Error {
	constructor(message: string = 'Please configure Claude API key in settings') {
		super(message);
		this.name = 'APIKeyMissingError';
	}
}
