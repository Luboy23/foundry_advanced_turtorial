import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SettingsIcon } from './GameUiIcons'
import { RailActionButton } from './RailActionButton'

describe('RailActionButton', () => {
  it('keeps icon-rail buttons collapsed by default and expands on hover', async () => {
    const user = userEvent.setup()

    render(
      <RailActionButton
        icon={<SettingsIcon className="h-4 w-4" />}
        label="设置"
        layout="icon-rail"
      />,
    )

    const button = screen.getByRole('button', { name: '设置' })

    expect(button).toHaveAttribute('data-expanded', 'false')

    await user.hover(button)
    expect(button).toHaveAttribute('data-expanded', 'true')

    await user.unhover(button)
    expect(button).toHaveAttribute('data-expanded', 'false')
  })

  it('expands icon-rail buttons on focus for keyboard users', async () => {
    const user = userEvent.setup()

    render(
      <RailActionButton
        icon={<SettingsIcon className="h-4 w-4" />}
        label="设置"
        layout="icon-rail"
      />,
    )

    const button = screen.getByRole('button', { name: '设置' })

    await user.tab()
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('data-expanded', 'true')
  })
})
