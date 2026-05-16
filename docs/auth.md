# Authentication Notes

## Supabase password reset redirects

Weavly uses Supabase Auth's built-in password recovery flow. The forgot password action sends reset emails with `redirectTo` set to the current app origin plus `/reset-password`.

Configure these allowed redirect URLs in the Supabase dashboard under Auth URL settings:

- `http://localhost:3000/reset-password`
- `https://textile-accounting.vercel.app/reset-password`
- Any Vercel preview URL pattern used for pilot testing, for example the project's preview deployment URL pattern ending in `/reset-password`

Do not add a custom password reset token table. Password reset emails and temporary recovery sessions are managed by Supabase Auth.
