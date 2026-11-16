import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req, res) {
    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 환경변수 확인
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API 키가 설정되지 않았습니다.' });
    }

    const { destination, duration, companions, interests } = req.body;

    // 필수 파라미터 검증
    if (!destination || !duration) {
        return res.status(400).json({ error: '필수 정보(여행지, 기간)가 누락되었습니다.' });
    }

    try {
        // Gemini 클라이언트 초기화 (환경변수 GEMINI_API_KEY 자동 참조)
        const ai = new GoogleGenAI({}); 

        // 프롬프트 구성
        const prompt = `
            사용자가 다음 조건으로 여행 일정을 요청했습니다.
            - 여행지: ${destination}
            - 기간: ${duration}일
            - 동행자: ${companions || '입력 안함'}
            - 관심사: ${interests || '입력 안함'}

            [지시사항]
            1. 위 조건에 맞는 현실적이고 동선이 고려된 여행 일정을 짜주세요.
            2. 식당 영업시간, 관광지 운영시간, 입장료, 교통 요금 등은 수시로 변하므로 절대 확정적인 수치나 시간으로 기재하지 마세요. (예: "오전 9시 오픈", "입장료 10달러" 등 금지)
            3. 만약 사용자의 입력(여행지, 관심사 등)에 여행과 전혀 무관한 내용(예: 프로그래밍 질문, 번역, 정치적 질문 등)이 포함되어 있다면 일정을 짜지 마세요. 이 경우 프론트엔드가 에러 카드 1개를 띄울 수 있도록 "여행과 관련된 일정만 안내해 드릴 수 있습니다."라는 내용으로 하루 치 가짜 일정을 응답하세요.
            4. 각 일정의 'time' 필드는 "09:00 AM", "01:30 PM" 등의 직관적인 포맷으로 작성하세요.
        `;

        // Gemini API 호출 (구조화된 JSON 출력 강제)
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        plan: {
                            type: Type.ARRAY,
                            description: "일자별 여행 일정 배열",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    day: { 
                                        type: Type.INTEGER, 
                                        description: "n일차 (숫자)" 
                                    },
                                    title: { 
                                        type: Type.STRING, 
                                        description: "해당 일차의 핵심 테마 또는 제목" 
                                    },
                                    activities: {
                                        type: Type.ARRAY,
                                        description: "해당 일차의 세부 활동 목록",
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                time: { 
                                                    type: Type.STRING, 
                                                    description: "진행 시간 (예: 10:00 AM)" 
                                                },
                                                description: { 
                                                    type: Type.STRING, 
                                                    description: "활동 상세 설명 (요금/영업시간 단정 금지)" 
                                                }
                                            },
                                            required: ['time', 'description']
                                        }
                                    }
                                },
                                required: ['day', 'title', 'activities']
                            }
                        }
                    },
                    required: ['plan']
                }
            }
        });

        // 결과 JSON 파싱 및 응답
        const resultJson = JSON.parse(response.text);
        return res.status(200).json(resultJson);

    } catch (error) {
        console.error('Gemini API 호출 에러:', error);
        return res.status(500).json({ error: '일정을 생성하는 도중 오류가 발생했습니다.' });
    }
}
