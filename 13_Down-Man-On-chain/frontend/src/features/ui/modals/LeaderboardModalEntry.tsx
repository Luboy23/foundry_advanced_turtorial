import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'

import { DOWNMAN_CHAIN_ID } from '../../../lib/chain'
import {
  compareChainEntries,
  DOWNMAN_ABI,
  DOWNMAN_ADDRESS,
  toChainScoreEntry,
} from '../../../lib/contract'
import LeaderboardModal from './LeaderboardModal'

type LeaderboardModalEntryProps = {
  isOpen: boolean
  hasContractAddress: boolean
  shortAddress: (address?: string) => string
  onClose: () => void
}

export default function LeaderboardModalEntry({
  isOpen,
  hasContractAddress,
  shortAddress,
  onClose,
}: LeaderboardModalEntryProps) {
  const publicClient = usePublicClient({ chainId: DOWNMAN_CHAIN_ID })
  const query = useQuery({
    queryKey: ['downman', 'leaderboard', DOWNMAN_ADDRESS],
    enabled: isOpen && hasContractAddress && !!publicClient,
    queryFn: async () => {
      const result = (await publicClient!.readContract({
        address: DOWNMAN_ADDRESS!,
        abi: DOWNMAN_ABI,
        functionName: 'getLeaderboard',
      })) as ReadonlyArray<{
        player: `0x${string}`
        score: number | bigint
        survivalMs: number | bigint
        totalDodged: number | bigint
        finishedAt: number | bigint
      }>

      return result
        .map((entry) => toChainScoreEntry(entry))
        .sort(compareChainEntries)
        .slice(0, 10)
    },
    staleTime: 15000,
    gcTime: 60000,
    refetchOnWindowFocus: false,
  })

  const entries = useMemo(() => query.data ?? [], [query.data])

  return (
    <LeaderboardModal
      isOpen={isOpen}
      hasContractAddress={hasContractAddress}
      entries={entries}
      query={query}
      shortAddress={shortAddress}
      onClose={onClose}
    />
  )
}
