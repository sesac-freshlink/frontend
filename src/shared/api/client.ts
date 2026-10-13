import axios from 'axios'
import { authClient, useAuthStore } from '@/shared/auth'

/** 운영에서는 CloudFront 가 /api/* 를 gateway 로, 개발에서는 Vite proxy 나 MSW 가 받는다 */
export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(async (config) => {
  const token = await authClient.getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(undefined, async (error) => {
  // 토큰이 만료되거나 무효면 로그아웃시키고, 역할 가드가 로그인 화면으로 보낸다
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    await useAuthStore.getState().signOut()
  }
  return Promise.reject(error)
})
