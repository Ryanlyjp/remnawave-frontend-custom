import {
    CreateConfigProfileCommand,
    GetComputedConfigProfileByUuidCommand,
    GetConfigProfileByUuidCommand,
    GetConfigProfilesCommand,
    UpdateConfigProfileCommand
} from '@remnawave/backend-contract'
import { z } from 'zod'

export const CoreEngineSchema = z.enum(['XRAY', 'SINGBOX'])
export type CoreEngine = z.infer<typeof CoreEngineSchema>

const ConfigProfileWithEngineSchema =
    GetConfigProfileByUuidCommand.ResponseSchema.shape.response.extend({
        engine: CoreEngineSchema
    })

export type ConfigProfileWithEngine = z.infer<typeof ConfigProfileWithEngineSchema>

export const GetConfigProfilesWithEngineResponseSchema =
    GetConfigProfilesCommand.ResponseSchema.extend({
        response: GetConfigProfilesCommand.ResponseSchema.shape.response.extend({
            configProfiles: z.array(ConfigProfileWithEngineSchema)
        })
    })

export const GetConfigProfileWithEngineResponseSchema =
    GetConfigProfileByUuidCommand.ResponseSchema.extend({
        response: ConfigProfileWithEngineSchema
    })

export const GetComputedConfigProfileWithEngineResponseSchema =
    GetComputedConfigProfileByUuidCommand.ResponseSchema.extend({
        response: ConfigProfileWithEngineSchema
    })

export const CreateConfigProfileWithEngineBodySchema =
    CreateConfigProfileCommand.RequestBodySchema.extend({
        engine: CoreEngineSchema
    })

export const UpdateConfigProfileWithEngineResponseSchema =
    UpdateConfigProfileCommand.ResponseSchema.extend({
        response: ConfigProfileWithEngineSchema
    })
