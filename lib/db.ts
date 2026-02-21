import Dexie, { Table } from 'dexie';

export interface OfflineMutation {
    id?: number;
    table: string;
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    data: any;
    timestamp: number;
    synced: boolean;
}

export class TextileDatabase extends Dexie {
    mutations!: Table<OfflineMutation>;

    constructor() {
        super('TextileDB');
        this.version(1).stores({
            mutations: '++id, table, type, timestamp, synced'
        });
    }
}

export const db = new TextileDatabase();

export async function queueMutation(table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', data: any) {
    await db.mutations.add({
        table,
        type,
        data,
        timestamp: Date.now(),
        synced: false
    });
}
