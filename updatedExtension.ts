import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

// Define interfaces for the proposed API
interface ChatParticipant {
    (request: any, context: any, response: any, token: vscode.CancellationToken): Promise<void>;
}

interface LanguageModelChat {
    selectChatModels(options: any): Promise<any[]>;
}

interface ChatAPI {
    createChatParticipant(id: string, handler: ChatParticipant): any;
}

// Extend the vscode namespace to include the proposed APIs
declare module 'vscode' {
    export namespace chat {
        export function createChatParticipant(id: string, handler: ChatParticipant): any;
    }
    
    export namespace lm {
        export function selectChatModels(options: any): Promise<any[]>;
    }
}

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
        if ((vscode as any).chat && typeof (vscode as any).chat.createChatParticipant === 'function') {
            const chatAPI = (vscode as any).chat as ChatAPI;
            const chatParticipant = chatAPI.createChatParticipant(
                'deployment-assistant.chat',
                async (request: any, context: any, response: any, token: vscode.CancellationToken) => {
                    return provider.handleChatRequest(request, context, response, token);
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

    async handleChatRequest(
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
        this.log(`Reading CSV from: ${csvPath}`);
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        
        // Read the instructions from markdown in workspace
        const instructionsPath = path.join(workspacePath, 'readcsvscript.md');
        this.log(`Reading instructions from: ${instructionsPath}`);
        const instructions = fs.readFileSync(instructionsPath, 'utf-8');
        
        // Get the shell script from Copilot
        this.log('Requesting shell script from Copilot...');
        const shellScript = await this.getCopilotResponse(
            `${instructions}\n\nCSV Content:\n${csvContent}`
        );
        
        // Save the generated shell script to workspace
        const scriptPath = path.join(workspacePath, 'gendb2ddl.sh');
        this.log(`Saving shell script to: ${scriptPath}`);
        fs.writeFileSync(scriptPath, shellScript);
        
        // Make it executable (Unix/Linux/Mac)
        if (process.platform !== 'win32') {
            fs.chmodSync(scriptPath, 0o755);
        }
        
        // Execute the shell script
        this.log('Executing shell script...');
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
        this.log(`Reading cleansing instructions from: ${instructionsPath}`);
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
        this.log(`Found ${files.length} files in rawddlscripts directory`);
        
        for (const file of files) {
            if (file.endsWith('.sql')) {
                this.log(`Cleansing file: ${file}`);
                const content = fs.readFileSync(path.join(rawDir, file), 'utf-8');
                
                // Get cleansed SQL from Copilot
                this.log(`Requesting cleansing for file: ${file}`);
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
            this.log('Checking if Language Model API is available...');
            
            // Check if Language Model API is available
            if (!(vscode as any).lm) {
                this.log('Language Model API is not available');
                throw new Error('Language Model API is not available. Please ensure you have the latest VS Code version with Copilot support.');
            }
            
            const lm = (vscode as any).lm as LanguageModelChat;
            this.log('Language Model API is available');
            
            this.log('Selecting chat models...');
            
            // Try different model selection strategies based on VS Code documentation
            let models: any[] = [];
            let selectionStrategies = [
                { vendor: 'GitHub', name: 'copilot' },
                { vendor: 'GitHub', family: 'gpt-4o' },
                { vendor: 'GitHub', family: 'gpt-4o-mini' },
                { vendor: 'GitHub' },
                { vendor: 'copilot' },
                { family: 'gpt-4o' },
                { family: 'gpt-4o-mini' },
                {} // Try without any filters
            ];
            
            for (const strategy of selectionStrategies) {
                try {
                    this.log(`Trying model selection with: ${JSON.stringify(strategy)}`);
                    models = await lm.selectChatModels(strategy);
                    this.log(`Found ${models.length} models with strategy: ${JSON.stringify(strategy)}`);
                    
                    if (models.length > 0) {
                        this.log(`Models found: ${models.map(m => `${m.name} (${m.vendor})`).join(', ')}`);
                        break;
                    }
                } catch (err) {
                    this.log(`Error with strategy ${JSON.stringify(strategy)}: ${err}`);
                }
            }
            
            if (models.length === 0) {
                this.log('No language models available after trying all strategies');
                
                // Try to get all available models to debug what's available
                try {
                    const allModels = await lm.selectChatModels({});
                    this.log(`All available models: ${JSON.stringify(allModels.map(m => ({
                        name: m.name,
                        vendor: m.vendor,
                        family: m.family
                    })))}`);
                } catch (err) {
                    this.log(`Error getting all models: ${err}`);
                }
                
                throw new Error('No language models available. Please ensure you have GitHub Copilot enabled and configured.');
            }
            
            // Use the first available model
            const model = models[0];
            this.log(`Using model: ${model.name} from vendor: ${model.vendor}`);
            
            // Create messages for the language model using object format
            const messages = [
                { role: 'user', content: prompt }
            ];
            
            // Send request to the language model
            this.log('Sending request to language model...');
            const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            
            let responseText = '';
            for await (const fragment of chatResponse.text) {
                responseText += fragment;
            }
            
            this.log('Received response from language model');
            return responseText;
        } catch (error) {
            this.log(`Error getting Copilot response: ${error}`);
            
            // Type-safe error handling
            if (error && typeof error === 'object' && 'code' in error) {
                const errorCode = (error as { code: string }).code;
                switch (errorCode) {
                    case 'NoPermissions':
                        throw new Error('No permissions to use language models. Please grant consent for this extension to use GitHub Copilot.');
                    case 'NoModels':
                        throw new Error('No language models available. Please install and configure GitHub Copilot.');
                    case 'ResponseTooSlow':
                        throw new Error('The response from the language model was too slow. Please try again.');
                    default:
                        const errorMessage = (error as { message?: string }).message || 'Unknown error';
                        throw new Error(`Language model error: ${errorMessage}`);
                }
            }
            
            // Handle non-LanguageModelError cases
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get response from Copilot: ${errorMessage}`);
        }
    }

    private async executeShellScript(workspacePath: string) {
        this.log('Executing shell script...');
        
        const scriptPath = path.join(workspacePath, 'gendb2ddl.sh');
        const commands = fs.readFileSync(scriptPath, 'utf-8').split('\n');
        
        this.log(`Found ${commands.length} commands in shell script`);
        
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
