/** 개발 서버이고 VITE_API_MOCK 이 'false' 가 아니면 MSW 가짜 API·가짜 로그인을 쓴다. 빌드에서는 항상 false */
export const isMockApi: boolean = import.meta.env.DEV && import.meta.env.VITE_API_MOCK !== 'false'
