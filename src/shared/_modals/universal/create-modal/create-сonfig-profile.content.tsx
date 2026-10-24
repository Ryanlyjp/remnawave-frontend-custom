import { Stack, TextInput, Group, Button, SegmentedControl, Text } from '@mantine/core'
import { useField } from '@mantine/form'
import { CreateConfigProfileCommand } from '@remnawave/backend-contract'
import { t } from 'i18next'
import { useState } from 'react'
import { generatePath, NavigateFunction } from 'react-router'

import { queryClient } from '@shared/api'
import { CoreEngine } from '@shared/api/contracts/config-profile-engine.contract'
import { useCreateConfigProfile } from '@shared/api/hooks/config-profiles/config-profiles.mutation.hooks'
import { QueryKeys } from '@shared/api/hooks/keys-factory'
import { ROUTES } from '@shared/constants/routes'

interface IProps {
    onClose: () => void
    navigate: NavigateFunction
}

const generateDefaultConfig = (engine: CoreEngine) => {
    const randomNumber = Math.floor(Math.random() * 999999) + 1

    if (engine === 'SINGBOX') {
        const passwordBytes = crypto.getRandomValues(new Uint8Array(24))

        return {
            log: { level: 'info' },
            inbounds: [
                {
                    type: 'tuic',
                    tag: 'TUIC-IN',
                    listen: '::',
                    listen_port: 443,
                    users: [
                        {
                            uuid: crypto.randomUUID(),
                            password: Array.from(passwordBytes, (byte) =>
                                byte.toString(16).padStart(2, '0')
                            ).join('')
                        }
                    ],
                    congestion_control: 'bbr',
                    tls: {
                        enabled: true,
                        certificate_path: '/etc/sing-box/cert.pem',
                        key_path: '/etc/sing-box/key.pem'
                    }
                }
            ],
            outbounds: [
                { type: 'direct', tag: 'DIRECT' },
                { type: 'block', tag: 'BLOCK' }
            ],
            route: { rules: [], final: 'DIRECT' }
        }
    }

    return {
        log: {
            loglevel: 'info'
        },
        inbounds: [
            {
                tag: `Shadowsocks_${randomNumber}`,
                port: 1234,
                protocol: 'shadowsocks',
                settings: {
                    clients: [],
                    method: 'chacha20-ietf-poly1305',
                    network: 'tcp,udp'
                },
                sniffing: {
                    enabled: true,
                    destOverride: ['http', 'tls', 'quic']
                }
            }
        ],
        outbounds: [
            {
                protocol: 'freedom',
                tag: 'DIRECT'
            },
            {
                protocol: 'blackhole',
                tag: 'BLOCK'
            }
        ],
        routing: {
            rules: []
        }
    }
}

export const CreateConfigProfileContent = (props: IProps) => {
    const { onClose, navigate } = props
    const [engine, setEngine] = useState<CoreEngine>('XRAY')

    const handleUpdate = async () => {
        await queryClient.refetchQueries({
            queryKey: QueryKeys.configProfiles.getConfigProfiles.queryKey
        })
    }

    const nameField = useField<CreateConfigProfileCommand.RequestBody['name']>({
        initialValue: '',
        validateOnChange: true,
        validate: (value) => {
            const result = CreateConfigProfileCommand.RequestBodySchema.omit({
                config: true
            }).safeParse({ name: value })
            return result.success ? null : result.error.issues[0]?.message
        }
    })
    const { mutate: createConfigProfile, isPending } = useCreateConfigProfile({
        mutationFns: {
            onSuccess: (data) => {
                onClose()

                handleUpdate()
                navigate(
                    generatePath(ROUTES.DASHBOARD.MANAGEMENT.CONFIG_PROFILE_BY_UUID, {
                        uuid: data.uuid
                    })
                )
            }
        }
    })

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                createConfigProfile({
                    variables: {
                        name: nameField.getValue(),
                        engine,
                        config: generateDefaultConfig(engine)
                    }
                })
            }}
        >
            <Stack gap="md">
                <Text size="sm">
                    {t(
                        'config-profiles-header-action-buttons.feature.create-a-new-config-profile-by-entering-a-name-below'
                    )}
                    <br />

                    {engine === 'XRAY'
                        ? t(
                              'config-profiles-header-action-buttons.feature.you-can-customize-xray-config-after-creation'
                          )
                        : 'You can customize the Sing-box config and fixed TUIC credentials after creation.'}
                </Text>
                <TextInput
                    data-autofocus
                    label={t('config-profiles-header-action-buttons.feature.profile-name')}
                    placeholder={t(
                        'config-profiles-header-action-buttons.feature.enter-profile-name'
                    )}
                    required
                    {...nameField.getInputProps()}
                />
                <SegmentedControl
                    data={[
                        { label: 'Xray', value: 'XRAY' },
                        { label: 'Sing-box', value: 'SINGBOX' }
                    ]}
                    onChange={(value) => setEngine(value as CoreEngine)}
                    value={engine}
                />
                <Group justify="flex-end">
                    <Button color="gray" onClick={onClose} variant="light">
                        {t('common.action.cancel')}
                    </Button>

                    <Button color="teal" loading={isPending} type="submit">
                        {t('common.action.create')}
                    </Button>
                </Group>
            </Stack>
        </form>
    )
}
