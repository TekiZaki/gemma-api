# Gemma API CLI

A powerful, terminal-based AI assistant built on top of the `@google/genai` SDK and the Bun runtime. This CLI application provides a rich, interactive REPL environment with deep system integration, web scraping capabilities, and real-time execution tools.

---

## 🚀 Features

* **Interactive REPL & Single-Shot Modes:** Engage in continuous conversations or pipe standard input directly into the AI for quick, single-shot tasks.
* **Rich Terminal UI:** Enjoy markdown rendering directly in your terminal, complete with auto-wrapping, syntax highlighting, and a custom Amber/Charcoal visual theme.
* **Advanced Tool Integrations:** * 🖥️ **Terminal Execution:** The AI can execute safe local CLI commands.
  * 🔍 **Web Search:** Built-in support for Google Search grounding, Firecrawl, and custom Bun search.
  * 🕸️ **Web Scraping:** Automatically fetches, strips, and parses full markdown content from URLs.
  * 📁 **File Reading:** Natively read and process local files.
* **Context & History Management:** Save, load, and clear conversation history directly from the prompt.
* **Dynamic Model Switching:** Easily toggle between supported models (e.g., `gemini-2.5-flash-lite`, `gemma-4-26b-a4b-it`) using an interactive terminal selector.

---

## 🛠️ Prerequisites

* **[Bun](https://bun.sh/)** (JavaScript runtime) installed on your system.
* A **Google Gemini API Key**.
* *(Optional)* A **Firecrawl API Key** for advanced web extraction tools.

---

## 📦 Installation & Setup

1. **Clone or Extract the Project:**
   Navigate to the project root directory.

2. **Install Dependencies:**

   ```bash
   bun install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your API keys:

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   FIRECRAWL_API_KEY=your_firecrawl_api_key_here  # Optional
   ```

---

## 💻 Usage

### 1. REPL Mode (Interactive)

Start the interactive chat environment by simply running the start script:

```bash
bun run start
```

### 2. Single-Shot Mode

Pass prompts directly via arguments for immediate execution and exit:

```bash
bun run start "Summarize the latest news regarding space exploration"
```

*Note: Add `--no-tools` or `--nt` to disable the AI's ability to trigger local tools.*

### 3. Piped Input

Pipe content from files or other terminal commands directly into the CLI:

```bash
cat server.log | bun run start "Find the fatal error in these logs and explain it"
```

---

## ⌨️ Available Commands

While in the REPL environment, you can use the following commands to control the session:

| Command | Description |
| :--- | :--- |
| `/help` or `?` | Show the help menu. |
| `/reset` or `!clear` | Clear the current conversation history. |
| `/model` or `!model` | Opens an interactive menu to switch the AI model. |
| `/model [name]` | Immediately switches to the specified model. |
| `/save` or `!save` | Saves the current conversation history to `history.json`. |
| `/load` or `!load` | Loads conversation history from `history.json`. |
| `!bun` | Forces the AI to utilize the `bun_search` tool. |
| `!firecrawl` | Forces the AI to utilize the `firecrawl_search` tool. |
| `!google` | Enables direct Google Search Grounding for the current prompt. |
| `exit`, `quit`, `\q` | Close the CLI application. |

---

## 🏗️ Project Structure

* **`src/index.ts`**: The main entry point handling CLI logic and the REPL loop.
* **`src/config.ts`**: Environment loading, model definitions, and system prompts.
* **`src/commands.ts`**: Handlers for user slash/bang commands.
* **`src/ai/engine.ts`**: The core AI execution loop, handling streams and token usage.
* **`src/ai/history.ts`**: Manages the conversation state and time-syncing.
* **`src/tools/`**: Definitions and executors for the AI's external capabilities (terminal, scraping, searching).
* **`src/ui/`**: Visual components, theming (`marked-terminal`), and interactive readline prompts.

---

## 🛡️ Security Note

This CLI features a `terminal_execute` tool. By default, the application will pause and ask for your explicit authorization `[y/N]` before executing any terminal commands proposed by the AI, ensuring your system remains secure.
