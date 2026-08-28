import { z } from 'zod'

const UserHostAliasSchema = z.object({
    hostUuid: z.string().uuid(),
    viewPosition: z.number().int(),
    defaultRemark: z.string(),
    customRemark: z.string().nullable(),
    effectiveRemark: z.string()
})

const RequestSchema = z.object({
    uuid: z.string().uuid()
})

const ResponseSchema = z.object({
    response: z.object({
        userUuid: z.string().uuid(),
        hosts: z.array(UserHostAliasSchema)
    })
})

export const GetUserHostAliasesCommand = {
    TSQ_url: '/api/users/:uuid/host-aliases',
    RequestSchema,
    ResponseSchema
}

export const UpdateUserHostAliasesCommand = {
    TSQ_url: '/api/users/:uuid/host-aliases',
    RequestSchema,
    RequestBodySchema: z.object({
        aliases: z
            .array(
                z.object({
                    hostUuid: z.string().uuid(),
                    remark: z.string().trim().min(1).max(50)
                })
            )
            .max(10000)
    }),
    ResponseSchema,
    endpointDetails: {
        REQUEST_METHOD: 'put' as const
    }
}
