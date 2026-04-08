import { useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'

import { STONEFALL_CHAIN_ID } from '../../../lib/chain'
import {
  STONEFALL_ABI,
  STONEFALL_ADDRESS,
  toChainScoreEntry,
} from '../../../lib/contract'
import HistoryModal from './HistoryModal'

const HISTORY_PAGE_SIZE = 10

type HistoryModalEntryProps = {
  isOpen: boolean
  connected: boolean
  address: `0x${string}` | undefined
  hasContractAddress: boolean
  onClose: () => void
}

export default function HistoryModalEntry({
  isOpen,
  connected,
  address,
  hasContractAddress,
  onClose,
}: HistoryModalEntryProps) {
  const publicClient = usePublicClient({ chainId: STONEFALL_CHAIN_ID })
  const queryEnabled = isOpen && connected && !!address && hasContractAddress && !!publicClient

  const historyCountQuery = useQuery({
    queryKey: ['stonefall', 'history-count', STONEFALL_ADDRESS, address],
    enabled: queryEnabled,
    queryFn: async () => {
      const value = (await publicClient!.readContract({
        address: STONEFALL_ADDRESS!,
        abi: STONEFALL_ABI,
        functionName: 'getUserHistoryCount',
        args: [address!],
      })) as bigint

      return Number(value)
    },
    staleTime: 5000,
    gcTime: 60000,
  })

  const historyQuery = useInfiniteQuery({
    queryKey: ['stonefall', 'history', STONEFALL_ADDRESS, address],
    enabled: queryEnabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = Number(pageParam ?? 0)
      const result = (await publicClient!.readContract({
        address: STONEFALL_ADDRESS!,
        abi: STONEFALL_ABI,
        functionName: 'getUserHistory',
        args: [address!, BigInt(offset), BigInt(HISTORY_PAGE_SIZE)],
      })) as ReadonlyArray<{
        player: `0x${string}`
        score: number | bigint
        survivalMs: number | bigint
        totalDodged: number | bigint
        finishedAt: number | bigint
      }>

      return {
        items: result.map((entry) => toChainScoreEntry(entry)),
      }
    },
    getNextPageParam: (_lastPage, pages) => {
      const total = historyCountQuery.data ?? 0
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded < total ? loaded : undefined
    },
    staleTime: 5000,
    gcTime: 60000,
  })

  const entries = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data],
  )

  return (
    <HistoryModal
      isOpen={isOpen}
      connected={connected}
      address={address}
      hasContractAddress={hasContractAddress}
      entries={entries}
      historyQuery={historyQuery}
      historyCountQuery={historyCountQuery}
      onClose={onClose}
    />
  )
}
