#!/usr/bin/env python3
"""
YouTube 트랜스크립트 다운로더 (youtube-transcript-api 사용)
"""

from youtube_transcript_api import YouTubeTranscriptApi
import json

def download_transcript(video_id):
    """YouTube 비디오의 트랜스크립트를 다운로드합니다."""

    try:
        print(f"비디오 ID: {video_id}")
        print("트랜스크립트 다운로드 중...\n")

        # 트랜스크립트 가져오기 (한국어 우선)
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=['ko', 'en'])

        # 스니펫에서 텍스트 추출
        transcript = [{'text': s.text, 'start': s.start, 'duration': s.duration}
                     for s in fetched.snippets]

        # 전체 텍스트 조합
        full_text = ' '.join([entry['text'] for entry in transcript])

        # 결과 출력
        print("="*80)
        print("전체 트랜스크립트:")
        print("="*80)
        print(full_text)
        print("\n" + "="*80)
        print(f"총 길이: {len(full_text)} 문자")
        print(f"세그먼트 수: {len(transcript)}개")

        # 파일로 저장 (텍스트)
        txt_file = f'/Users/jake/Desktop/youtube/transcript_{video_id}.txt'
        with open(txt_file, 'w', encoding='utf-8') as f:
            f.write(full_text)
        print(f"\n텍스트 파일 저장: {txt_file}")

        # 파일로 저장 (타임스탬프 포함 JSON)
        json_file = f'/Users/jake/Desktop/youtube/transcript_{video_id}.json'
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(transcript, f, ensure_ascii=False, indent=2)
        print(f"JSON 파일 저장: {json_file}")

        return transcript

    except Exception as e:
        print(f"오류 발생: {e}")
        return None


if __name__ == "__main__":
    video_id = "mjhbD2hNktw"
    download_transcript(video_id)
