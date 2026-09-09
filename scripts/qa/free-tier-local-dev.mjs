/** Launch only against CLI-created localhost services; blank external .env keys. */
import {readFileSync,existsSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {spawn} from 'node:child_process'
import {randomBytes} from 'node:crypto'
const path=process.argv[2]
if(!path?.startsWith('/tmp/weavly-free-'))throw new Error('Expected the isolated local Supabase env file')
const local=parseEnv(readFileSync(path,'utf8'))
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(local.API_URL??''))throw new Error('Refusing a non-local Supabase URL')
if(!local.ANON_KEY||!local.SERVICE_ROLE_KEY)throw new Error('Local keys missing')
const env={...process.env}
for(const key of Object.keys(env))if(/SUPABASE|UPSTASH|RAZORPAY|SENTRY|SMTP|WHATSAPP|TWILIO|RESEND|SENDGRID|STRIPE|OPENAI|CRON_SECRET|SECRET_KEY|API_KEY/.test(key))env[key]=''
for(const file of ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local'])if(existsSync(file))for(const key of Object.keys(parseEnv(readFileSync(file,'utf8'))))env[key]=''
Object.assign(env,{NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:local.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,NEXT_PUBLIC_APP_URL:'http://localhost:3100',WEAVLY_FREE_BETA_EMAILS:'free-owner@weavly.test,free-second@weavly.test',WEAVLY_FREE_SIGNING_KEY_ID:'local-test',WEAVLY_FREE_SIGNING_KEYS:JSON.stringify({'local-test':randomBytes(32).toString('hex')})})
const build=process.argv[3]==='build',start=process.argv[3]==='start'
if(build||start)env.NODE_ENV='production'
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',...(build?['build','--webpack']:start?['start','--port','3100']:['dev','--webpack','--port','3100'])],{env,stdio:'inherit'})
child.on('exit',code=>process.exit(code??1))
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal))
