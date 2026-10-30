import React from 'react'
import {createRoot} from 'react-dom/client'
import {SupportThread,SupportInbox} from '../../../components/support/support-workspace'
import {SupportShell} from '../../../components/support/support-shell'
import {SupportHistoryExport} from '../../../components/support/support-history-export'
import {I18nContext,type Language} from '../../../lib/i18n/context'
import '../../../app/globals.css'
const params=new URL(location.href).searchParams
const founder=params.get('kind')==='founder'||location.pathname.startsWith('/admin/'),id=params.get('ticket')??location.pathname.match(/support\/([0-9a-f-]{36})/)?.[1]
const language:Language=params.get('lang')==='hi'?'hi':params.get('lang')==='gu'?'gu':'en'
const content=id?<SupportThread founder={founder} id={id}/>:<><SupportInbox founder={founder}/>{!founder&&<SupportHistoryExport/>}</>
createRoot(document.getElementById('root')!).render(<I18nContext.Provider value={{language,setLanguage:async value=>({ok:true,language:value}),languageStatus:'ready',pendingLanguage:null,languageError:null,t:key=>key,tx:text=>text}}>{founder?<main className="min-h-screen bg-app-bg px-4 py-8 text-ink" style={{fontFamily:'system-ui, sans-serif'}}><div className="mx-auto max-w-5xl"><p className="mb-6 border-b border-hairline pb-3 text-sm font-medium">Synthetic support component fixture · no authentication evidence</p>{content}</div></main>:<SupportShell>{content}</SupportShell>}</I18nContext.Provider>)
