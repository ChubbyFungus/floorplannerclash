# Gemini Code-along Guide: AI 3D Floor Plan Generator

This document provides a comprehensive guide for Gemini to understand and assist with the development of the AI 3D Floor Plan Generator project.

## Project Overview

This project is a web-based 3D floor plan generator that uses AI to help users design their space. Users can describe their requirements in natural language, and the application will generate a 3D floor plan. The application is built with React, TypeScript, and Three.js for the frontend, and it utilizes a local LLM server for processing natural language and generating design choices.

**Key Technologies:**

*   **Frontend:** React, TypeScript, Three.js, Tailwind CSS
*   **Build Tool:** Vite
*   **Testing:** Jest (unit tests), Playwright (end-to-end tests)
*   **AI/LLM:** A local LLM server is used for design chat and reasoning.

## Getting Started

### Prerequisites

*   Node.js (version 18.17.0 or higher)
*   npm (version 9.5.0 or higher)

### Running the Application

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start the LLM Server:**
    In a separate terminal, start the local LLM helper server. This server handles the AI-powered design chat.
    ```bash
    npm run llm:server
    ```

3.  **Start the Development Server:**
    In another terminal, run the Vite development server.
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

### Building for Production

To create a production build of the application, run:

```bash
npm run build
```

### Testing

The project has both unit and end-to-end tests.

*   **Unit Tests:**
    Run the Jest unit tests with:
    ```bash
    npm test
    ```
    or
    ```bash
    npm run unit
    ```

*   **End-to-End Tests:**
    Run the Playwright end-to-end tests with:
    ```bash
    npm run e2e
    ```

*   **Type Checking:**
    To check for TypeScript errors, run:
    ```bash
    npm run typecheck
    ```

## Project Structure

Here is an overview of the key directories and files in the project:

*   `App.tsx`: The main React component that orchestrates the entire application.
*   `components/`: Contains the React components used in the application.
    *   `Canvas3D.tsx`: The component responsible for rendering the 3D floor plan using Three.js.
    *   `ControlPanel.tsx`: The UI panel for user input and controls.
*   `services/`: Contains the services that interact with the backend and AI models.
    *   `floorplanBuilder.ts`: Builds the floor plan from a prompt.
    *   `imageService.ts`: Generates style images.
    *   `localLlmService.ts`: Manages the design chat with the local LLM.
*   `types.ts`: Contains the TypeScript type definitions used throughout the application.
*   `dev/`: Contains development-related scripts.
    *   `local-llm-server.ts`: The implementation of the local LLM server.
*   `tests/`: Contains the unit and integration tests.
*   `vite.config.ts`: The configuration file for the Vite build tool.
*   `jest.config.js`: The configuration file for Jest.
*   `state.json`: Contains the initial state of the application.

## Development Conventions

*   **Coding Style:** The project uses Prettier for code formatting. Please adhere to the existing coding style.
*   **State Management:** The main application state is managed in the `App.tsx` component.
*   **Components:** Components are organized in the `components` directory.
*   **Services:** Business logic and external API interactions are handled in the `services` directory.
*   **Types:** All types are defined in the `types.ts` file.
