import * as vscode from 'vscode';
import { DB2Client } from './db2Client';

export class DatabaseTool implements vscode.LanguageModelTool {
    public readonly name = 'query_database';
    public readonly description = 'Execute SQL queries against a DB2 database and return the results';

    constructor(private db2Client: DB2Client) {}

    async call(arg: string): Promise<string> {
        try {
            const results = await this.db2Client.executeQuery(arg);
            return JSON.stringify(results, null, 2);
        } catch (error: any) {
            return `Error executing query: ${error.message}`;
        }
    }
}
