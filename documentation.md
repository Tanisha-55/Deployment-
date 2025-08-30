Deployment Assistant Extension Documentation
Overview
The Deployment Assistant is a VS Code extension that provides Copilot-powered chat functionality for database deployment automation. It helps automate CSV analysis, SQL script generation, and SQL cleansing tasks.

Prerequisites
VS Code version 1.102.0 or higher

GitHub Copilot access

SSH access to remote server (ivapp1231650.devin3.ms.com)

Node.js and npm for development

Architecture
Diagram
Code
graph TD
    A[User Interaction] --> B[VS Code Extension]
    B --> C[Chat Interface]
    B --> D[Command Palette]
    C --> E[Chat Request Handler]
    D --> F[Start Deployment Command]
    E --> G[Copilot Integration]
    F --> G
    G --> H[CSV Analysis]
    G --> I[SQL Cleansing]
    H --> J[Shell Script Generation]
    J --> K[Remote Execution via SSH]
    I --> L[SQL File Processing]
Workflow
1. Activation
The extension activates when:

User executes the deployment-assistant.start command

User interacts with the chat participant deployment-assistant.chat

2. CSV Analysis Process
Reads Script_Metadata.csv from workspace

Reads instructions from readcsvscript.md

Requests shell script generation from Copilot

Saves generated script as gendb2ddl.sh

Makes script executable

Executes script on remote server via SSH

3. SQL Cleansing Process
Reads cleansing instructions from cleansingscripts.md

Processes all .sql files in rawddlscripts/ directory

Requests cleansing from Copilot for each file

Saves cleansed files to scriptedfiles/ directory

File Structure
text
workspace/
├── Script_Metadata.csv
├── readcsvscript.md
├── cleansingscripts.md
├── gendb2ddl.sh (generated)
├── rawddlscripts/
│   └── *.sql
└── scriptedfiles/
    └── *.sql (cleansed)
Configuration
package.json Highlights
Activation Events: Command and chat participant

Chat Providers: deployment-assistant with description

Capabilities: Supports untrusted workspaces and virtual workspaces

Dependencies: Includes SSH2, chat extension utilities, and VSODE APIs

Key Dependencies
json
{
  "dependencies": {
    "@types/vscode": "^1.102.0",
    "@vscode/chat-extension-utils": "^0.0.0-alpha.5",
    "ssh2": "^1.17.0"
  }
}
Usage
Through Command Palette
Open Command Palette (Ctrl+Shift+P)

Execute "Start Deployment Assistant Chat"

Extension will process CSV and SQL files automatically

Through Chat Interface
Open Chat view in VS Code

Select DeploymentAssistant participant

Type "start deployment" to begin automation

Error Handling
The extension includes comprehensive error handling for:

Missing workspace files

Language model API availability

SSH connection failures

Copilot response parsing

Development Setup
Install dependencies:

bash
npm install
Compile TypeScript:

bash
npm run compile
Run tests:

bash
npm test
Package extension:

bash
npm run vscode:prepublish
Security Considerations
Requires SSH credentials for remote execution

Processes sensitive database scripts

Uses Copilot for code generation (review generated code)

Limitations
Currently hardcoded for specific SSH server

Requires specific file structure in workspace

Dependent on Copilot availability and performance

Future Enhancements
Configurable SSH connections

Additional database support

Enhanced error recovery

Progress reporting UI

Customizable file paths

This extension provides an AI-powered automation workflow for database deployment tasks, integrating directly with VS Code's chat interface and leveraging GitHub Copilot for intelligent script generation and cleansing.
