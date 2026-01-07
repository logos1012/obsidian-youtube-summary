#!/usr/bin/env python3
import re
import urllib.request
import json

def test_transcript(video_id):
    # YouTube 페이지 가져오기
    url = f"https://www.youtube.com/watch?v={video_id}"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    })

    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')

    # ytInitialPlayerResponse 찾기
    pattern = r'var ytInitialPlayerResponse = ({.*?});'
    match = re.search(pattern, html)

    if not match:
        print("ytInitialPlayerResponse를 찾을 수 없습니다.")
        return

    player_response = json.loads(match.group(1))

    # 자막 트랙 정보 출력
    captions = player_response.get('captions', {})
    caption_tracks = captions.get('playerCaptionsTracklistRenderer', {}).get('captionTracks', [])

    if not caption_tracks:
        print("사용 가능한 자막이 없습니다.")
        return

    print(f"자막 트랙 수: {len(caption_tracks)}")

    for i, track in enumerate(caption_tracks):
        print(f"\n트랙 {i+1}:")
        print(f"  언어: {track.get('languageCode', 'Unknown')}")
        print(f"  이름: {track.get('name', {}).get('simpleText', 'Unknown')}")
        print(f"  baseUrl: {track.get('baseUrl', '')[:200]}...")

    # 첫 번째 트랙으로 다양한 형식 시도
    base_url = caption_tracks[0]['baseUrl']

    formats = [
        ('xml', '&fmt=srv3'),
        ('vtt', '&fmt=vtt'),
        ('json3', '&fmt=json3'),
        ('ttml', '&fmt=ttml'),
    ]

    for fmt_name, fmt_param in formats:
        test_url = base_url + fmt_param
        print(f"\n\n=== {fmt_name.upper()} 형식 테스트 ===")
        print(f"URL: {test_url[:200]}...")

        req = urllib.request.Request(test_url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': f'https://www.youtube.com/watch?v={video_id}',
            'Origin': 'https://www.youtube.com'
        })

        try:
            with urllib.request.urlopen(req) as response:
                data = response.read().decode('utf-8')
                print(f"응답 길이: {len(data)} 바이트")
                print(f"응답 샘플:\n{data[:500]}")

                if len(data) > 0:
                    print(f"\n✅ {fmt_name} 형식 성공!")
                    # 파일로 저장
                    with open(f'/Users/jake/Desktop/youtube/test_{video_id}_{fmt_name}.txt', 'w', encoding='utf-8') as f:
                        f.write(data)
                    print(f"파일 저장: test_{video_id}_{fmt_name}.txt")
        except Exception as e:
            print(f"❌ 오류: {e}")

if __name__ == "__main__":
    video_id = "mjhbD2hNktw"
    test_transcript(video_id)
