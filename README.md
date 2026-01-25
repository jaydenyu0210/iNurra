# HealthCompanion

A React Native mobile app that helps users understand their medical records, prescriptions, and health metrics through AI-powered analysis.

## Features

- 📱 **Phone OTP Authentication** - Secure login via phone number
- 📄 **Document Upload & Analysis** - Upload prescriptions, test results, doctor notes
- 💊 **Medication Tracking** - Automated schedule extraction and reminders
- 📊 **Health Metrics** - Visualize trends with interactive charts
- 📅 **Calendar Integration** - Track appointments, medications, and todos
- 🤖 **AI Chat Assistant** - Ask questions about your health data

## Tech Stack

- **Frontend**: React Native + Expo SDK 52
- **Navigation**: Expo Router (file-based)
- **UI**: React Native Paper (Material Design 3)
- **State**: Zustand + TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI**: Google ADK + Gemini (planned for Phase 1)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account

### Setup

1. **Clone and install dependencies**
   ```bash
   cd health-companion
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Set up Supabase database**
   - Create a new Supabase project
   - Run the migration script in `supabase/migrations/001_initial_schema.sql`
   - Enable Phone OTP auth in Supabase Dashboard → Authentication → Providers

4. **Run the app**
   ```bash
   npx expo start
   ```
   
   Press `i` for iOS simulator, `a` for Android emulator, or scan QR code with Expo Go.

## Project Structure

```
health-companion/
├── app/                      # Expo Router screens
│   ├── (auth)/              # Auth flow (welcome, phone, verify)
│   ├── (tabs)/              # Main tabs (home, calendar, health, profile)
│   ├── documents/           # Document upload and detail
│   ├── chat/                # AI chat interface
│   └── _layout.tsx          # Root layout with providers
├── src/
│   ├── components/          # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API and external services
│   ├── stores/              # Zustand state stores
│   ├── theme/               # Design tokens and theme config
│   └── types/               # TypeScript type definitions
├── supabase/
│   ├── migrations/          # Database schema
│   └── functions/           # Edge Functions (planned)
└── assets/                  # Images, fonts, etc.
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous API key |

## Development

### Scripts

```bash
npm start           # Start Expo dev server
npm run ios         # Run on iOS simulator
npm run android     # Run on Android emulator
npm run web         # Run in web browser
npm run lint        # Run ESLint
npm run typecheck   # Run TypeScript checks
```

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- React Native Paper for UI components
- File-based routing with Expo Router

## Roadmap

### Phase 0 (Complete) ✅
- [x] Project setup with Expo + TypeScript
- [x] Supabase integration
- [x] Auth flow (phone OTP)
- [x] Tab navigation
- [x] Core screens UI

### Phase 1 (In Progress)
- [ ] Document upload Edge Function
- [ ] Google Cloud Vision OCR integration
- [ ] Gemini classification
- [ ] Medication extraction
- [ ] AI chat with RAG

### Phase 2 (Planned)
- [ ] Push notifications
- [ ] Audio transcription
- [ ] Emergency contacts alerts
- [ ] Offline support
- [ ] App Store submission

## License

MIT

## Support

For questions or issues, please open a GitHub issue.
