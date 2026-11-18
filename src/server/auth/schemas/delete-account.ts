import { z } from 'zod'

/** What the user must type to confirm deleting their account. */
export const DELETE_CONFIRMATION = 'DELETE'

/** Days a deleted account is kept before its data may be purged (the purge job is separate). */
export const ACCOUNT_DELETION_GRACE_DAYS = 30

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to continue.'),
  confirmation: z
    .string()
    .refine((value) => value === DELETE_CONFIRMATION, `Type ${DELETE_CONFIRMATION} to confirm.`),
})

/** What the form holds while the user types (`confirmation` is any string until validated). */
export type DeleteAccountInput = z.input<typeof deleteAccountSchema>
/** What passes validation (`confirmation` is narrowed to `'DELETE'` by the refine). */
export type DeleteAccountValues = z.output<typeof deleteAccountSchema>
