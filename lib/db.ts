import Dexie, { Table } from 'dexie';
import { LEGACY_MUTATION_SCOPE } from './auth-cache-scope'

// Offline writes were retired: nothing queues or replays mutations any more.
// The database stays only so the auth-boundary cleanup in
// lib/client-storage-cleanup.ts can delete queues left by older app versions.

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
