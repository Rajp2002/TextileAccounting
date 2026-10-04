/** A public-send attempt is immutable until success or a definitive rejection.
 * Kept in component memory only; refreshing a ticket must not change its key/version. */
export type SupportSendAttempt={kind:string;key:string;payload:Record<string,unknown>}
export function supportSendAttempt(previous:SupportSendAttempt|null,kind:string,payload:Record<string,unknown>,newKey:()=>string):SupportSendAttempt{
 if(previous){if(previous.kind!==kind)throw new Error('Retry the previous unconfirmed action before starting another action.');return previous}
 return {kind,key:newKey(),payload:structuredClone(payload)}
}
export function definiteSendRejection(error:unknown){const status=(error as {status?:number})?.status;return status===400||status===409}
