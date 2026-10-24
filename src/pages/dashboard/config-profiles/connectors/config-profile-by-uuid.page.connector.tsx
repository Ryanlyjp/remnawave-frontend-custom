import { consola } from 'consola/browser'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { app } from 'src/config'

import { useGetConfigProfile, useGetSnippets } from '@shared/api/hooks'
import { ROUTES } from '@shared/constants'
import { LoadingScreen } from '@shared/ui'
import { fetchWithProgress } from '@shared/utils/fetch-with-progress'

import { ConfigProfileByUuidPageComponent } from '../components/config-profile-by-uuid.page.component'

export function ConfigProfileByUuidPageConnector() {
    const { uuid } = useParams()

    const [downloadProgress, setDownloadProgress] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [isWasmCrashed, setIsWasmCrashed] = useState(false)
    const [isWasmRestarting, setIsWasmRestarting] = useState(false)
    const wasmBytesCache = useRef<ArrayBuffer | null>(null)

    const { data: configProfile, isLoading: isConfigProfileLoading } = useGetConfigProfile({
        route: { uuid: uuid! },
        rQueryParams: {
            enabled: !!uuid,
            refetchOnWindowFocus: false
        }
    })

    const { data: snippets, isLoading: isSnippetsLoading } = useGetSnippets({})

    const initWasm = useCallback(async () => {
        try {
            const go = new window.Go()
            const wasmInitialized = new Promise<void>((resolve) => {
                window.onWasmInitialized = () => {
                    consola.info('WASM module initialized')
                    resolve()
                }
            })

            let wasmBytes: ArrayBuffer
            if (wasmBytesCache.current) {
                wasmBytes = wasmBytesCache.current
            } else {
                wasmBytes = await fetchWithProgress(app.configEditor.wasmUrl, setDownloadProgress)
                wasmBytesCache.current = wasmBytes
            }

            const { instance } = await WebAssembly.instantiate(wasmBytes, go.importObject)

            go.run(instance).then(() => {
                consola.warn('WASM module exited unexpectedly')
                setIsWasmCrashed(true)
            })

            await wasmInitialized

            if (typeof window.XrayParseConfig === 'function') {
                setIsLoading(false)
                setIsWasmRestarting(false)
            } else {
                throw new Error('XrayParseConfig not initialized')
            }
        } catch (err: unknown) {
            consola.error('WASM initialization error:', err)
            setIsLoading(false)
            setIsWasmRestarting(false)
        }
    }, [])

    const restartWasm = useCallback(() => {
        setIsWasmRestarting(true)
        setIsWasmCrashed(false)
        initWasm()
    }, [initWasm])

    useLayoutEffect(() => {
        if (!configProfile || configProfile.engine === 'SINGBOX') return

        const initialization = window.setTimeout(() => initWasm(), 0)

        return () => {
            window.clearTimeout(initialization)
            delete window.onWasmInitialized
        }
    }, [configProfile?.engine])

    if (!uuid) {
        return <Navigate to={ROUTES.DASHBOARD.MANAGEMENT.CONFIG_PROFILES} />
    }

    if (
        isConfigProfileLoading ||
        !configProfile ||
        isSnippetsLoading ||
        !snippets ||
        (configProfile.engine === 'XRAY' && isLoading)
    ) {
        return <LoadingScreen text="The WASM module is loading..." value={downloadProgress} />
    }

    return (
        <ConfigProfileByUuidPageComponent
            configProfile={configProfile}
            isWasmCrashed={isWasmCrashed}
            isWasmRestarting={isWasmRestarting}
            onRestartWasm={restartWasm}
            snippets={snippets}
        />
    )
}
