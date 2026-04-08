import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'

import { STONEFALL_CHAIN_ID } from '../../../lib/chain'
import {
  compareChainEntries,
  STONEFALL_ABI,
  STONEFALL_ADDRESS,
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
  const publicClient = usePublicClient({ chainId: STONEFALL_CHAIN_ID })
  const query = useQuery({
    queryKey: ['stonefall', 'leaderboard', STONEFALL_ADDRESS],
    enabled: isOpen && hasContractAddress && !!publicClient,
    queryFn: async () => {
      const result = (await publicClient!.readContract({
        address: STONEFALL_ADDRESS!,
        abi: STONEFALL_ABI,
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
    staleTime: 5000,
    gcTime: 60000,
    refetchOnWindowFocus: true,
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
