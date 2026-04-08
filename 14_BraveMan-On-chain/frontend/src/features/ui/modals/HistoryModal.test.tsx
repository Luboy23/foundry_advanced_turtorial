import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import HistoryModal from './HistoryModal'

describe('HistoryModal', () => {
  it('renders the shared modal header and empty state', () => {
    render(
      <HistoryModal
        connected
        entries={[]}
        hasContractAddress
        isError={false}
        isLoading={false}
        isLoadingMore={false}
        isOpen
        hasMore={false}
        total={0}
        onClose={vi.fn()}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: '历史战绩' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    expect(screen.getByText('暂无历史战绩')).toBeInTheDocument()
  })
})
