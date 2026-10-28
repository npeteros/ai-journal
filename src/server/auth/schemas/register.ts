import { z } from 'zod'

const passwordMessage = 'Password must be at least 8 characters, including a number.'

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Please enter your name.'),
    email: z.email('Please enter a valid email address.'),
    password: z.string().min(8, passwordMessage).regex(/[0-9]/, passwordMessage),
    confirm: z.string(),
    agreed: z.boolean().refine((v) => v, 'Please agree to the Terms and Privacy Policy.'),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords don't match.",
    path: ['confirm'],
  })

export type RegisterValues = z.infer<typeof registerSchema>
