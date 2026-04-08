import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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
  GameCanvas: () => <div data-testid="game-canvas">mock-canvas</div>,
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

describe('App', () => {
  it('renders the desktop-first stage layout with the centered stage title and integrated footer', () => {
    render(<App />)
    const main = screen.getByRole('main')
    const stageShell = screen.getByTestId('stage-shell')
    const stageRightRail = screen.getByTestId('stage-right-rail')
    const stageTitle = within(stageShell).getByTestId('stage-title')
    const footer = within(main).getByTestId('game-footer')
    const footerGithub = within(footer).getByTestId('game-footer-github')
    const footerGithubIcon = within(footerGithub).getByTestId('footer-github-icon')
    const footerMask = within(footer).getByTestId('game-footer-mask')
    const equipmentButton = within(stageRightRail).getByRole('button', { name: '装备' })
    const walletPanel = screen.getByTestId('wallet-panel')
    const startButton = screen.getByTestId('floating-control-start')

    expect(screen.getByText('战斗至死 新手提示')).toBeInTheDocument()
    expect(screen.getByTestId('game-canvas')).toBeInTheDocument()
    expect(stageShell).toHaveClass('h-full')
    expect(screen.queryByText(/^Brave Man$/)).not.toBeInTheDocument()
    expect(stageTitle).toBeInTheDocument()
    expect(within(stageTitle).getByTestId('stage-title-cn')).toHaveTextContent('战斗至死')
    expect(within(stageTitle).getByTestId('stage-title-en')).toHaveTextContent('BraveMan On-chain')
    expect(within(stageTitle).queryByTestId('stage-title-seal')).not.toBeInTheDocument()
    expect(screen.queryByTestId('brand-watermark')).not.toBeInTheDocument()
    expect(within(stageShell).queryByText(/^BRAVEMAN$/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-top-utility')).not.toBeInTheDocument()
    expect(stageRightRail).toBeInTheDocument()
    expect(stageRightRail).toHaveStyle({ top: '90px' })
    expect(walletPanel).toHaveClass('w-[9.9rem]')
    expect(walletPanel).toHaveTextContent('未连接')
    expect(walletPanel).not.toHaveTextContent('本地链 31337')
    expect(equipmentButton).toHaveTextContent('装备')
    expect(equipmentButton).toHaveAttribute('data-expanded', 'false')
    expect(within(equipmentButton).getByTestId('open-equipment-icon')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-connect-icon')).toBeInTheDocument()
    expect(screen.getByTestId('kills-value')).toHaveTextContent('0')
    expect(screen.getByTestId('run-gold-value')).toHaveTextContent('0')
    expect(screen.getByTestId('desktop-floating-controls')).toBeInTheDocument()
    expect(startButton).toBeDisabled()
    expect(startButton).toHaveAttribute('data-expanded', 'false')
    expect(startButton).toHaveAttribute('title', '游戏引擎仍在初始化，请稍候再开始')
    expect(within(startButton).getByTestId('floating-control-start-icon')).toBeInTheDocument()
    expect(footer).toBeInTheDocument()
    expect(footerMask).toBeInTheDocument()
    expect(footer).toHaveTextContent('© 2026 lllu_23')
    expect(footer).toHaveTextContent('BraveMan On-chain')
    expect(footerGithub).toHaveAttribute('href', 'https://github.com/Luboy23/foundry_advanced_turtorial')
    expect(footerGithub).toHaveTextContent('GitHub')
    expect(footerGithubIcon).toBeInTheDocument()
    expect(footerGithub.firstElementChild?.tagName.toLowerCase()).toBe('svg')
  })
})
