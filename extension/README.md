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
