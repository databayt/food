import * as z from "zod"

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("EMAIL_INVALID"),
  password: z.string().min(1, "PASSWORD_REQUIRED").max(200),
})

export type LoginInput = z.infer<typeof LoginSchema>
