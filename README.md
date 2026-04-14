# gemma-api

gemma-api is a command-line AI assistant powered by Google's Generative AI models, built using Bun and TypeScript. It provides an intuitive terminal interface that supports interactive REPL sessions, single-shot queries, and piped standard input.

## Features

* **Multiple Models**: Supports models like `gemma-4-31b-it`, `gemini-3.1-flash-lite-preview`, and others, featuring an interactive model selector.
* **Tool Integration**: Capable of executing local terminal commands, advanced file management, and scraping web URLs for comprehensive context.
* **File Management Tools**: Specialized tools to `read_file` (up to 2MB), `list_files` (recursive), and `write_file` (supports overwrite, append, and smart patching).
* **Web Search**: Integrates with Google Search Grounding, Firecrawl, and a custom `bun-search` tool for real-time web data extraction.
* **Safety & Security**: Sensitive tools (`terminal_execute`, `write_file`, `create_tool`) require explicit user authorization before execution.
* **Persistent Modes**: Selected search modes (`!google`, `!bun`, `!firecrawl`) persist across follow-up questions in a session.
* **Session Management**: Clear your conversation history to reset context.
* **Token Optimization**: Automatically prunes and truncates old tool outputs and long text blocks to maximize context window efficiency.
* **Thinking Mode**: Supports advanced reasoning capabilities for supported Gemini and Gemma models.

## Prerequisites

* Bun installed on your system.
* A valid Google Gemini API Key.
* [Bun Search](https://github.com/TekiZaki/bun-search) installed globally to enable the default command-line search capabilities.
* (Optional) A Firecrawl API Key if you intend to use the deep web research tool.

## Installation

1. Clone the repository and navigate to the project directory.
2. Install dependencies using Bun:
   ```bash
   bun install
   ```
3. Link the package globally so you can run the tool from anywhere using the `gemma-api` command:
   ```bash
   bun link
   ```

## Configuration

Create a `.env` file in the root of your project directory to store your credentials:

```env
GEMINI_API_KEY=your_gemini_api_key_here
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

## Usage

### Interactive Mode (REPL)
Start the interactive chat interface by running the command without arguments:
```bash
gemma-api
```

### Single-Shot Mode
Pass your prompt directly as arguments to get an immediate response:
```bash
gemma-api "What is the current system date?"
```

### Piped Input
Pipe standard output from other commands or files directly into the assistant:
```bash
cat src/index.ts | gemma-api "Refactor this code to improve performance"
```

## Available Commands

When running in REPL mode, you can use the following commands to control the session:

* `/help` or `/`: Show the help menu.
* `/reset` or `!clear`: Clear the current conversation history and reset search modes.
* `/model` or `!model [model_name]`: Open the interactive model selector or directly change the AI model.
* `!bun`, `!firecrawl`, `!google`: Force the assistant to use a specific search engine. The choice **persists** for follow-up questions.
* `exit`, `quit`, `\q`: Exit the application.

## Search Engines

By default, the AI is instructed to utilize `bun_search` for factual web queries, which depends on [bun-search](https://github.com/TekiZaki/bun-search) being accessible in your environment. 

You can explicitly trigger specialized search modes by prepending a flag to your prompt:
- `!google`: Enables official Google Search Grounding.
- `!firecrawl`: Uses Firecrawl for deep web crawling and markdown extraction.
- `!bun`: Forces standard `bun-search` behavior.

**Stickiness**: Once a mode is selected, follow-up questions in the same session will continue using that mode until you explicitly switch or reset the session with `/reset`.
