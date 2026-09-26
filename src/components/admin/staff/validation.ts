import * as z from "zod"

const role = z.enum(["ADMIN", "CASHIER", "KITCHEN"])

export const CreateStaffSchema = z.object({
  name: z.string().trim().min(2, "NAME_REQUIRED").max(60, "TOO_LONG"),
  email: z.string().trim().toLowerCase().email("EMAIL_INVALID").max(120),
  password: z.string().min(10, "PASSWORD_TOO_SHORT").max(200),
  role,
})

export const UpdateStaffSchema = z.object({
  name: z.string().trim().min(2, "NAME_REQUIRED").max(60, "TOO_LONG"),
  role,
  isActive: z.boolean(),
  password: z.union([z.literal(""), z.string().min(10, "PASSWORD_TOO_SHORT").max(200)]),
})
