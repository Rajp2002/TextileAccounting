import Dexie, { Table } from 'dexie';
import { isPrincipalCacheScope, LEGACY_MUTATION_SCOPE } from './auth-cache-scope'

export interface OfflineMutation<T = unknown> {
    id?: number;
    scope: string;
    table: string;
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    data: T;
    timestamp: number;
    synced: number; // 0 for false, 1 for true
}

export class TextileDatabase extends Dexie {
    mutations!: Table<OfflineMutation>;

    constructor() {
        super('TextileDB');
        this.version(1).stores({
            mutations: '++id, table, type, timestamp, synced'
        });
        this.version(2).stores({
            mutations: '++id, scope, table, type, timestamp, synced'
        }).upgrade((transaction) => (
            transaction.table('mutations').toCollection().modify((mutation: OfflineMutation) => {
                // Existing rows were created before a principal scope existed.
                // Keep them quarantined so they can only be removed by the
                // legacy cleanup path and can never be replayed.
                mutation.scope = LEGACY_MUTATION_SCOPE
            })
        ));
    }
}

export const db = new TextileDatabase();

function requireScope(scope: string) {
    if (!isPrincipalCacheScope(scope)) {
        throw new Error('Offline mutations require a verified principal scope.')
    }
}

export async function queueMutation<T = unknown>(
    table: string,
    type: 'INSERT' | 'UPDATE' | 'DELETE',
    data: T,
    scope: string,
) {
    requireScope(scope)
    await db.mutations.add({
        scope,
        table,
        type,
        data,
        timestamp: Date.now(),
        synced: 0
    });
}

export async function getPendingMutations(scope: string) {
    requireScope(scope)
    return db.mutations
        .toCollection()
        .filter((mutation) => mutation.scope === scope && mutation.synced === 0)
        .toArray()
}

export async function discardPendingMutations(scope: string) {
    requireScope(scope)
    return db.mutations
        .toCollection()
        .filter((mutation) => mutation.scope === scope && mutation.synced === 0)
        .delete()
}

export async function deleteMutationsForScope(scope: string) {
    if (scope !== LEGACY_MUTATION_SCOPE) requireScope(scope)
    return db.mutations
        .toCollection()
        .filter((mutation) => mutation.scope === scope)
        .delete()
}
