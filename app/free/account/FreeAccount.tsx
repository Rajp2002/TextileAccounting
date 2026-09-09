'use client'
import {useState} from 'react'
import Link from 'next/link'
import {DeleteAccountCard} from '@/components/settings/delete-account-card'
import {Button} from '@/components/ui/button'
import {useTranslation} from '@/lib/i18n/context'
import {freeText} from '@/lib/i18n/free-tier'
export default function FreeAccount({name,email,organizationName}:{name:string;email:string;organizationName:string}){
 const {language}=useTranslation(),[value,setValue]=useState(name),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 return <section className="space-y-5"><h1 className="text-2xl font-semibold">{freeText(language,'settings')}</h1><p>{email}</p><form className="flex flex-wrap gap-3" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await fetch('/api/free/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:value})});setMessage(freeText(language,r.ok?'accountUpdated':'temporary'))}catch{setMessage(freeText(language,'temporary'))}finally{setBusy(false)}}}><label>{freeText(language,'accountName')}<input className="ml-3 rounded border p-2" value={value} maxLength={100} onChange={e=>setValue(e.target.value)}/></label><Button disabled={busy||value.trim().length<2}>{freeText(language,'updateAccount')}</Button></form><p role="status">{message}</p><Link href="/forgot-password" className="underline">{freeText(language,'resetPassword')}</Link><DeleteAccountCard organizationName={organizationName}/></section>
}
