<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ryIyThJi0Xzabg9rLuu0zJzndkJBI3iX

## Run Locally

**Prerequisites:** Node.js, Ollama

1. Install Ollama from https://ollama.ai and pull a model that supports tool calling (e.g., `ollama pull llama3.1:8b`)
2. Install dependencies:
   `npm install`
3. Ensure Ollama is running (OLLAMA_BASE_URL is set in [.env.local](.env.local))
4. Run the app:
   `npm run dev`
