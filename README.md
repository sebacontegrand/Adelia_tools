# HTMLAI / Adelia Tools

An advanced AI-powered platform designed for high-performance ad management, automated web scraping, and intelligent data analysis. Built with a modern tech stack centered around Next.js 16 and Google's Generative AI.

## 🚀 Key Capabilities

### 🤖 AI-Powered Intelligence
- **Gemini Integration**: Leverages Google's `gemini-1.5-pro` and `gemini-1.5-flash` for ad performance analysis, content generation, and intelligent insights.
- **Jina-Powered Extraction**: Uses Jina Reader API to convert web pages into clean Markdown for high-speed, low-cost ad metadata extraction without the need for screenshots.
- **Computer Vision**: Utilizes Google Cloud Vision for advanced image labeling, text extraction (OCR), and visual content analysis.
- **Design Recommendations**: AI-driven UI/UX improvement suggestions for ad creatives.

### 🌐 Scalable Web Scraping
- **Headless Automation**: High-performance scraping engine powered by Playwright and Puppeteer.
- **Job Queuing**: Robust background task management using BullMQ and Redis to handle large-scale scraping jobs reliably.
- **Proxy Support**: Configured for resilient web data extraction.

### 📊 Advanced Reporting & Dashboard
- **Dynamic Analytics**: Interactive data visualization using Recharts.
- **Multi-Format Exports**: Support for generating Excel reports (`xlsx`) and bundled downloads (`jszip`).
- **Real-time Status**: Live job tracking and performance metrics.

### ☁️ Enterprise Storage & Database
- **Hybrid Storage**: Unified storage interface supporting both local filesystem and Google Cloud Storage (GCS).
- **Relational Data**: Type-safe database operations via Prisma with PostgreSQL.
- **Image Processing**: High-speed image manipulation and optimization using Sharp.

---

## 🛠️ Tech Stack

### Frontend & Framework
- **Core**: [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)

### Backend & Infrastructure
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: PostgreSQL
- **Task Queue**: [BullMQ](https://docs.bullmq.io/) + [Redis](https://redis.io/)
- **Storage**: Google Cloud Storage

### AI & Automation
- **AI Models**: Google Generative AI (Gemini SDK)
- **Reader API**: [Jina Reader](https://jina.ai/reader/) (for clean text extraction)
- **Vision**: Google Cloud Vision API
- **Scraping**: [Playwright](https://playwright.dev/), [Puppeteer Core](https://pptr.dev/)

### Utilities
- **Form Management**: React Hook Form + Zod
- **Image Processing**: Sharp
- **Data Export**: XLSX, JSZip, File-Saver

---

## ⚙️ Getting Started

### Environment Setup
Create a `.env` file with the following keys:
```env
# AI Configuration
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
JINA_API_KEY=your_jina_key_here

# Google Cloud
GCS_BUCKET_NAME=your_bucket_name
GOOGLE_APPLICATION_CREDENTIALS=path_to_json

# Database & Cache
DATABASE_URL=postgresql://user:password@localhost:5432/db
REDIS_URL=redis://localhost:6379

# Storage Fallback
NODE_ENV=development
```

### Installation
```bash
npm install
npx prisma generate
```

### Running the App
```bash
npm run dev
```

---

## 📂 Project Structure
- `app/`: Next.js App Router routes (ads, dashboard, jobs, reports, review, scraping).
- `components/`: Shared UI components and layout elements.
- `lib/`: Core logic, storage utilities, and API wrappers.
- `prisma/`: Database schema and migrations.
- `scripts/`: Helper scripts for maintenance and deployment.
