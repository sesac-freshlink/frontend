import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageNav } from './PageNav'

const SIZES = [10, 20, 50] as const

function renderNav(props: { page: number; totalPages: number; loading?: boolean }) {
  const onPageChange = vi.fn()
  const onSizeChange = vi.fn()
  render(
    <PageNav
      page={props.page}
      totalPages={props.totalPages}
      size={20}
      sizes={SIZES}
      loading={props.loading ?? false}
      onPageChange={onPageChange}
      onSizeChange={onSizeChange}
    />,
  )
  return { onPageChange, onSizeChange }
}

describe('PageNav', () => {
  it('첫 페이지에서는 [이전]을 막고 [다음]은 다음 페이지 번호를 넘긴다', async () => {
    const { onPageChange } = renderNav({ page: 0, totalPages: 3 })
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('마지막 페이지에서는 [다음]을 막고 [이전]은 앞 페이지 번호를 넘긴다', async () => {
    const { onPageChange } = renderNav({ page: 2, totalPages: 3 })
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '이전' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('다음 페이지를 받는 중이면 [다음]을 막는다', () => {
    renderNav({ page: 0, totalPages: 3, loading: true })
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
  })

  it('빈 목록(totalPages 0)도 1 / 1 로 보여 준다', () => {
    renderNav({ page: 0, totalPages: 0 })
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
  })

  it('한 페이지 개수를 고르면 숫자로 넘긴다', async () => {
    const { onSizeChange } = renderNav({ page: 0, totalPages: 1 })
    const select = screen.getByRole('combobox', { name: '한 페이지에' })
    expect(select).toHaveValue('20')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '10개씩',
      '20개씩',
      '50개씩',
    ])
    await userEvent.selectOptions(select, '50')
    expect(onSizeChange).toHaveBeenCalledWith(50)
  })
})
