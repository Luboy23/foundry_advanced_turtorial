import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GameHud } from './GameHud'

describe('GameHud', () => {
  it('renders the floating kill and run-gold counters in stacked order', () => {
    render(
      <GameHud
        activeWeapon="sword"
        bowUnlocked={false}
        kills={12}
        runGold={15}
      />,
    )

    const stats = screen.getAllByTestId(/hud-stat-/)
    expect(stats).toHaveLength(2)
    expect(stats[0]).toHaveAttribute('data-testid', 'hud-stat-kills')
    expect(stats[1]).toHaveAttribute('data-testid', 'hud-stat-gold')
    expect(screen.getByTestId('kills-value')).toHaveTextContent('12')
    expect(screen.getByTestId('run-gold-value')).toHaveTextContent('15')
    expect(screen.getByTestId('hud-weapon-status')).toHaveTextContent('玄火镇岳')
    expect(screen.getByTestId('hud-weapon-status')).toHaveTextContent('未解锁')
    expect(screen.queryByText('当前姿态')).not.toBeInTheDocument()
  })
})
