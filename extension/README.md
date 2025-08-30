# Deployment Assistant Extension

A VS Code extension that automates deployment processes using GitHub Copilot to generate and execute shell scripts, cleanse SQL files, and manage database deployments.

## Features

- **CSV Analysis**: Processes CSV metadata to generate deployment scripts
- **SQL Cleansing**: Cleanses and augments SQL DDL files with DROP and GRANT statements
- **SSH Execution**: Executes generated scripts on remote servers via SSH
- **Copilot Integration**: Uses GitHub Copilot for intelligent script generation
- **Configurable**: All file paths, names, and settings are customizable

## Requirements

- VS Code 1.85.0 or higher
- GitHub Copilot subscription and enabled Language Model API
- SSH access to target deployment server

## Installation

1. Install the extension from VS Code Marketplace
2. Ensure GitHub Copilot is installed and configured
3. Set up SSH access to your deployment server

## Usage

### Basic Setup

1. Create a workspace with the following structure:
your-project/
├── Script_Metadata.csv
├── readcsvscript.md
├── cleansingscripts.md
├── rawddlscripts/
└── scriptedfiles/


2. Populate the files:
- `Script_Metadata.csv`: CSV file with script metadata
- `readcsvscript.md`: Instructions for processing CSV and generating shell scripts
- `cleansingscripts.md`: Instructions for SQL cleansing and augmentation
- `rawddlscripts/`: Directory containing raw SQL files

3. Open Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
4. Type "Start Deployment Automation"
5. Press Enter to begin the process

### Configuration

You can customize the extension behavior through VS Code settings:

1. Open VS Code Settings (Ctrl+, or Cmd+,)
2. Search for "Deployment Assistant"
3. Modify any of the available settings:

``` json
- `deploymentAssistant.sshCommand`: SSH command to connect to remote server
- `deploymentAssistant.scriptMetadataFileName`: CSV metadata filename
- `deploymentAssistant.readCsvInstructionsFileName`: CSV instructions filename
- `deploymentAssistant.cleansingInstructionsFileName`: SQL cleansing instructions filename
- `deploymentAssistant.rawDdlScriptsDirectory`: Raw DDL scripts directory
- `deploymentAssistant.scriptedFilesDirectory`: Processed scripts directory
- `deploymentAssistant.generatedScriptFileName`: Generated shell script filename
- `deploymentAssistant.batchSize`: Number of files to process simultaneously
```

### Workspace-Specific Configuration

For project-specific settings, create a `.vscode/settings.json` file in your workspace:

``` json
{
"deploymentAssistant.sshCommand": "ssh -K myuser@myserver.com",
"deploymentAssistant.scriptMetadataFileName": "My_Metadata.csv",
"deploymentAssistant.readCsvInstructionsFileName": "my_read_instructions.md",
"deploymentAssistant.cleansingInstructionsFileName": "my_cleansing_rules.md",
"deploymentAssistant.rawDdlScriptsDirectory": "my_raw_scripts",
"deploymentAssistant.scriptedFilesDirectory": "my_processed_scripts",
"deploymentAssistant.generatedScriptFileName": "my_deployment_script.sh",
"deploymentAssistant.batchSize": 10
}
```

File Format Examples:

1. readcsvscript.md
Instructions for processing the CSV file and generating a shell script.
The script should connect to the database and generate DDL statements.

2. cleansingscripts.md
Instructions for cleansing SQL files:
- Add DROP statements before CREATE statements
- Add GRANT statements after object creation
- Preserve all comments and logic
- Remove unnecessary SET commands and wrapper statements


Extension Settings:
This extension contributes the following settings:
deploymentAssistant.sshCommand: SSH command for remote execution
deploymentAssistant.scriptMetadataFileName: Script metadata CSV filename
deploymentAssistant.readCsvInstructionsFileName: CSV instructions filename
deploymentAssistant.cleansingInstructionsFileName: SQL cleansing instructions filename
deploymentAssistant.rawDdlScriptsDirectory: Raw DDL scripts directory name
deploymentAssistant.scriptedFilesDirectory: Processed scripts directory name
deploymentAssistant.generatedScriptFileName: Generated shell script filename
deploymentAssistant.batchSize: Batch size for file processing


Known Issues
Requires GitHub Copilot and Language Model API access
SSH connection issues may occur if not properly configured
Large numbers of files may require increased batch processing time


Release Notes
1.0.0
Initial release of Deployment Assistant extension featuring:
CSV analysis and script generation
SQL file cleansing and augmentation
SSH-based remote execution
Configurable settings for all aspects of the deployment process
