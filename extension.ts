import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    const provider = new DeploymentAssistantProvider(context);
    context.subscriptions.push(
        vscode.commands.registerCommand('deployment-assistant.start', () => {
            provider.startDeployment();
        }),
        vscode.chat.createChatParticipant('deployment-assistant', provider)
    );
}

class DeploymentAssistantProvider implements vscode.ChatParticipant {
    constructor(private context: vscode.ExtensionContext) {}

    async startDeployment() {
        await this.processStep('readcsvscript.md', 'CSV Analysis');
        await this.processStep('cleansingscripts.md', 'SQL Cleansing');
    }

    private async processStep(mdFile: string, stepName: string) {
        const instructions = await this.readMarkdownFile(mdFile);
        const response = await vscode.lm.sendRequest(
            vscode.LanguageModelChatSelector.defaul(),
            instructions
        );

        if (stepName === 'CSV Analysis') {
            await this.generateShellScript(response);
        } else {
            await this.cleanseSQLFiles(response);
        }
    }

    private async generateShellScript(llmResponse: any) {
        const scriptContent = llmResponse.text;
        fs.writeFileSync('gendb2ddl.sh', scriptContent);
        await this.executeShellScript();
    }

    private async executeShellScript() {
        const commands = fs.readFileSync('gendb2ddl.sh', 'utf-8').split('\n');
        for (const cmd of commands) {
            if (cmd.trim()) {
                await new Promise((resolve) => exec(cmd, resolve));
            }
        }
    }

    private async cleanseSQLFiles(llmResponse: any) {
        const rawDir = 'rawddlscripts/';
        const outputDir = 'scriptedfiles/';
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const files = fs.readdirSync(rawDir);
        for (const file of files) {
            if (file.endsWith('.sql')) {
                const content = fs.readFileSync(path.join(rawDir, file), 'utf-8');
                const cleansed = await vscode.lm.sendRequest(
                    vscode.LanguageModelChatSelector.defaul(),
                    `Cleanse this SQL based on instructions: ${content}`
                );
                fs.writeFileSync(path.join(outputDir, file), cleansed.text);
            }
        }
    }

    private async readMarkdownFile(filename: string): Promise<string> {
        return fs.readFileSync(filename, 'utf-8');
    }
}
