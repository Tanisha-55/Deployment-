import * as vscode from 'vscode';
import * as ibmdb from 'ibm_db';

export class DB2Client {
    private connection: any = null;

    async connect(): Promise<void> {
        const config = vscode.workspace.getConfiguration('copilotDb2.connection');
        
        const database = config.get('database') as string;
        const hostname = config.get('hostname') as string;
        const port = config.get('port') as number;
        const username = config.get('username') as string;
        const password = config.get('password') as string;
        
        if (!database || !hostname || !username || !password) {
            throw new Error('DB2 connection configuration is incomplete');
        }

        const connString = `DATABASE=${database};HOSTNAME=${hostname};PORT=${port};UID=${username};PWD=${password};PROTOCOL=TCPIP`;
        
        return new Promise((resolve, reject) => {
            ibmdb.open(connString, (err, conn) => {
                if (err) {
                    reject(err);
                } else {
                    this.connection = conn;
                    resolve();
                }
            });
        });
    }

    async executeQuery(sql: string): Promise<any[]> {
        if (!this.connection) {
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            this.connection.query(sql, (err: any, data: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    async disconnect(): Promise<void> {
        if (this.connection) {
            return new Promise((resolve) => {
                this.connection.close(() => {
                    this.connection = null;
                    resolve();
                });
            });
        }
    }
}
