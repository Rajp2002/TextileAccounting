const chain: any = new Proxy(function () {}, { get: (_t, p) => p === 'then' ? undefined : chain, apply: () => chain })
export function createClient() { return { from: () => chain, channel: () => ({ on: () => chain, subscribe: () => chain }), removeChannel: () => {}, auth: { getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }
export default createClient
