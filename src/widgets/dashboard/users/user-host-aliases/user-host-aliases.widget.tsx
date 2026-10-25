import { Button, Group, Loader, Paper, Stack, Text, TextInput, ThemeIcon } from '@mantine/core'
import clsx from 'clsx'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PiFloppyDiskDuotone, PiTagDuotone } from 'react-icons/pi'
import { TbArrowBackUp, TbRestore } from 'react-icons/tb'

import { queryClient } from '@shared/api'
import { useGetUserHostAliases, usersQueryKeys, useUpdateUserHostAliases } from '@shared/api/hooks'

import classes from './user-host-aliases.module.css'

interface IProps {
    userId: number
}

type AliasHost = NonNullable<ReturnType<typeof useGetUserHostAliases>['data']>['hosts'][number]
type AliasSingboxProfile = NonNullable<
    ReturnType<typeof useGetUserHostAliases>['data']
>['singboxProfiles'][number]

type AliasNode = {
    customRemark: null | string
    defaultRemark: string
    effectiveRemark: string
    key: string
    targetType: 'host' | 'singboxProfile'
    targetUuid: string
}

const createNodes = (hosts: AliasHost[], singboxProfiles: AliasSingboxProfile[]) => {
    const nodes: AliasNode[] = []
    const inserted = new Set<string>()
    const toSingboxNode = (profile: AliasSingboxProfile): AliasNode => ({
        key: `singbox:${profile.configProfileUuid}`,
        targetType: 'singboxProfile',
        targetUuid: profile.configProfileUuid,
        defaultRemark: profile.defaultRemark,
        customRemark: profile.customRemark,
        effectiveRemark: profile.effectiveRemark
    })
    const insertMatching = (
        field: 'insertAfterHostUuid' | 'insertBeforeHostUuid',
        hostUuid: string
    ) => {
        for (const profile of singboxProfiles) {
            if (profile[field] !== hostUuid || inserted.has(profile.configProfileUuid)) continue
            nodes.push(toSingboxNode(profile))
            inserted.add(profile.configProfileUuid)
        }
    }

    for (const host of hosts) {
        insertMatching('insertBeforeHostUuid', host.hostUuid)
        nodes.push({
            key: `host:${host.hostUuid}`,
            targetType: 'host',
            targetUuid: host.hostUuid,
            defaultRemark: host.defaultRemark,
            customRemark: host.customRemark,
            effectiveRemark: host.effectiveRemark
        })
        insertMatching('insertAfterHostUuid', host.hostUuid)
    }

    for (const profile of singboxProfiles) {
        if (!inserted.has(profile.configProfileUuid)) nodes.push(toSingboxNode(profile))
    }

    return nodes
}

const createDrafts = (nodes: AliasNode[]) =>
    Object.fromEntries(nodes.map((node) => [node.key, node.effectiveRemark]))

