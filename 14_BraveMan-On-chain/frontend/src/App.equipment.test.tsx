import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listeners = new Map<string, (payload: unknown) => void>()
const controller = {
  destroy: vi.fn(),
  on: vi.fn((event: string, handler: (payload: unknown) => void) => {
    listeners.set(event, handler)
    return () => listeners.delete(event)
  }),
  startGame: vi.fn(),
  pauseGame: vi.fn(),
  resumeGame: vi.fn(),
  returnToIdle: vi.fn(),
  setMovement: vi.fn(),
  setEquipmentModalOpen: vi.fn(),
  setBowAvailability: vi.fn(),
  toggleWeapon: vi.fn(),
  equipWeapon: vi.fn(),
  unlockBowAndEquip: vi.fn(),
  retreat: vi.fn(),
  forceGameOver: vi.fn(),
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null, isFetching: false, refetch: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 31337,
  useConnect: () => ({ connect: vi.fn(), connectors: [{ id: 'injected', name: 'Injected' }], isPending: false }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn(), isPending: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  usePublicClient: () => null,
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}))

vi.mock('./features/game/GameCanvas', () => ({
  GameCanvas: ({ onControllerReady }: { onControllerReady: (controller: unknown) => void }) => {
    useEffect(() => {
      onControllerReady(controller)
      return () => onControllerReady(null)
    }, [onControllerReady])
    return <div data-testid="game-canvas">mock-canvas</div>
  },
}))

vi.mock('./features/audio/useGameAudio', () => ({
  useGameAudio: () => ({
    activateAudio: vi.fn(),
    playSfx: vi.fn(),
    setBgmRunning: vi.fn(),
  }),
}))

vi.mock('./shared/utils/useViewport', () => ({
  useViewport: () => ({ width: 1280, height: 720 }),
}))

import App from './App'

describe('App equipment modal flow', () => {
  beforeEach(() => {
    listeners.clear()
    controller.destroy.mockClear()
    controller.on.mockClear()
    controller.startGame.mockClear()
    controller.pauseGame.mockClear()
    controller.resumeGame.mockClear()
    controller.returnToIdle.mockClear()
    controller.setMovement.mockClear()
    controller.setEquipmentModalOpen.mockClear()
    controller.setBowAvailability.mockClear()
    controller.toggleWeapon.mockClear()
    controller.equipWeapon.mockClear()
    controller.unlockBowAndEquip.mockClear()
    controller.retreat.mockClear()
    controller.forceGameOver.mockClear()
  })

  it('pauses the running round before opening the equipment modal', async () => {
    render(<App />)

    act(() => {
      listeners.get('onGameState')?.({ state: 'running' })
    })

    expect(screen.getByTestId('floating-control-pause-resume')).toHaveAttribute('data-expanded', 'false')
    expect(screen.getByTestId('floating-control-pause-resume')).toHaveAttribute('title', '暂停')
    expect(screen.getByTestId('floating-control-settings')).toHaveAttribute('data-expanded', 'false')
    expect(screen.queryByTestId('floating-control-history')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('floating-control-pause-resume')).getByTestId('floating-control-pause-resume-icon')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '装备' }))

    expect(controller.pauseGame).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('装备 / 商店')).toBeInTheDocument()
    await waitFor(() => expect(controller.setEquipmentModalOpen).toHaveBeenLastCalledWith(true))
  })
})
