import type { editor } from 'monaco-editor'

import consola from 'consola/browser'
import dayjs from 'dayjs'
import { RefObject } from 'react'

const PROTECTED_ROOT_KEYS = new Set(['api', 'inbounds', 'metrics', 'snippets', 'stats'])

const replaceSnippetsInRoot = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any,
    snippetsMap: Map<string, unknown>
): void => {
    const names = config.snippets

    delete config.snippets

    if (!Array.isArray(names)) return

    const merged: Record<string, unknown> = {}

    for (const name of names) {
        const snippet = snippetsMap.get(name)

        if (!snippet) {
            consola.error(`Snippet ${name} not found`)
            continue
        }

        for (const part of Array.isArray(snippet) ? snippet : [snippet]) {
            if (!part || typeof part !== 'object' || Array.isArray(part)) continue

            Object.assign(merged, part)
        }
    }

    for (const [key, value] of Object.entries(merged)) {
        if (PROTECTED_ROOT_KEYS.has(key) || key in config) continue

        config[key] = value
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const replaceSnippetsInArray = (array: any[], snippetsMap: Map<string, unknown>): void => {
    for (let i = array.length - 1; i >= 0; i--) {
        const item = array[i]

        if (item.snippet) {
            const snippet = snippetsMap.get(item.snippet)

            if (snippet) {
                if (Array.isArray(snippet)) {
                    array.splice(i, 1, ...snippet)
                } else {
                    // eslint-disable-next-line no-param-reassign
                    array[i] = snippet
                }
            } else {
                consola.error(`Snippet ${item.snippet} not found`)
                array.splice(i, 1)
            }
        }
    }
}

interface ConfigWithPolicyModules extends Record<string, unknown> {
    outbounds?: unknown[]
    routing?: {
        rules?: unknown[]
        balancers?: unknown[]
    }
}

const applyPolicyModules = (config: ConfigWithPolicyModules): void => {
    const policyModules = config.policyModules as
        | {
              outbounds?: string[]
              routingRules?: string[]
              balancers?: string[]
          }
        | undefined

    if (policyModules?.outbounds?.length) {
        config.outbounds ??= []
        config.outbounds.push(...policyModules.outbounds.map((snippet) => ({ snippet })))
    }

    if (policyModules?.routingRules?.length) {
        config.routing ??= {}
        config.routing.rules ??= []
        config.routing.rules.push(...policyModules.routingRules.map((snippet) => ({ snippet })))
    }

    if (policyModules?.balancers?.length) {
        config.routing ??= {}
        config.routing.balancers ??= []
        config.routing.balancers.push(...policyModules.balancers.map((snippet) => ({ snippet })))
    }

    delete config.policyModules
}

export const ConfigValidationFeature = {
    validateSingbox: (
        editorRef: RefObject<editor.IStandaloneCodeEditor | null>,
        setResult: (message: string) => void,
        setIsConfigValid: (isValid: boolean) => void,
        snippetsMap: Map<string, unknown>
    ) => {
        try {
            if (!editorRef.current) return
            const config = JSON.parse(editorRef.current.getValue()) as Record<string, unknown>

            if (!Array.isArray(config.inbounds) || !Array.isArray(config.outbounds)) {
                throw new Error('Sing-box config must contain inbounds and outbounds arrays.')
            }

            const refs = config.policyModules as
                | { outbounds?: string[]; routingRules?: string[] }
                | undefined
            for (const name of [...(refs?.outbounds ?? []), ...(refs?.routingRules ?? [])]) {
                if (!snippetsMap.has(name)) throw new Error(`Policy module not found: ${name}`)
            }

            setResult(`${dayjs().format('HH:mm:ss')} | Sing-box JSON structure is valid.`)
            setIsConfigValid(true)
        } catch (err: unknown) {
            setResult(`${dayjs().format('HH:mm:ss')} | ${(err as Error).message}`)
            setIsConfigValid(false)
        }
    },
    validate: (
        editorRef: RefObject<editor.IStandaloneCodeEditor | null>,

        setResult: (message: string) => void,
        setIsConfigValid: (isValid: boolean) => void,
        snippetsMap: Map<string, unknown>
    ) => {
        try {
            if (!editorRef.current) return

            const currentValue = editorRef.current.getValue()

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let clonedCurrentValue: any
            try {
                clonedCurrentValue = JSON.parse(currentValue)
            } catch {
                setResult(`${dayjs().format('HH:mm:ss')} | Invalid JSON.`)
                setIsConfigValid(false)
                return
            }

            applyPolicyModules(clonedCurrentValue)
            replaceSnippetsInRoot(clonedCurrentValue, snippetsMap)

            if (clonedCurrentValue.outbounds) {
                replaceSnippetsInArray(clonedCurrentValue.outbounds, snippetsMap)
            }

            if (clonedCurrentValue.routing?.rules) {
                replaceSnippetsInArray(clonedCurrentValue.routing.rules, snippetsMap)
            }

            if (clonedCurrentValue.routing?.balancers) {
                replaceSnippetsInArray(clonedCurrentValue.routing.balancers, snippetsMap)
            }

            const validationResult = window.XrayParseConfig(JSON.stringify(clonedCurrentValue))

            setResult(
                `${dayjs().format('HH:mm:ss')} | ${validationResult || 'Xray config is valid.'}`
            )
            setIsConfigValid(!validationResult)
        } catch (err: unknown) {
            const message = (err as Error).message
            if (message?.includes('Go program has already exited')) {
                setResult(`${dayjs().format('HH:mm:ss')} | WASM module crashed, restarting...`)
            } else {
                setResult(`${dayjs().format('HH:mm:ss')} | Validation error: ${message}`)
            }
            setIsConfigValid(false)
        }
    }
}
