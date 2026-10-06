'use client'
import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { liteSupportingText } from '@/lib/i18n/lite-supporting'
import styles from './lite-disclosure.module.css'
/** Optional prose folds only on Lite mobile; the same children stay mounted. */
export function LiteDisclosure({enabled,title,children}:{enabled:boolean;title:'details'|'billingDetails'|'plans';children:React.ReactNode}){
 const [open,setOpen]=useState(false),id=useId(),{language}=useTranslation()
 if(!enabled)return children
 return <div className={styles.root}><button type="button" className={styles.toggle} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}><span>{liteSupportingText(language,title)}</span><ChevronDown aria-hidden="true" className={open?'rotate-180':undefined}/></button><div id={id} className={open?undefined:styles.closed}>{children}</div></div>
}
