import type { editor } from 'monaco-editor'

import { MonacoSetupSnippetsFeature } from '@features/dashboard/config-profiles/monaco-setup'
import { Button, Code, Group, Paper, Select, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { Editor, Monaco, useMonaco } from '@monaco-editor/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { queryClient } from '@shared/api'
import { PolicyModuleKind, useCreatePolicyModule } from '@shared/api/hooks'
import { QueryKeys } from '@shared/api/hooks/keys-factory'
import { monacoTheme } from '@shared/constants/monaco-theme'

import classes from './SnippetsDrawer.module.css'

export const CREATE_SNIPPET_MODAL_ID = 'create-snippet-modal'

interface IProps {
    forcedKind?: PolicyModuleKind
}

interface PolicyModuleFormValues {
    name: string
    kind: PolicyModuleKind
    scope: 'shared' | 'internal'
    description: string
    snippet: Record<string, unknown>[]
}

export const CreateSnippetModal = ({ forcedKind }: IProps) => {
    const { t, i18n } = useTranslation()

    const monaco = useMonaco()
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

    const createSnippetForm = useForm<PolicyModuleFormValues>({
        name: 'create-snippet-form',
        mode: 'uncontrolled',
        validateInputOnBlur: true,
        initialValues: {
            name: '',
            kind: forcedKind ?? 'outbound-set',
            scope: 'shared',
            description: '',
            snippet: []
        }
    })

    useEffect(() => {
        if (!monaco) return

        MonacoSetupSnippetsFeature.setup(monaco, i18n.language)
    }, [i18n.language, monaco])

    const { mutate: createSnippet, isPending: isCreating } = useCreatePolicyModule()

    useEffect(() => {
        if (!isCreating) {
            queryClient.refetchQueries({ queryKey: QueryKeys.snippets.getSnippets.queryKey })
        }
    }, [isCreating])

    const handleCreate = (values: PolicyModuleFormValues) => {
        if (!editorRef.current) return

        let currentValue = editorRef.current.getValue()

        try {
            currentValue = JSON.parse(currentValue)
        } catch {
            createSnippetForm.setFieldError('snippet', t('snippets.drawer.widget.invalid-json'))
            return
        }

        if (!Array.isArray(currentValue) || currentValue.length === 0) {
            createSnippetForm.setFieldError(
                'snippet',
                t('snippets.drawer.widget.snippet-cannot-be-empty')
            )
            return
        }

        if (
            currentValue.some(
                (item) => !item || typeof item !== 'object' || Object.keys(item).length === 0
            )
        ) {
            createSnippetForm.setFieldError(
                'snippet',
                t('snippets.drawer.widget.snippet-cannot-contain-empty-objects')
            )
            return
        }

        createSnippet({
            name: values.name,
            kind: values.kind,
            scope: values.scope,
            description: values.description || null,
            snippet: currentValue
        })
        modals.close(CREATE_SNIPPET_MODAL_ID)
    }

    const handleEditorDidMount = (monaco: Monaco) => {
        monaco.editor.defineTheme('GithubDark', {
            ...monacoTheme,
            base: 'vs-dark'
        })
    }

    return (
        <form onSubmit={(e) => createSnippetForm.onSubmit(handleCreate)(e)}>
            <Stack gap="md">
                <TextInput
                    key={createSnippetForm.key('name')}
                    label={t('snippets.drawer.widget.snippet-name')}
                    placeholder={t(
                        'snippets.drawer.widget.enter-snippet-name-cannot-be-changed-later'
                    )}
                    required
                    {...createSnippetForm.getInputProps('name')}
                />

                <Group grow>
                    <Select
                        data={[
                            { value: 'outbound-set', label: 'Outbound Module' },
                            { value: 'routing-rule-set', label: 'Routing Rule Module' }
                        ]}
                        disabled={!!forcedKind}
                        key={createSnippetForm.key('kind')}
                        label="Module Type"
                        {...createSnippetForm.getInputProps('kind')}
                    />
                    <Select
                        data={[
                            { value: 'shared', label: 'Shared' },
                            { value: 'internal', label: 'Internal' }
                        ]}
                        key={createSnippetForm.key('scope')}
                        label="Scope"
                        {...createSnippetForm.getInputProps('scope')}
                    />
                </Group>

                <TextInput
                    key={createSnippetForm.key('description')}
                    label="Description"
                    placeholder="Optional note for operators"
                    {...createSnippetForm.getInputProps('description')}
                />

                <Paper
                    p={0}
                    style={{
                        border: createSnippetForm.getInputProps('snippet').error
                            ? '1px solid var(--mantine-color-red-5)'
                            : '1px solid var(--mantine-color-dark-4)'
                    }}
                    withBorder
                >
                    <Editor
                        beforeMount={handleEditorDidMount}
                        className={classes.editor}
                        defaultLanguage="json"
                        height={400}
                        loading={t('config-editor.widget.loading-editor')}
                        onChange={(value) => {
                            try {
                                JSON.parse(value || '[]')

                                createSnippetForm.clearErrors()
                            } catch {
                                createSnippetForm.setFieldError(
                                    'snippet',
                                    t('snippets.drawer.widget.invalid-json')
                                )
                            }
                        }}
                        onMount={(editor) => {
                            editorRef.current = editor
                        }}
                        options={{
                            autoClosingBrackets: 'always',
                            autoClosingQuotes: 'always',
                            autoIndent: 'full',
                            automaticLayout: true,
                            bracketPairColorization: {
                                enabled: true,
                                independentColorPoolPerBracketType: true
                            },
                            scrollbar: {
                                useShadows: false,
                                verticalHasArrows: true,
                                horizontalHasArrows: true,
                                vertical: 'visible',
                                horizontal: 'visible',
                                arrowSize: 30,
                                alwaysConsumeMouseWheel: false
                            },
                            detectIndentation: true,
                            folding: true,
                            foldingStrategy: 'indentation',
                            fontSize: 14,
                            formatOnPaste: true,
                            formatOnType: true,
                            guides: {
                                bracketPairs: true,
                                indentation: true
                            },
                            insertSpaces: true,
                            minimap: { enabled: true },
                            quickSuggestions: true,
                            renderLineHighlight: 'all',
                            scrollBeyondLastLine: false,
                            smoothScrolling: true,
                            tabSize: 2,
                            padding: {
                                top: 10,
                                bottom: 10
                            }
                        }}
                        path="snippet://*"
                        theme="GithubDark"
                        value={JSON.stringify(createSnippetForm.getValues().snippet || [], null, 2)}
                    />
                </Paper>

                <Paper
                    mb="md"
                    p="md"
                    radius="sm"
                    style={{
                        backgroundColor: createSnippetForm.getInputProps('snippet').error
                            ? 'rgba(241, 65, 65, 0.1)'
                            : 'rgba(51, 171, 132, 0.1)',
                        border: `1px solid ${createSnippetForm.getInputProps('snippet').error ? 'rgb(241, 65, 65)' : 'rgb(51, 171, 132)'}`
                    }}
                >
                    <Code
                        block
                        color={createSnippetForm.getInputProps('snippet').error ? 'red' : 'teal'}
                        style={{
                            backgroundColor: 'transparent',
                            fontSize: '0.9rem',
                            padding: 0
                        }}
                    >
                        {createSnippetForm.getInputProps('snippet').error ||
                            t('snippets.drawer.widget.snippet-is-valid')}
                    </Code>
                </Paper>

                <Group gap="sm" justify="flex-end">
                    <Button
                        disabled={isCreating}
                        onClick={() => {
                            createSnippetForm.reset()
                            modals.close(CREATE_SNIPPET_MODAL_ID)
                        }}
                        variant="subtle"
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button loading={isCreating} type="submit">
                        {t('common.create')}
                    </Button>
                </Group>
            </Stack>
        </form>
    )
}
