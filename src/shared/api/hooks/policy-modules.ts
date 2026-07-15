import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { instance } from '@shared/api/axios'

export type PolicyModuleKind = 'outbound-set' | 'routing-rule-set' | 'balancer-set'
export type PolicyModuleScope = 'shared' | 'internal'

export interface PolicyModuleRecord {
    name: string
    kind?: PolicyModuleKind | null
    scope?: PolicyModuleScope | null
    description?: string | null
    snippet: Record<string, unknown>[]
    createdAt?: string
}

export interface PolicyModulesResponse {
    snippets: PolicyModuleRecord[]
}

const QUERY_KEY = ['policy-modules'] as const

export const useGetPolicyModules = () => {
    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: async (): Promise<PolicyModulesResponse> => {
            const response = await instance.get('/api/snippets/')
            return response.data.response as PolicyModulesResponse
        }
    })
}

interface UpsertPayload {
    name: string
    kind?: PolicyModuleKind | null
    scope?: PolicyModuleScope | null
    description?: string | null
    snippet: Record<string, unknown>[]
}

export const useCreatePolicyModule = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: UpsertPayload) => {
            const response = await instance.post('/api/snippets/', payload)
            return response.data.response as PolicyModuleRecord
        },
        onSuccess: async () => {
            notifications.show({ title: '成功', message: '策略模块已创建', color: 'teal' })
            await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
        },
        onError: (error) => {
            notifications.show({
                title: '创建策略模块',
                message: error instanceof Error ? error.message : '请求失败',
                color: 'red'
            })
        }
    })
}

export const useUpdatePolicyModule = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: UpsertPayload) => {
            const response = await instance.patch('/api/snippets/', payload)
            return response.data.response as PolicyModuleRecord
        },
        onSuccess: async () => {
            notifications.show({ title: '成功', message: '策略模块已更新', color: 'teal' })
            await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
        },
        onError: (error) => {
            notifications.show({
                title: '更新策略模块',
                message: error instanceof Error ? error.message : '请求失败',
                color: 'red'
            })
        }
    })
}

export const useDeletePolicyModule = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (name: string) => {
            const response = await instance.delete('/api/snippets/', { data: { name } })
            return response.data.response
        },
        onSuccess: async () => {
            notifications.show({ title: '成功', message: '策略模块已删除', color: 'teal' })
            await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
        },
        onError: (error) => {
            notifications.show({
                title: '删除策略模块',
                message: error instanceof Error ? error.message : '请求失败',
                color: 'red'
            })
        }
    })
}
