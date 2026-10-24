import { createQueryKeys } from '@lukemorales/query-key-factory'
import { useQuery } from '@tanstack/react-query'

import { instance } from '@shared/api/axios'
import { CoreEngine } from '@shared/api/contracts/config-profile-engine.contract'
import { sToMs } from '@shared/utils/time-utils'

export interface SnippetRecord {
    name: string
    engine: CoreEngine
    snippet: unknown
    kind?: string | null
    scope?: string | null
    description?: string | null
    createdAt?: string
}

export interface SnippetsResponse {
    total: number
    snippets: SnippetRecord[]
}

export const snippetsQueryKeys = createQueryKeys('snippets', {
    getSnippets: {
        queryKey: null
    }
})

interface UseGetSnippetsParams {
    rQueryParams?: {
        enabled?: boolean
        refetchOnWindowFocus?: boolean
    }
}

export const useGetSnippets = (params?: UseGetSnippetsParams) => {
    return useQuery({
        queryKey: snippetsQueryKeys.getSnippets.queryKey,
        queryFn: async (): Promise<SnippetsResponse> => {
            const response = await instance.get('/api/snippets')
            return response.data.response as SnippetsResponse
        },
        refetchOnMount: true,
        staleTime: sToMs(30),
        ...params?.rQueryParams
    })
}
