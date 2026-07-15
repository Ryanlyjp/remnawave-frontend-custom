import type { editor } from 'monaco-editor'

import consola from 'consola/browser'
import dayjs from 'dayjs'
import { RefObject } from 'react'

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

const applyPolicyModules = (config: Record<string, any>): void => {
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
