# TaskFlow - Intelligent Task & Inventory Planner
A modern, offline-first task management application built with React 19 and Vite, featuring AI-powered scheduling and robust inventory logic.

🚀 Key Features
Offline-First Persistence: Leverages LocalStorage for seamless use without an active internet connection.

AI Task Assistant: Integrated with Google Gemini 1.5 Flash for smart scheduling and productivity insights.

Dynamic Inventory Logic: Custom algorithms for task urgency scoring and category-based organization.

Analytics Dashboard: Real-time visualization of productivity trends and completion rates.

Mobile-First UI: Fully responsive design optimized for touch interfaces.

🛠 Tech Stack
Frontend: React 19, Tailwind CSS

Build Tool: Vite 8

AI Engine: Google Gemini SDK (v1)

Deployment: Vercel + Vercel Analytics

📂 Project Structure
The project follows a modular architecture to ensure separation of concerns:

```plaintext
taskflow/
├── doc/                 # Technical documentation and audit logs
├── src/
│   ├── lib/
│   │   └── gemini.js    # Gemini AI configuration and safety guards
│   ├── models.js        # Business logic: Task classes and scoring algorithms
│   ├── styles.js        # Global UI/UX styling and CSS-in-JS
│   ├── App.jsx          # Core application state and routing
│   └── main.jsx         # Entry point
├── .env.example         # Template for environment variables
└── .gitignore           # Security rules for sensitive files
```

⚙️ Getting Started
1. Prerequisites
Node.js 18+

A Google AI Studio API Key (for Gemini features)

2. Installation & Setup
```bash
# Clone the repository
git clone [your-repo-url]

# Install dependencies
npm install

# Setup Environment Variables
cp .env.example .env
# Edit .env and add your VITE_GEMINI_API_KEY
```

3. Run Locally
```bash
npm run dev
```

🛡 Security & Best Practices
Environment Protection: All API keys are managed via .env files and are strictly excluded from version control.

Modular Design: Separated business logic from UI components to improve testability and maintainability.

Error Boundaries: Implemented graceful fallbacks for AI services to ensure core functionality remains available during network outages.