export const UserHostAliasesWidget = ({ userId }: IProps) => {
    const { t } = useTranslation()
    const { data, isLoading } = useGetUserHostAliases({
        route: { userId }
    })
    const hosts = data?.hosts
    const singboxProfiles = data?.singboxProfiles
    const nodes = useMemo(
        () => createNodes(hosts ?? [], singboxProfiles ?? []),
        [hosts, singboxProfiles]
    )
    const [drafts, setDrafts] = useState<Record<string, string>>({})

    useEffect(() => {
        setDrafts(createDrafts(nodes))
    }, [nodes])

    const hasChanges = useMemo(
        () => nodes.some((node) => (drafts[node.key] ?? '') !== node.effectiveRemark),
        [drafts, nodes]
    )

    const { mutate: updateAliases, isPending } = useUpdateUserHostAliases({
        mutationFns: {
            onSuccess: (updated) => {
                queryClient.setQueryData(
                    usersQueryKeys.getUserHostAliases({ userId }).queryKey,
                    updated
                )
                setDrafts(createDrafts(createNodes(updated.hosts, updated.singboxProfiles)))
            }
        }
    })

    return (
        <Paper mt="md" p="lg" radius="md" withBorder>
            <Stack gap="md">
                <Group gap="sm">
                    <ThemeIcon color="teal" radius="md" size="lg" variant="light">
                        <PiTagDuotone size={20} />
                    </ThemeIcon>
                    <div>
                        <Text fw={600}>{t('user-host-aliases.title')}</Text>
                        <Text c="dimmed" size="sm">
                            {t('user-host-aliases.description')}
                        </Text>
                    </div>
                </Group>

                {isLoading && <Loader size="sm" />}
                {!isLoading && nodes.length === 0 && (
                    <Text c="dimmed" size="sm">
                        {t('user-host-aliases.empty')}
                    </Text>
                )}
                {!isLoading && nodes.length > 0 && (
                    <div className={classes.aliasesWrap}>
                        {nodes.map((node) => {
                            const value = drafts[node.key] ?? node.effectiveRemark
                            const isChanged = value !== node.effectiveRemark
                            const widthCharacters = Math.min(
                                32,
                                Math.max(12, value.length, node.defaultRemark.length)
                            )

                            return (
                                <Paper
                                    className={clsx(classes.aliasBubble, {
                                        [classes.aliasBubbleChanged]: isChanged
                                    })}
                                    key={node.key}
                                    style={{ '--alias-chars': widthCharacters } as CSSProperties}
                                    withBorder
                                >
                                    <TextInput
                                        aria-label={node.defaultRemark}
                                        className={classes.aliasInput}
                                        maxLength={50}
                                        onChange={(event) => {
                                            const nextValue = event.currentTarget.value
                                            setDrafts((current) => ({
                                                ...current,
                                                [node.key]: nextValue
                                            }))
                                        }}
                                        placeholder={node.defaultRemark}
                                        title={node.defaultRemark}
                                        value={value}
                                        variant="unstyled"
                                    />
                                </Paper>
                            )
                        })}
                    </div>
                )}

                <Group gap="sm" justify="flex-end" wrap="wrap">
                    <Button
                        color="gray"
                        disabled={!hasChanges || isPending}
                        leftSection={<TbArrowBackUp size={16} />}
                        onClick={() => setDrafts(createDrafts(nodes))}
                        variant="subtle"
                    >
                        {t('user-host-aliases.discard')}
                    </Button>
                    <Button
                        color="orange"
                        disabled={nodes.length === 0 || isPending}
                        leftSection={<TbRestore size={16} />}
                        onClick={() =>
                            setDrafts(
                                Object.fromEntries(
                                    nodes.map((node) => [node.key, node.defaultRemark])
                                )
                            )
                        }
                        variant="light"
                    >
                        {t('user-host-aliases.reset')}
                    </Button>
                    <Button
                        color="teal"
                        disabled={!hasChanges}
                        leftSection={<PiFloppyDiskDuotone size={16} />}
                        loading={isPending}
                        onClick={() => {
                            updateAliases({
                                route: { userId },
                                variables: {
                                    aliases: nodes.flatMap((node) => {
                                        if (node.targetType !== 'host') return []
                                        const remark = (drafts[node.key] ?? '').trim()
                                        return remark && remark !== node.defaultRemark
                                            ? [{ hostUuid: node.targetUuid, remark }]
                                            : []
                                    }),
                                    singboxAliases: nodes.flatMap((node) => {
                                        if (node.targetType !== 'singboxProfile') return []
                                        const remark = (drafts[node.key] ?? '').trim()
                                        return remark && remark !== node.defaultRemark
                                            ? [{ configProfileUuid: node.targetUuid, remark }]
                                            : []
                                    })
                                }
                            })
                        }}
                        variant="light"
                    >
                        {t('user-host-aliases.save')}
                    </Button>
                </Group>
            </Stack>
        </Paper>
    )
}
