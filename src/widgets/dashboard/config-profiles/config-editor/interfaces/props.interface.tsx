import { ConfigProfileWithEngine } from '@shared/api/contracts/config-profile-engine.contract'
import { SnippetsResponse } from '@shared/api/hooks/snippets/snippets.query.hooks'

export interface IProps {
    configProfile: ConfigProfileWithEngine
    isWasmCrashed: boolean
    isWasmRestarting: boolean
    onRestartWasm: () => void
    snippets: SnippetsResponse
}
