// 플러그인 테스트 스크립트
import Anthropic from '@anthropic-ai/sdk';

const VIDEO_URL = process.env.VIDEO_URL || 'https://youtu.be/cQNfCj7xTcU';
const API_KEY = process.env.CLAUDE_API_KEY || '';

// ============ 1. 비디오 ID 추출 ============
function extractVideoId(url) {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error('비디오 ID를 찾을 수 없습니다');
}

// ============ 2. 자막 다운로드 ============
async function downloadTranscript(videoId, preferredLangs = ['ko', 'en']) {
  console.log(`\n📥 자막 다운로드 중... (videoId: ${videoId})`);

  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  const html = await response.text();

  // 제목 추출
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Unknown';

  // ytInitialPlayerResponse에서 자막 정보 추출
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
  if (!playerResponseMatch) {
    throw new Error('플레이어 응답을 찾을 수 없습니다');
  }

  const playerResponse = JSON.parse(playerResponseMatch[1]);
  const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!captions || captions.length === 0) {
    throw new Error('자막을 찾을 수 없습니다');
  }

  console.log(`   사용 가능한 자막: ${captions.map(c => c.languageCode).join(', ')}`);

  // 선호 언어 자막 찾기
  let selectedCaption = null;
  for (const lang of preferredLangs) {
    selectedCaption = captions.find(c => c.languageCode.startsWith(lang));
    if (selectedCaption) break;
  }

  if (!selectedCaption) {
    selectedCaption = captions[0];
  }

  console.log(`   선택된 자막: ${selectedCaption.languageCode}`);

  // 자막 다운로드
  const captionUrl = selectedCaption.baseUrl + '&fmt=json3';
  const captionResponse = await fetch(captionUrl);
  const captionData = await captionResponse.json();

  // 텍스트 추출
  const transcript = captionData.events
    .filter(e => e.segs)
    .map(e => e.segs.map(s => s.utf8).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { title, transcript, language: selectedCaption.languageCode };
}

// ============ 3. AI 처리 ============
async function processWithAI(transcript, title) {
  console.log(`\n🤖 Claude AI 처리 중...`);

  const client = new Anthropic({ apiKey: API_KEY });

  const systemPrompt = `당신은 YouTube 영상 콘텐츠를 분석하여 포괄적인 학습 노트를 생성하는 전문가입니다.
주어진 자막을 분석하여 다음 6개 섹션을 한국어로 작성해주세요.

반드시 다음 JSON 형식으로 응답해주세요:
{
  "executiveSummary": "핵심 메시지와 3가지 주요 포인트 요약",
  "chapterAnalysis": "주요 챕터/섹션별 상세 분석",
  "keyConcepts": "핵심 개념과 용어 정리 (표 형식)",
  "detailedNotes": "상세 학습 노트",
  "actionItems": "실행 아이템과 적용 방안",
  "feynmanExplanation": "쉬운 말로 풀어쓴 설명 (비유 활용)"
}`;

  const userPrompt = `영상 제목: ${title}

자막 내용:
${transcript.substring(0, 15000)}

위 자막을 분석하여 6개 섹션의 학습 노트를 JSON 형식으로 작성해주세요.`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [
      { role: 'user', content: systemPrompt + '\n\n' + userPrompt }
    ]
  });

  const responseText = response.content[0].text;

  // JSON 파싱
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  return JSON.parse(jsonStr);
}

// ============ 메인 실행 ============
async function main() {
  console.log('🎬 YouTube Summary 플러그인 테스트');
  console.log('='.repeat(50));

  try {
    // 1. 비디오 ID 추출
    const videoId = extractVideoId(VIDEO_URL);
    console.log(`\n✅ 비디오 ID 추출 성공: ${videoId}`);

    // 2. 자막 다운로드
    const { title, transcript, language } = await downloadTranscript(videoId);
    console.log(`✅ 자막 다운로드 성공`);
    console.log(`   제목: ${title}`);
    console.log(`   자막 길이: ${transcript.length}자`);
    console.log(`   자막 미리보기: ${transcript.substring(0, 200)}...`);

    // 3. AI 처리
    const sections = await processWithAI(transcript, title);
    console.log(`✅ AI 처리 성공\n`);

    // 결과 출력
    console.log('='.repeat(50));
    console.log('📝 생성된 학습 노트');
    console.log('='.repeat(50));

    console.log('\n## 📌 Executive Summary\n');
    console.log(sections.executiveSummary);

    console.log('\n## 📚 챕터별 분석\n');
    console.log(sections.chapterAnalysis);

    console.log('\n## 💡 핵심 개념\n');
    console.log(sections.keyConcepts);

    console.log('\n## 📖 상세 학습 노트\n');
    console.log(sections.detailedNotes);

    console.log('\n## ✅ 실행 아이템\n');
    console.log(sections.actionItems);

    console.log('\n## 🎯 쉬운 설명 (Feynman)\n');
    console.log(sections.feynmanExplanation);

  } catch (error) {
    console.error(`\n❌ 에러 발생: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

main();
