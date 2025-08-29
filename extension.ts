import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    const provider = new DeploymentAssistantProvider(context);
    
    // Create the chat participant
    const chatParticipant = vscode.chat.createChatParticipant(
        'deployment-assistant.deploymentAssistant',
        async (request, context, progress, token) => {
            return provider.handleRequest(request, context, progress, token);
        }
    );
    
    chatParticipant.iconPath = vscode.Uri.file(
        path.join(context.extensionPath, 'icon.png')
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('deployment-assistant.start', () => {
            provider.startDeployment();
        }),
        chatParticipant
    );
}

class DeploymentAssistantProvider {
    private outputChannel: vscode.OutputChannel;
    
    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Deployment Assistant');
    }

    async startDeployment() {
        this.log('Starting deployment automation...');
        await this.processStep('readcsvscript.md', 'CSV Analysis');
        await this.processStep('cleansingscripts.md', 'SQL Cleansing');
        this.log('Deployment automation completed!');
    }

    async handleRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        progress: vscode.Progress<vscode.ChatResponseProgress>,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResponse> {
        // Handle chat requests if needed
        return { 
            messages: [vscode.ChatResponseMessage.Text('Deployment Assistant is ready. Use the command palette to start automation.')]
        };
    }

    private async processStep(mdFile: string, stepName: string) {
        try {
            this.log(`Processing step: ${stepName}`);
            const instructions = await this.readMarkdownFile(mdFile);
            
            // Use the chat API to process the instructions
            const messages = [
                vscode.LanguageModelChatMessage.User(instructions)
            ];
            
            const chatResponse = await vscode.lm.sendChatRequest(
                vscode.LanguageModelChatSelector.defaul(),
                messages,
                {},
                new vscode.CancellationTokenSource().token
            );
            
            let responseText = '';
            for await (const fragment of chatResponse.text) {
                responseText += fragment;
            }
            
            if (stepName === 'CSV Analysis') {
                await this.generateShellScript(responseText);
            } else {
                await this.cleanseSQLFiles(responseText);
            }
        } catch (error) {
            this.log(`Error in ${stepName}: ${error}`);
            vscode.window.showErrorMessage(`Error in ${stepName}: ${error}`);
        }
    }

    private async generateShellScript(llmResponse: string) {
        this.log('Generating shell script...');
        fs.writeFileSync('gendb2ddl.sh', llmResponse);
        fs.chmodSync('gendb2ddl.sh', 0o755); // Make it executable
        await this.executeShellScript();
    }

    private async executeShellScript() {
        this.log('Executing shell script...');
        const commands = fs.readFileSync('gendb2ddl.sh', 'utf-8').split('\n');
        
        for (const cmd of commands) {
            if (cmd.trim() && !cmd.trim().startsWith('#')) {
                this.log(`Executing: ${cmd}`);
                await new Promise((resolve, reject) => {
                    exec(cmd, (error, stdout, stderr) => {
                        if (error) {
                            this.log(`Error executing command: ${error}`);
                            reject(error);
                        } else {
                            if (stdout) this.log(`Output: ${stdout}`);
                            if (stderr) this.log(`Error output: ${stderr}`);
                            resolve(stdout);
                        }
                    });
                });
            }
        }
    }

    private async cleanseSQLFiles(instructions: string) {
        this.log('Cleansing SQL files...');
        const rawDir = 'rawddlscripts/';
        const outputDir = 'scriptedfiles/';
        
        if (!fs.existsSync(rawDir)) {
            this.log('Raw DDL scripts directory not found!');
            return;
        }
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const files = fs.readdirSync(rawDir);
        for (const file of files) {
            if (file.endsWith('.sql')) {
                this.log(`Processing file: ${file}`);
                const content = fs.readFileSync(path.join(rawDir, file), 'utf-8');
                
                // Use the chat API to cleanse the SQL
                const messages = [
                    vscode.LanguageModelChatMessage.User(instructions),
                    vscode.LanguageModelChatMessage.User(`Cleanse this SQL:\n${content}`)
                ];
                
                const chatResponse = await vscode.lm.sendChatRequest(
                    vscode.LanguageModelChatSelector.defaul(),
                    messages,
                    {},
                    new vscode.CancellationTokenSource().token
                );
                
                let cleansedContent = '';
                for await (const fragment of chatResponse.text) {
                    cleansedContent += fragment;
                }
                
                fs.writeFileSync(path.join(outputDir, file), cleansedContent);
                this.log(`Cleansed file saved: ${file}`);
            }
        }
    }

    private async readMarkdownFile(filename: string): Promise<string> {
        try {
            return fs.readFileSync(filename, 'utf-8');
        } catch (error) {
            this.log(`Error reading file ${filename}: ${error}`);
            throw error;
        }
    }

    private log(message: string) {
        this.outputChannel.appendLine(`${new Date().toISOString()}: ${message}`);
    }
}

export function deactivate() {}
