import type { editor } from 'monaco-editor'

import { ConfigEditorActionsFeature } from '@features/dashboard/config-profiles/config-editor-actions'
import { ConfigValidationFeature } from '@features/dashboard/config-profiles/config-validation'
import { MonacoSetupFeature } from '@features/dashboard/config-profiles/monaco-setup'
import {
    Box,
    Button,
    Card,
    Code,
    Group,
    Loader,
    Paper,
    PasswordInput,
    Select,
    Stack,
    Text,
    TextInput
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { useMonaco } from '@monaco-editor/react'
import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TbAlertTriangle } from 'react-icons/tb'
import { useBlocker } from 'react-router'

import { usePseudoFullscreen, useViewportFillHeight } from '@shared/hooks'
import { CodeEditor, editorClasses, EditorFooter, EditorStatusBar } from '@shared/ui/code-editor'
import { FullscreenToggleButton, fullscreenClasses } from '@shared/ui/fullscreen-toggle-button'
import { LoaderModalShared } from '@shared/ui/loader-modal'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { preventBackScroll } from '@shared/utils/misc'

import styles from './ConfigEditor.module.css'
import { IProps } from './interfaces'

const getParsedEditorConfig = (value: string): Record<string, unknown> | null => {
    try {
        return JSON.parse(value) as Record<string, unknown>
    } catch {
        return null
    }
}

const getPolicyModuleSelection = (
    config: Record<string, unknown> | null,
    key: 'outbounds' | 'routingRules'
): string | null => {
    const policyModules = config?.policyModules as Record<string, unknown> | undefined
    const value = policyModules?.[key]

    return Array.isArray(value)
        ? (value.find((item): item is string => typeof item === 'string') ?? null)
        : null
}

const applyPolicyModuleSelection = (
    config: Record<string, unknown>,
    key: 'outbounds' | 'routingRules',
    values: string[]
): Record<string, unknown> => {
    const nextConfig = structuredClone(config)
    const policyModules = (nextConfig.policyModules as Record<string, unknown> | undefined) ?? {}

    if (values.length > 0) {
        policyModules[key] = values
    } else {
        delete policyModules[key]
    }

    if (Object.keys(policyModules).length > 0) {
        nextConfig.policyModules = policyModules
    } else {
        delete nextConfig.policyModules
    }

    return nextConfig
}

