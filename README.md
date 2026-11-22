# StudentMate

StudentMate is a personal student dashboard for planning classes, tasks, notes, notices, and study progress in one place.

## Features

- Dashboard with daily class summary and upcoming tasks
- Notes management with search and subject filters
- Task tracking with completion and priority levels
- Class schedule planner by weekday
- Notice board with categories and important badges
- Progress reports for weekly and monthly task tracking
- Aria AI assistant for task creation and study guidance
- Local browser storage for personal data
- Installable app experience with PWA support

## Run locally

1. Open the project folder in a browser or serve it with a local static server.
2. Start the combined app and assistant server:

   python assistant.py

3. Open http://localhost:8000 in your browser.

## AI assistant

The assistant supports OpenAI-compatible model replies while keeping an offline fallback for task commands. To enable model replies on Windows PowerShell, set the API key only in the server terminal and start the combined server:

```powershell
$env:OPENAI_API_KEY = "your-api-key"
python assistant.py
```

Optional settings are `OPENAI_MODEL` (default: `gpt-4o-mini`) and `OPENAI_BASE_URL` for another OpenAI-compatible provider. Never put the API key in `index.js`, HTML, or frontend storage.

## Files

- index.html — app structure and UI layout
- index.js — app logic, local data handling, and assistant behavior
- style.css — app styling and responsive design
- manifest.json — installable app metadata
- sw.js — service worker for offline/PWA support

## Notes

- The assistant voice is set to a female default profile and no longer uses the previous assistant profile entry.
- The app stores user data in the browser's localStorage.

## Project scripts

```bash
npm install
npm run android:add
npm run android:sync
npm run android:open
```
