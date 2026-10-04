import React from 'react'
import {createRoot} from 'react-dom/client'
import {SupportThread,SupportInbox} from '../../../components/support/support-workspace'
import '../../../app/globals.css'
const params=new URL(location.href).searchParams
const founder=params.get('kind')==='founder'||location.pathname.startsWith('/admin/'),id=params.get('ticket')??location.pathname.match(/support\/([0-9a-f-]{36})/)?.[1]
createRoot(document.getElementById('root')!).render(<main className="min-h-screen bg-app-bg px-4 py-8 text-ink" style={{fontFamily:'system-ui, sans-serif'}}><div className="mx-auto max-w-5xl"><p className="mb-6 border-b border-hairline pb-3 text-sm font-medium">Synthetic support component fixture · no authentication evidence</p>{id?<SupportThread founder={founder} id={id}/>:<SupportInbox founder={founder}/>}</div></main>)
