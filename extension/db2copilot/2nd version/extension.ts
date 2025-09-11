import * as vscode from 'vscode';
import { DB2Client } from './db2Client';
import { ChatParticipant } from './chatParticipant';
import { DatabaseTool } from './languageModelTool';

export async function activate(context: vscode.ExtensionContext) {
    // Initialize DB2 client
    const db2Client = new DB2Client();
    
    // Register the database tool with the language model
    const dbTool = new DatabaseTool(db2Client);
    const toolRegistration = vscode.lm.registerTool(dbTool);
    
    // Register the chat participant
    const chatParticipant = new ChatParticipant(db2Client);
    const chatRegistration = vscode.lm.registerChatParticipant(
        'copilot-db2', 
        chatParticipant
    );
    
    // Register command to run queries from markdown
    const runQueryCommand = vscode.commands.registerCommand('copilot-db2.runQuery', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found!');
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'markdown') {
            vscode.window.showErrorMessage('Please open a markdown file first!');
            return;
        }

        const prompt = document.getText();
        try {
            const result = await chatParticipant.handleQuery(prompt);
            vscode.window.showInformationMessage(`Query Result: ${result}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    context.subscriptions.push(
        runQueryCommand, 
        toolRegistration, 
        chatRegistration
    );
    
    vscode.window.showInformationMessage('Copilot DB2 Extension is now active!');
}

export function deactivate() {
    // Clean up if needed
}
