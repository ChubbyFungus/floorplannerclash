<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1d9hu1uvTo-qLK77wrCa-CBwWIa-Pyq_X

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the deterministic/local LLM helper (serves `http://localhost:3001/chat` and `http://localhost:3002/reason`). It defaults to offline mode so you don’t need Ollama running unless you set `LLM_DISABLED=false`:
   ```bash
   npm run llm:server
   ```
3. In another terminal, run the Vite dev server:
   ```bash
   npm run dev
   ```
