import * as vscode from 'vscode';
import { DB2Client } from './db2Client';
import { generateSQLPrompt } from './prompts';

export class ChatParticipant implements vscode.ChatParticipant {
    public readonly id = 'copilot-db2';
    public readonly name = 'DB2 Copilot';

    constructor(private db2Client: DB2Client) {}

    async participate(
        request: vscode.ChatRequest, 
        context: vscode.ChatContext, 
        response: vscode.ChatResponse, 
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        try {
            const result = await this.handleQuery(request.prompt);
            response.markdown(result);
            return { metadata: { handled: true } };
        } catch (error: any) {
            response.markdown(`Error: ${error.message}`);
            return { metadata: { handled: true, error: true } };
        }
    }

    async handleQuery(prompt: string): Promise<string> {
        // Use the language model to generate SQL from natural language
        const messages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(generateSQLPrompt(prompt))
        ];

        // Get available language models
        const models = vscode.lm.selectChatModels({ vendor: 'copilot' });
        if (models.length === 0) {
            throw new Error('No language models available');
        }

        // Use the first available model
        const model = models[0];
        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        
        let sql = '';
        for await (const fragment of response.text) {
            sql += fragment;
        }

        // Clean up the SQL (remove markdown code blocks if present)
        sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();

        if (!sql) {
            throw new Error('Could not generate SQL from the prompt');
        }

        // Execute the generated SQL
        const results = await this.db2Client.executeQuery(sql);
        
        // Format the results
        if (results.length === 0) {
            return 'No results found.';
        }

        // Create a markdown table from the results
        const columns = Object.keys(results[0]);
        let markdown = `### Query Results\n\n`;
        markdown += `Generated SQL: \`${sql}\`\n\n`;
        markdown += `| ${columns.join(' | ')} |\n`;
        markdown += `| ${columns.map(() => '---').join(' | ')} |\n`;
        
        for (const row of results) {
            markdown += `| ${columns.map(col => String(row[col] || 'NULL')).join(' | ')} |\n`;
        }
        
        return markdown;
    }
}
