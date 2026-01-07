#!/usr/bin/env python3
"""
YouTube transcript downloader for Obsidian plugin
Uses youtube-transcript-api to bypass CORS restrictions
"""

import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi

def download_transcript(video_id, languages=['ko', 'en']):
    """Download YouTube transcript with error handling"""
    try:
        # Fetch transcript using youtube-transcript-api
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=languages)

        # Extract text from snippets
        transcript = [s.text for s in fetched.snippets]
        full_text = ' '.join(transcript)

        # Return success
        return {
            'success': True,
            'text': full_text,
            'language': fetched.language
        }

    except Exception as e:
        error_msg = str(e)

        # Try to provide more specific error messages
        if 'disable' in error_msg.lower() or 'unavailable' in error_msg.lower():
            return {
                'success': False,
                'error': 'No transcript available for this video'
            }
        elif 'video' in error_msg.lower() and ('private' in error_msg.lower() or 'deleted' in error_msg.lower()):
            return {
                'success': False,
                'error': 'Video is unavailable or has been deleted'
            }
        else:
            return {
                'success': False,
                'error': f'Failed to download transcript: {error_msg}'
            }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Video ID is required'
        }))
        sys.exit(1)

    video_id = sys.argv[1]
    languages = sys.argv[2:] if len(sys.argv) > 2 else ['ko', 'en']

    result = download_transcript(video_id, languages)
    print(json.dumps(result, ensure_ascii=False))
