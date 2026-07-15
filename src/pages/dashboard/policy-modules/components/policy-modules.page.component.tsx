import { Button, Group, Tabs } from '@mantine/core'
import { modals } from '@mantine/modals'
import {
    CREATE_SNIPPET_MODAL_ID,
    CreateSnippetModal
} from '@widgets/dashboard/config-profiles/snippets/create-snippet.modal'
import { SnippetsGridWidget } from '@widgets/dashboard/config-profiles/snippets/snippets-grid.widget'
import { useMemo, useState } from 'react'
import { TbCode, TbPlus } from 'react-icons/tb'

import { PolicyModuleKind, PolicyModulesResponse } from '@shared/api/hooks'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { Page } from '@shared/ui/page'
import { PageHeaderShared } from '@shared/ui/page-header/page-header.shared'

interface Props {
    snippets: PolicyModulesResponse
}

export const PolicyModulesPageComponent = ({ snippets }: Props) => {
    const [activeTab, setActiveTab] = useState<'outbound-set' | 'routing-rule-set'>('outbound-set')

    const filteredSnippets = useMemo(() => {
        const filtered = snippets.snippets.filter((snippet) => snippet.kind === activeTab)
        return {
            snippets: filtered,
            total: filtered.length
        }
    }, [activeTab, snippets.snippets])

    const openCreateModal = (kind: PolicyModuleKind) => {
        modals.open({
            title: (
                <BaseOverlayHeader
                    iconColor="teal"
                    IconComponent={TbCode}
                    iconVariant="soft"
                    title="创建策略模块"
                />
            ),
            centered: true,
            modalId: CREATE_SNIPPET_MODAL_ID,
            size: 'lg',
            children: <CreateSnippetModal forcedKind={kind} />
        })
    }

    return (
        <Page title="策略模块">
            <PageHeaderShared
                title="策略模块"
                description="可复用的出站与路由规则模块"
                icon={<TbCode size={24} />}
                actions={
                    <Group>
                        <Button
                            leftSection={<TbPlus size={16} />}
                            onClick={() => openCreateModal(activeTab)}
                        >
                            新增模块
                        </Button>
                    </Group>
                }
            />

            <Tabs
                value={activeTab}
                onChange={(value) => setActiveTab((value as typeof activeTab) || 'outbound-set')}
            >
                <Tabs.List>
                    <Tabs.Tab value="outbound-set">出站模块</Tabs.Tab>
                    <Tabs.Tab value="routing-rule-set">路由规则模块</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel pt="md" value="outbound-set">
                    <SnippetsGridWidget snippets={filteredSnippets} />
                </Tabs.Panel>

                <Tabs.Panel pt="md" value="routing-rule-set">
                    <SnippetsGridWidget snippets={filteredSnippets} />
                </Tabs.Panel>
            </Tabs>
        </Page>
    )
}
