import * as vscode from 'vscode';
import * as ibmdb from 'ibm_db';
import { copilot, copilotPrompt } from '@vscode/copilot';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('copilot-db2.runQuery', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active markdown file!');
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'markdown') {
            vscode.window.showErrorMessage('Please open a markdown file first!');
            return;
        }

        const prompt = document.getText();
        const config = vscode.workspace.getConfiguration('copilotDb2').get('connection') as any;

        try {
            const result = await executeQuery(prompt, config);
            vscode.window.showInformationMessage(`Query Result: ${result}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

async function executeQuery(prompt: string, config: any): Promise<string> {
    const connString = `DATABASE=${config.database};HOSTNAME=${config.hostname};PORT=${config.port};UID=${config.username};PWD=${config.password};SCHEMA=${config.schema}`;
    
    // Use Copilot to generate SQL from natural language
    const sqlResponse = await copilot.sendRequest(copilotPrompt`
        Convert this natural language query to DB2 SQL:
        "${prompt}"
        
        Return only the SQL query without any explanations.
        Schema: ${config.schema}
    `);

    const generatedSql = sqlResponse.text.trim();
    vscode.window.showInformationMessage(`Generated SQL: ${generatedSql}`);

    return new Promise((resolve, reject) => {
        ibmdb.open(connString, (err, conn) => {
            if (err) reject(err);

            conn.query(generatedSql, (err, data) => {
                if (err) reject(err);
                
                conn.close(() => {
                    resolve(JSON.stringify(data));
                });
            });
        });
    });
}

export function deactivate() {}