const getTuicUser = (config: Record<string, unknown> | null): Record<string, unknown> | null => {
    const inbounds = config?.inbounds
    if (!Array.isArray(inbounds)) return null

    const inbound = inbounds.find(
        (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object' && item.type === 'tuic'
    )
    const users = inbound?.users
    return Array.isArray(users) && users[0] && typeof users[0] === 'object'
        ? (users[0] as Record<string, unknown>)
        : null
}

const applyTuicCredential = (
    config: Record<string, unknown>,
    key: 'password' | 'uuid',
    value: string
): Record<string, unknown> => {
    const nextConfig = structuredClone(config)
    const user = getTuicUser(nextConfig)
    if (user) user[key] = value
    return nextConfig
}

export function ConfigEditorWidget(props: IProps) {
    const { t, i18n } = useTranslation()
    const monaco = useMonaco()

    const { configProfile, isWasmCrashed, isWasmRestarting, onRestartWasm, snippets } = props

    const initialValue = JSON.stringify(configProfile.config, null, 2) || ''
    const [result, setResult] = useState('')
    const [isConfigValid, setIsConfigValid] = useState(true)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [editorValue, setEditorValue] = useState(initialValue)
    const [originalValue, setOriginalValue] = useState<string>(initialValue)

    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
    const wasWasmRestarting = useRef(false)

    const { isFullscreen, toggle: toggleFullscreen } = usePseudoFullscreen()
    const { containerRef: editorWrapperRef, footerRef } = useViewportFillHeight({
        enabled: !isFullscreen
    })

    useEffect(() => {
        if (!monaco) return

        MonacoSetupFeature.setup(
            i18n.language,
            snippets.snippets.filter((snippet) => snippet.engine === configProfile.engine),
            configProfile.engine
        )
    }, [configProfile.engine, i18n.language, snippets, monaco])

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
    )

    const snippetMap = new Map(
        snippets.snippets
            .filter((snippet) => snippet.engine === configProfile.engine)
            .map((snippet) => [snippet.name, snippet.snippet])
    )
    const parsedConfig = getParsedEditorConfig(editorValue)
    const outboundModuleOptions = snippets.snippets
        .filter(
            (snippet) => snippet.engine === configProfile.engine && snippet.kind === 'outbound-set'
        )
        .map((snippet) => ({ value: snippet.name, label: snippet.name }))
    const routingRuleModuleOptions = snippets.snippets
        .filter(
            (snippet) =>
                snippet.engine === configProfile.engine && snippet.kind === 'routing-rule-set'
        )
        .map((snippet) => ({ value: snippet.name, label: snippet.name }))
    const tuicUser = getTuicUser(parsedConfig)

    const validateCurrentConfig = () => {
        if (configProfile.engine === 'SINGBOX') {
            ConfigValidationFeature.validateSingbox(
                editorRef,
                setResult,
                setIsConfigValid,
                snippetMap
            )
        } else {
            ConfigValidationFeature.validate(editorRef, setResult, setIsConfigValid, snippetMap)
        }
    }

    const handlePolicyModulesChange = (key: 'outbounds' | 'routingRules', values: string[]) => {
        if (!editorRef.current) return

        const currentConfig = getParsedEditorConfig(editorRef.current.getValue())
        if (!currentConfig) return

        const nextValue = JSON.stringify(
            applyPolicyModuleSelection(currentConfig, key, values),
            null,
            2
        )
        setEditorValue(nextValue)
        editorRef.current.setValue(nextValue)

        if (configProfile.engine === 'SINGBOX' || (!isWasmCrashed && !isWasmRestarting)) {
            validateCurrentConfig()
        }
        checkForChanges(nextValue)
    }

    const handleTuicCredentialChange = (key: 'password' | 'uuid', value: string) => {
        if (!editorRef.current) return
        const currentConfig = getParsedEditorConfig(editorRef.current.getValue())
        if (!currentConfig) return

        const nextValue = JSON.stringify(applyTuicCredential(currentConfig, key, value), null, 2)
        setEditorValue(nextValue)
        editorRef.current.setValue(nextValue)
        validateCurrentConfig()
        checkForChanges(nextValue)
    }

    useEffect(() => {
        if (wasWasmRestarting.current && !isWasmRestarting && !isWasmCrashed && editorRef.current) {
            validateCurrentConfig()
        }
        wasWasmRestarting.current = isWasmRestarting
    }, [isWasmRestarting, isWasmCrashed])

    const checkForChanges = (value?: string) => {
        const currentValue = value ?? editorRef.current?.getValue()
        if (currentValue === undefined) return
        const hasChanges = currentValue !== originalValue
        setHasUnsavedChanges(hasChanges)
    }

    useLayoutEffect(() => {
        document.body.addEventListener('wheel', preventBackScroll, {
            passive: false
        })
        return () => {
            document.body.removeEventListener('wheel', preventBackScroll)
        }
    }, [])

    useEffect(() => {
        if (blocker.state === 'blocked') {
            modals.openConfirmModal({
                title: (
                    <BaseOverlayHeader
                        iconColor="red"
                        IconComponent={TbAlertTriangle}
                        iconSize={20}
                        iconVariant="soft"
                        title={t('config-editor.widget.unsaved-changes')}
                    />
                ),
                children: t(
                    'config-editor.widget.your-changes-will-be-lost-if-you-leave-this-page-without-saving'
                ),
                centered: true,
                labels: {
                    confirm: t('config-editor.widget.leave'),
                    cancel: t('config-editor.widget.stay')
                },

                confirmProps: {
                    color: 'red',
                    variant: 'soft'
                },
                cancelProps: {
                    variant: 'light'
                },
                onConfirm: () => {
                    blocker.proceed()
                },
                onCancel: () => {
                    blocker.reset()
                },
                closeOnConfirm: true,
                closeOnCancel: true
            })
        }
    }, [blocker])

    const isXrayProfile = configProfile.engine === 'XRAY'
    const statusBar = (result || (isXrayProfile && (isWasmRestarting || isWasmCrashed))) && (
        <EditorStatusBar
            status={
                (isXrayProfile && (isWasmCrashed || isWasmRestarting)) || !isConfigValid
                    ? 'error'
                    : 'success'
            }
        >
            {isXrayProfile && isWasmRestarting && (
                <Group gap="xs">
                    <Loader color="orange" size="xs" />
                    <Code className={styles.statusCode} color="orange">
                        Xray Core (WASM) is restarting...
                    </Code>
                </Group>
            )}
            {isXrayProfile && !isWasmRestarting && isWasmCrashed && (
                <Group gap="sm">
                    <Code className={styles.statusCode} color="red">
                        Xray Core (WASM) crashed. Validation is unavailable.
                    </Code>
                    <Button color="red" onClick={onRestartWasm} size="compact-xs" variant="light">
                        {t('restart-node-button.feature.restart')}
                    </Button>
                </Group>
            )}
            {(!isXrayProfile || (!isWasmRestarting && !isWasmCrashed)) && result}
        </EditorStatusBar>
    )

    return (
        <Box className={clsx(styles.container, isFullscreen && fullscreenClasses.overlay)}>
            {!isFullscreen && (
                <Card mb="md" withBorder>
                    <Stack>
                        <Text fw={600} size="sm">
                            {configProfile.engine === 'SINGBOX'
                                ? 'Sing-box 策略与凭据'
                                : 'Xray 策略模块'}
                        </Text>
                        {configProfile.engine === 'SINGBOX' && tuicUser && (
                            <Group grow>
                                <TextInput
                                    label="TUIC UUID"
                                    onChange={(event) =>
                                        handleTuicCredentialChange(
                                            'uuid',
                                            event.currentTarget.value
                                        )
                                    }
                                    value={typeof tuicUser.uuid === 'string' ? tuicUser.uuid : ''}
                                />
                                <PasswordInput
                                    label="TUIC Password"
                                    onChange={(event) =>
                                        handleTuicCredentialChange(
                                            'password',
                                            event.currentTarget.value
                                        )
                                    }
                                    value={
                                        typeof tuicUser.password === 'string'
                                            ? tuicUser.password
                                            : ''
                                    }
                                />
                            </Group>
                        )}
                        <Select
                            clearable
                            data={outboundModuleOptions}
                            description="附加到此配置文件的可复用出站模块"
                            label="出站模块"
                            onChange={(value) =>
                                handlePolicyModulesChange('outbounds', value ? [value] : [])
                            }
                            placeholder="无"
                            searchable
                            value={getPolicyModuleSelection(parsedConfig, 'outbounds')}
                        />
                        <Select
                            clearable
                            data={routingRuleModuleOptions}
                            description="附加到此配置文件的可复用路由规则模块"
                            label="路由规则模块"
                            onChange={(value) =>
                                handlePolicyModulesChange('routingRules', value ? [value] : [])
                            }
                            placeholder="无"
                            searchable
                            value={getPolicyModuleSelection(parsedConfig, 'routingRules')}
                        />
                    </Stack>
                </Card>
            )}
            <Paper
                className={clsx(
                    styles.editorWrapper,
                    !isFullscreen && editorClasses.editorAttached,
                    isFullscreen && fullscreenClasses.fill
                )}
                p={0}
                pos="relative"
                ref={editorWrapperRef}
                style={{
                    direction: 'ltr'
                }}
                withBorder
            >
                {isFullscreen && (
                    <FullscreenToggleButton
                        isFullscreen={isFullscreen}
                        onToggle={toggleFullscreen}
                    />
                )}

                <CodeEditor
                    footer={statusBar}
                    className={styles.monacoEditor}
                    defaultLanguage="json"
                    loading={<LoaderModalShared mih="100%" />}
                    onChange={(value) => {
                        const currentValue = value ?? ''
                        setEditorValue(currentValue)
                        if (
                            configProfile.engine === 'SINGBOX' ||
                            (!isWasmCrashed && !isWasmRestarting)
                        ) {
                            validateCurrentConfig()
                        }

                        checkForChanges(currentValue)
                    }}
                    onMount={(editor) => {
                        editorRef.current = editor

                        editor.getAction('editor.foldLevel7')?.run()

                        validateCurrentConfig()
                    }}
                    options={{
                        stickyScroll: { enabled: false }
                    }}
                    path={
                        configProfile.engine === 'SINGBOX'
                            ? 'singbox-config://*'
                            : 'xray-config://*'
                    }
                    value={editorValue}
                />
            </Paper>

            {!isFullscreen && (
                <EditorFooter ref={footerRef}>
                    <FullscreenToggleButton
                        floating={false}
                        isFullscreen={isFullscreen}
                        onToggle={toggleFullscreen}
                        size={36}
                    />

                    <ConfigEditorActionsFeature
                        configProfile={configProfile}
                        editorRef={editorRef}
                        hasUnsavedChanges={hasUnsavedChanges}
                        isConfigValid={isConfigValid}
                        originalValue={originalValue}
                        setHasUnsavedChanges={setHasUnsavedChanges}
                        setIsConfigValid={setIsConfigValid}
                        setOriginalValue={setOriginalValue}
                        setResult={setResult}
                    />
                </EditorFooter>
            )}
        </Box>
    )
}
