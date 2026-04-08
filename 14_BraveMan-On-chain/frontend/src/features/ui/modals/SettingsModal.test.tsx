import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SettingsModal from './SettingsModal'

describe('SettingsModal', () => {
  it('renders the shared modal header and close action', () => {
    render(
      <SettingsModal
        isOpen
        onClose={vi.fn()}
        onSelectTouchMode={vi.fn()}
        onToggleMusic={vi.fn()}
        onToggleSfx={vi.fn()}
        settings={{
          musicEnabled: true,
          sfxEnabled: false,
          touchControlMode: 'joystick',
          dismissPortraitHint: false,
          dismissFirstRunHint: false,
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
    expect(screen.getByLabelText('关闭')).toBeInTheDocument()
  })
})
