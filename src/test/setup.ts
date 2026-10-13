import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest globals 를 쓰지 않아서 Testing Library 자동 정리가 안 걸린다
afterEach(cleanup)
