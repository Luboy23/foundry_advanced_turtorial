import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EquipmentModal } from './EquipmentModal'

describe('EquipmentModal', () => {
  it('renders three square inventory slots and allows paused bow purchase', () => {
    render(
      <EquipmentModal
        isOpen
        gameState="paused"
        chainGold={20}
        runGold={4}
        activeWeapon="sword"
        bowOwned={false}
        canToggleWeapon={false}
        purchasePending={false}
        purchaseError={null}
        canPurchaseBow
        purchaseBowBlockedReason={null}
        onClose={vi.fn()}
        onPurchaseBow={vi.fn()}
        onEquipWeapon={vi.fn()}
      />,
    )

    expect(screen.getAllByTestId(/^equipment-slot-[1-3]$/)).toHaveLength(3)
    expect(screen.getByTestId('equipment-slot-2')).toBeDisabled()
    expect(screen.getByTestId('equipment-slot-3')).toBeEnabled()
    expect(screen.getByText('军械柜')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '装备 / 商店' })).toBeInTheDocument()
    expect(screen.getByLabelText('关闭')).toBeInTheDocument()
    expect(screen.getByTestId('shop-product-card')).toBeInTheDocument()
    expect(screen.getByTestId('equipment-slot-art-1')).toHaveAttribute('src', expect.stringContaining('/ui/weapons/greatsword-card.svg'))
    expect(screen.getByTestId('equipment-slot-art-2')).toHaveAttribute('src', expect.stringContaining('/ui/weapons/bow-card.svg'))
    expect(screen.getByTestId('equipment-slot-art-3')).toHaveAttribute('src', expect.stringContaining('/ui/weapons/hook-spear-card.svg'))
    expect(screen.getByTestId('shop-product-art')).toHaveAttribute('src', expect.stringContaining('/ui/weapons/bow-card.svg'))
    expect(screen.queryByText('当前配置')).not.toBeInTheDocument()
    expect(screen.queryByText(/近身横斩/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '购买并装备' })).toBeEnabled()
  })

  it('equips bow from backpack once it is owned', () => {
    const onEquipWeapon = vi.fn()
    render(
      <EquipmentModal
        isOpen
        gameState="paused"
        chainGold={20}
        runGold={4}
        activeWeapon="sword"
        bowOwned
        canToggleWeapon
        purchasePending={false}
        purchaseError={null}
        canPurchaseBow={false}
        purchaseBowBlockedReason="霜翎逐月已永久解锁，无需重复购买"
        onClose={vi.fn()}
        onPurchaseBow={vi.fn()}
        onEquipWeapon={onEquipWeapon}
      />,
    )

    fireEvent.click(screen.getByTestId('equipment-slot-2'))
    expect(onEquipWeapon).toHaveBeenCalledWith('bow')
  })

  it('equips hook spear from backpack as a default-available third weapon', () => {
    const onEquipWeapon = vi.fn()
    render(
      <EquipmentModal
        isOpen
        gameState="idle"
        chainGold={20}
        runGold={0}
        activeWeapon="sword"
        bowOwned={false}
        canToggleWeapon={false}
        purchasePending={false}
        purchaseError={null}
        canPurchaseBow
        purchaseBowBlockedReason={null}
        onClose={vi.fn()}
        onPurchaseBow={vi.fn()}
        onEquipWeapon={onEquipWeapon}
      />,
    )

    fireEvent.click(screen.getByTestId('equipment-slot-3'))
    expect(onEquipWeapon).toHaveBeenCalledWith('hook_spear')
  })

  it('keeps the current weapon slot disabled and highlights owned bow in shop', () => {
    render(
      <EquipmentModal
        isOpen
        gameState="idle"
        chainGold={30}
        runGold={0}
        activeWeapon="bow"
        bowOwned
        canToggleWeapon
        purchasePending={false}
        purchaseError={null}
        canPurchaseBow={false}
        purchaseBowBlockedReason="霜翎逐月已永久解锁，无需重复购买"
        onClose={vi.fn()}
        onPurchaseBow={vi.fn()}
        onEquipWeapon={vi.fn()}
      />,
    )

    expect(screen.getByTestId('equipment-slot-2')).toBeDisabled()
    expect(screen.queryByText(/永久解锁后可用/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '已拥有' })).toBeDisabled()
  })

  it('shows purchase errors inside the shop card', () => {
    render(
      <EquipmentModal
        isOpen
        gameState="paused"
        chainGold={8}
        runGold={6}
        activeWeapon="sword"
        bowOwned={false}
        canToggleWeapon={false}
        purchasePending={false}
        purchaseError="链上金币不足"
        canPurchaseBow={false}
        purchaseBowBlockedReason="链上金币不足，还差 2 金币"
        onClose={vi.fn()}
        onPurchaseBow={vi.fn()}
        onEquipWeapon={vi.fn()}
      />,
    )

    expect(screen.getByText('链上金币不足')).toBeInTheDocument()
  })
})
