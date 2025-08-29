import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    const provider = new DeploymentAssistantProvider(context);
    
    // Register the command
    context.subscriptions.push(
        vscode.commands.registerCommand('deployment-assistant.start', () => {
            provider.startDeployment();
        })
    );

    // Try to register chat participant if API is available
    try {
        if ((vscode as any).chat && (vscode as any).chat.createChatParticipant) {
            const chatParticipant = (vscode as any).chat.createChatParticipant(
                'deployment-assistant',
                async (request: any, context: any, response: any, token: vscode.CancellationToken) => {
                    return provider.handleRequest(request, context, response, token);
                }
            );
            
            context.subscriptions.push(chatParticipant);
            console.log('Chat participant registered successfully');
        }
    } catch (error) {
        console.error('Failed to register chat participant:', error);
    }
}

class DeploymentAssistantProvider {
    private outputChannel: vscode.OutputChannel;
    
    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Deployment Assistant');
    }

    async startDeployment() {
        this.log('Starting deployment automation...');
        try {
            await this.processCSVAnalysis();
            await this.processSQLCleansing();
            vscode.window.showInformationMessage('Deployment automation completed successfully!');
            this.log('Deployment automation completed!');
        } catch (error) {
            vscode.window.showErrorMessage(`Deployment automation failed: ${error}`);
            this.log(`Deployment automation failed: ${error}`);
        }
    }

    async handleRequest(
        request: any,
        context: any,
        response: any,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.log(`Received chat request: ${request.prompt}`);
        
        response.markdown('Deployment Assistant is ready. Use the command palette to start automation.');
        
        if (request.prompt.toLowerCase().includes('start deployment')) {
            response.markdown('Starting deployment automation...');
            this.startDeployment();
        }
    }

    private async processCSVAnalysis() {
        this.log('Processing CSV Analysis with Copilot...');
        
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        
        const workspacePath = workspaceFolder.uri.fsPath;
        
        // Read the CSV file from workspace
        const csvPath = path.join(workspacePath, 'Script_Metadata.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        
        // Read the instructions from markdown in workspace
        const instructionsPath = path.join(workspacePath, 'readcsvscript.md');
        const instructions = fs.readFileSync(instructionsPath, 'utf-8');
        
        // Get the shell script from Copilot
        const shellScript = await this.getCopilotResponse(
            `${instructions}\n\nCSV Content:\n${csvContent}`
        );
        
        // Save the generated shell script to workspace
        const scriptPath = path.join(workspacePath, 'gendb2ddl.sh');
        fs.writeFileSync(scriptPath, shellScript);
        
        // Make it executable (Unix/Linux/Mac)
        if (process.platform !== 'win32') {
            fs.chmodSync(scriptPath, 0o755);
        }
        
        // Execute the shell script
        await this.executeShellScript(workspacePath);
    }

    private async processSQLCleansing() {
        this.log('Processing SQL Cleansing with Copilot...');
        
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        
        const workspacePath = workspaceFolder.uri.fsPath;
        
        // Read the cleansing instructions from workspace
        const instructionsPath = path.join(workspacePath, 'cleansingscripts.md');
        const instructions = fs.readFileSync(instructionsPath, 'utf-8');
        
        const rawDir = path.join(workspacePath, 'rawddlscripts/');
        const outputDir = path.join(workspacePath, 'scriptedfiles/');
        
        if (!fs.existsSync(rawDir)) {
            throw new Error('Raw DDL scripts directory not found!');
        }
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const files = fs.readdirSync(rawDir);
        for (const file of files) {
            if (file.endsWith('.sql')) {
                this.log(`Cleansing file: ${file}`);
                const content = fs.readFileSync(path.join(rawDir, file), 'utf-8');
                
                // Get cleansed SQL from Copilot
                const cleansedContent = await this.getCopilotResponse(
                    `${instructions}\n\nSQL to cleanse:\n${content}`
                );
                
                fs.writeFileSync(path.join(outputDir, file), cleansedContent);
                this.log(`Cleansed file saved: ${file}`);
            }
        }
    }

    private async getCopilotResponse(prompt: string): Promise<string> {
        try {
            // Check if Language Model API is available
            if (!(vscode as any).lm) {
                throw new Error('Language Model API is not available');
            }
            
            const lm = (vscode as any).lm;
            const models = await lm.selectChatModels({
                vendor: 'copilot',
                family: 'chat'
            });
            
            if (models.length === 0) {
                throw new Error('No suitable Copilot models available');
            }
            
            // Use the first available model
            const model = models[0];
            
            // Create messages for the language model
            const messages = [
                (vscode as any).LanguageModelChatMessage.User(prompt)
            ];
            
            // Send request to the language model
            const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            
            let responseText = '';
            for await (const fragment of chatResponse.text) {
                responseText += fragment;
            }
            
            return responseText;
        } catch (error) {
            this.log(`Error getting Copilot response: ${error}`);
            throw new Error(`Failed to get response from Copilot: ${error}`);
        }
    }

    private async executeShellScript(workspacePath: string) {
        this.log('Executing shell script...');
        
        const scriptPath = path.join(workspacePath, 'gendb2ddl.sh');
        const commands = fs.readFileSync(scriptPath, 'utf-8').split('\n');
        
        for (const cmd of commands) {
            const trimmedCmd = cmd.trim();
            if (trimmedCmd && !trimmedCmd.startsWith('#')) {
                this.log(`Executing: ${trimmedCmd}`);
                
                // Execute command in the workspace directory
                await new Promise((resolve, reject) => {
                    child_process.exec(trimmedCmd, { cwd: workspacePath }, (error, stdout, stderr) => {
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

    private log(message: string) {
        this.outputChannel.appendLine(`${new Date().toISOString()}: ${message}`);
    }
}

export function deactivate() {}
