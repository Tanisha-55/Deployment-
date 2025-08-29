import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    const provider = new DeploymentAssistantProvider(context);
    
    context.subscriptions.push(
        vscode.commands.registerCommand('deployment-assistant.start', () => {
            provider.startDeployment();
        })
    );
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

    private async processCSVAnalysis() {
        this.log('Processing CSV Analysis with Copilot...');
        
        // Read the CSV file
        const csvContent = fs.readFileSync('Script_Metadata.csv', 'utf-8');
        
        // Read the instructions from markdown
        const instructions = fs.readFileSync('readcsvscript.md', 'utf-8');
        
        // Get the shell script from Copilot
        const shellScript = await this.getCopilotResponse(
            `${instructions}\n\nCSV Content:\n${csvContent}`
        );
        
        // Save the generated shell script
        fs.writeFileSync('gendb2ddl.sh', shellScript);
        
        // Make it executable (Unix/Linux/Mac)
        if (process.platform !== 'win32') {
            fs.chmodSync('gendb2ddl.sh', 0o755);
        }
        
        // Execute the shell script
        await this.executeShellScript();
    }

    private async processSQLCleansing() {
        this.log('Processing SQL Cleansing with Copilot...');
        
        // Read the cleansing instructions
        const instructions = fs.readFileSync('cleansingscripts.md', 'utf-8');
        
        const rawDir = 'rawddlscripts/';
        const outputDir = 'scriptedfiles/';
        
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

    private async executeShellScript() {
        this.log('Executing shell script...');
        const commands = fs.readFileSync('gendb2ddl.sh', 'utf-8').split('\n');
        
        for (const cmd of commands) {
            const trimmedCmd = cmd.trim();
            if (trimmedCmd && !trimmedCmd.startsWith('#')) {
                this.log(`Executing: ${trimmedCmd}`);
                await new Promise((resolve, reject) => {
                    child_process.exec(trimmedCmd, (error, stdout, stderr) => {
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
