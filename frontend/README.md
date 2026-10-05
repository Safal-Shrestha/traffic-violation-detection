# Traffic AI

Frontend for the AI-Based Smart Traffic Rules Violation System.

The system extends traditional traffic monitoring beyond speed and license-plate identification with AI-assisted detection of violations such as traffic-light, stop-line, helmet, and other future traffic-rule violations

## Installation

Clone the repository

```text
git clone <repository-url>
cd traffic-ai-frontend
```

Install Dependencies

`npm install`

Run

`npm run dev`

## Initial Project Creation

Create the project
`npm create vite@latest traffic-ai-frontend -- --template react-ts`

Tailwind
`npm install tailwindcss @tailwindcss/vite`

Tailwind Configuration
Make changes to vite.config.ts and src/index.css
Add
`import tailwindcss from @tailwindcss/vite`
to vite.config.ts

Change everything in the index.css to
`@import "tailwindcss";`

Other libraries
`npm install react-router axios @tanstack/react-query recharts lucide-react react-hook-form zod @hookform/resolvers`
