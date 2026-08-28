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

const createDrafts = (hosts: AliasHost[]) =>
    Object.fromEntries(hosts.map((host) => [host.hostUuid, host.effectiveRemark]))

export const UserHostAliasesWidget = ({ userId }: IProps) => {
    const { t } = useTranslation()
    const { data, isLoading } = useGetUserHostAliases({
        route: { userId }
    })
    const hosts = data?.hosts ?? []
    const [drafts, setDrafts] = useState<Record<string, string>>({})

    useEffect(() => {
        setDrafts(createDrafts(hosts))
    }, [data])

    const hasChanges = useMemo(
        () => hosts.some((host) => (drafts[host.hostUuid] ?? '') !== host.effectiveRemark),
        [drafts, hosts]
    )

    const { mutate: updateAliases, isPending } = useUpdateUserHostAliases({
        mutationFns: {
            onSuccess: (updated) => {
                queryClient.setQueryData(
                    usersQueryKeys.getUserHostAliases({ userId }).queryKey,
                    updated
                )
                setDrafts(createDrafts(updated.hosts))
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
                {!isLoading && hosts.length === 0 && (
                    <Text c="dimmed" size="sm">
                        {t('user-host-aliases.empty')}
                    </Text>
                )}
                {!isLoading && hosts.length > 0 && (
                    <div className={classes.aliasesWrap}>
                        {hosts.map((host) => {
                            const value = drafts[host.hostUuid] ?? host.effectiveRemark
                            const isChanged = value !== host.effectiveRemark
                            const widthCharacters = Math.min(
                                32,
                                Math.max(12, value.length, host.defaultRemark.length)
                            )

                            return (
                                <Paper
                                    className={clsx(classes.aliasBubble, {
                                        [classes.aliasBubbleChanged]: isChanged
                                    })}
                                    key={host.hostUuid}
                                    style={{ '--alias-chars': widthCharacters } as CSSProperties}
                                    withBorder
                                >
                                    <TextInput
                                        aria-label={host.defaultRemark}
                                        className={classes.aliasInput}
                                        maxLength={50}
                                        onChange={(event) => {
                                            const nextValue = event.currentTarget.value
                                            setDrafts((current) => ({
                                                ...current,
                                                [host.hostUuid]: nextValue
                                            }))
                                        }}
                                        placeholder={host.defaultRemark}
                                        title={host.defaultRemark}
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
                        onClick={() => setDrafts(createDrafts(hosts))}
                        variant="subtle"
                    >
                        {t('user-host-aliases.discard')}
                    </Button>
                    <Button
                        color="orange"
                        disabled={hosts.length === 0 || isPending}
                        leftSection={<TbRestore size={16} />}
                        onClick={() =>
                            setDrafts(
                                Object.fromEntries(
                                    hosts.map((host) => [host.hostUuid, host.defaultRemark])
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
                                    aliases: hosts.flatMap((host) => {
                                        const remark = (drafts[host.hostUuid] ?? '').trim()
                                        return remark && remark !== host.defaultRemark
                                            ? [{ hostUuid: host.hostUuid, remark }]
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
