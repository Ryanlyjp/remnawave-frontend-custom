import { GetConfigProfileByUuidCommand } from '@remnawave/backend-contract'

import { SnippetsResponse } from '@shared/api/hooks/snippets/snippets.query.hooks'

export interface IProps {
    configProfile: GetConfigProfileByUuidCommand.Response['response']
    isWasmCrashed: boolean
    isWasmRestarting: boolean
    onRestartWasm: () => void
    snippets: SnippetsResponse
}
