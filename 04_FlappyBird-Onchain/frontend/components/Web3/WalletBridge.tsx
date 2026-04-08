import Provider from '../../src/providers'
import WalletConnect from './WalletConnect'

export default function WalletBridge() {
  return (
    <Provider>
      <WalletConnect />
    </Provider>
  )
}
