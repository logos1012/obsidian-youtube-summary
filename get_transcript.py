#!/usr/bin/env python3
"""
YouTube 트랜스크립트 다운로더
API 키 없이 YouTube 자막을 가져옵니다.
"""

import re
import urllib.request
import html as html_lib
import json

def get_transcript(video_id):
    """YouTube 비디오의 트랜스크립트를 가져옵니다."""

    # YouTube 페이지 가져오기
    url = f"https://www.youtube.com/watch?v={video_id}"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')

    # ytInitialPlayerResponse에서 자막 정보 찾기
    pattern = r'var ytInitialPlayerResponse = ({.*?});'
    match = re.search(pattern, html)

    if not match:
        print("ytInitialPlayerResponse를 찾을 수 없습니다.")
        return None

    try:
        player_response = json.loads(match.group(1))

        # 자막 트랙 찾기
        captions = player_response.get('captions', {})
        caption_tracks = captions.get('playerCaptionsTracklistRenderer', {}).get('captionTracks', [])

        if not caption_tracks:
            print("사용 가능한 자막이 없습니다.")
            return None

        # 첫 번째 자막 트랙 사용
        caption_url = caption_tracks[0]['baseUrl']

        # JSON 형식 요청
        if '?' in caption_url:
            caption_url += '&fmt=json3'
        else:
            caption_url += '?fmt=json3'

        print(f"자막 다운로드 중... ({caption_tracks[0].get('name', {}).get('simpleText', 'Unknown')})")
        print(f"URL: {caption_url[:150]}...")

        # 자막 다운로드
        req = urllib.request.Request(caption_url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        })

        try:
            with urllib.request.urlopen(req) as response:
                caption_data = response.read().decode('utf-8')
                print(f"응답 길이: {len(caption_data)} 바이트")
        except Exception as e:
            print(f"URL 요청 오류: {e}")
            return None

        # JSON 파싱
        try:
            caption_json = json.loads(caption_data)
            events = caption_json.get('events', [])

            texts = []
            for event in events:
                if 'segs' in event:
                    for seg in event['segs']:
                        if 'utf8' in seg:
                            texts.append(seg['utf8'])

            if not texts:
                print("자막 텍스트를 추출할 수 없습니다.")
                return None

            return ''.join(texts)

        except json.JSONDecodeError:
            print("JSON 파싱 실패. XML 형식 시도...")
            # XML 파싱 폴백
            text_pattern = r'<text[^>]*>([^<]+)</text>'
            texts = re.findall(text_pattern, caption_data)

            if not texts:
                print("자막 텍스트를 추출할 수 없습니다.")
                print("데이터 샘플:", caption_data[:200])
                return None

            # HTML 엔티티 디코드
            decoded_texts = [html_lib.unescape(text) for text in texts]
            return ' '.join(decoded_texts)

    except Exception as e:
        print(f"오류 발생: {e}")
        return None


if __name__ == "__main__":
    video_id = "mjhbD2hNktw"
    transcript = get_transcript(video_id)

    if transcript:
        print("\n" + "="*80)
        print("전체 트랜스크립트:")
        print("="*80 + "\n")
        print(transcript)
        print(f"\n\n총 길이: {len(transcript)} 문자")

        # 파일로 저장
        with open(f'/Users/jake/Desktop/youtube/transcript_{video_id}.txt', 'w', encoding='utf-8') as f:
            f.write(transcript)
        print(f"\n트랜스크립트가 transcript_{video_id}.txt 파일로 저장되었습니다.")
