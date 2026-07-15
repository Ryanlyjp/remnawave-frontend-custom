import { useGetPolicyModules } from '@shared/api/hooks'
import { LoadingScreen } from '@shared/ui'

import { PolicyModulesPageComponent } from '../components/policy-modules.page.component'

export function PolicyModulesPageConnector() {
    const { data, isLoading } = useGetPolicyModules()

    if (isLoading || !data) {
        return <LoadingScreen />
    }

    return <PolicyModulesPageComponent snippets={data} />
}
