import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductThumb } from './ProductThumb'

describe('상품 썸네일', () => {
  it('주소가 있으면 상품명을 대체 글자로 한 이미지를 보여 준다', () => {
    render(<ProductThumb src="https://img.example/P015.jpg" name="매운 컵라면 115g" />)
    expect(screen.getByRole('img', { name: '매운 컵라면 115g' })).toHaveAttribute(
      'src',
      'https://img.example/P015.jpg',
    )
  })

  it('주소가 없으면 자리표시를 보여 준다', () => {
    render(<ProductThumb src={null} name="샌드위치 햄치즈" />)
    expect(screen.getByRole('img', { name: '샌드위치 햄치즈 이미지 없음' })).toBeInTheDocument()
  })

  it('이미지를 못 불러오면 자리표시로 바꾼다', () => {
    render(<ProductThumb src="https://img.example/gone.jpg" name="흰 우유 500ml" />)
    fireEvent.error(screen.getByRole('img', { name: '흰 우유 500ml' }))
    expect(screen.getByRole('img', { name: '흰 우유 500ml 이미지 없음' })).toBeInTheDocument()
  })
})
