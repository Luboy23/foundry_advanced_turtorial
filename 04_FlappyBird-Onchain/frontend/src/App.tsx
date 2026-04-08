import { Suspense, lazy, useEffect, useState } from 'react'
import FlappyBird from '../components/FlappyBird'
import { scheduleIdleTask } from './lib/idle-task'

const loadWalletBridge = () => import('../components/Web3/WalletBridge')
const WalletBridge = lazy(loadWalletBridge)

function App() {
  const [walletReady, setWalletReady] = useState(false)

  useEffect(() => {
    const cancelIdleTask = scheduleIdleTask(() => {
      void loadWalletBridge()
      setWalletReady(true)
    }, 220)

    return cancelIdleTask
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {walletReady ? (
        <Suspense fallback={null}>
          <WalletBridge />
        </Suspense>
      ) : null}
      <FlappyBird />
    </div>
  )
}

export default App
