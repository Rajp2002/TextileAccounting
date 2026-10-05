import React from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { FounderAuthFrame } from '../../../components/admin/auth-frame'
import { FounderLoginForm } from '../../../app/(admin-auth)/admin/login/login-form'
import { FounderVerifyForm } from '../../../app/(admin-auth)/admin/verify/verify-form'
import ResetPasswordForm from '../../../app/(auth)/reset-password/ResetPasswordForm'
import '../../../app/globals.css'
const mode = new URL(location.href).searchParams.get('mode') ?? 'login'
const factor = { id: 'e73ba91a-2d52-4e93-8a39-bdb902757fe2', label: 'Authenticator 1' }
createRoot(document.getElementById('root')!).render(<><p className="bg-saffron-soft p-3 text-center text-xs">Synthetic component fixture · no real authentication or MFA evidence</p>{mode === 'reset' ? <ResetPasswordForm/> : <FounderAuthFrame title={mode === 'login' ? 'Sign in to the founder console' : mode === 'new' ? 'Connect your authenticator' : 'Verify founder access'} description="Synthetic founder flow for browser verification.">{mode === 'login' ? <FounderLoginForm enabled denied={false} returnTo="/admin"/> : <FounderVerifyForm factors={mode === 'new' ? [] : [factor]} enrollmentEnabled returnTo="/admin"/>}</FounderAuthFrame>}<Toaster/></>)
