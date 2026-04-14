# gemma-api

gemma-api is a command-line AI assistant powered by Google's Generative AI models, built using Bun and TypeScript. It provides an intuitive terminal interface that supports interactive REPL sessions, single-shot queries, and piped standard input.

## Features

* **Multiple Models**: Supports models like `gemma-4-31b-it`, `gemini-2.5-flash-lite`, and others, featuring an interactive model selector.
* **Tool Integration**: Capable of executing local terminal commands, reading local files, and scraping web URLs for comprehensive context.
* **Web Search**: Integrates with Google Search Grounding, Firecrawl, and a custom `bun-search` tool for real-time web data extraction.
* **Session Management**: Save, load, and clear your conversation history to maintain context across sessions.
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
* `/reset` or `!clear`: Clear the current conversation history.
* `/model` or `!model [model_name]`: Open the interactive model selector or directly change the AI model.
* `/save` or `!save`: Save the conversation history to `history.json`.
* `/load` or `!load`: Load previous conversation history from `history.json`.
* `!bun`, `!firecrawl`, `!google`: Force the assistant to use a specific search engine for the prompt.
* `exit`, `quit`, `\q`: Exit the application.

## Search Engines

By default, the AI is instructed to utilize `bun_search` for factual web queries, which depends on [bun-search](https://github.com/TekiZaki/bun-search) being accessible in your environment. You can also explicitly trigger Google Search Grounding by prepending `!google` to your prompt, or Firecrawl for markdown-based deep crawling by prepending `!firecrawl`.
