import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { isMockApi } from '@/shared/api/mockMode'
import './index.css'

async function enableMocking() {
  // 개발 서버에서만 MSW 가짜 API 를 켠다. 빌드에는 들어가지 않는다
  // (DEV 를 여기서 직접 봐야 빌드가 아래 MSW import 를 지운다. 판정 자체는 isMockApi 한 곳)
  if (!import.meta.env.DEV || !isMockApi) return
  const { network } = await import('virtual:msw')
  const { handlers } = await import('./mocks/handlers')
  network.configure({ handlers })
  await network.enable()
}

// 가짜 API 를 못 켜도(서비스 워커를 막는 브라우저 등) 화면은 띄운다
void enableMocking()
  .catch((e: unknown) => console.warn('[MSW] 가짜 API를 켜지 못했습니다', e))
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
