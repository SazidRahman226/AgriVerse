# AgriVerse

AgriVerse is a full-stack platform to help farmers and agricultural stakeholders monitor crops, detect diseases using ML, and manage requests and forums. The repository contains a Java backend (Spring Boot), a TypeScript + Vite frontend, and an AI/ML subproject for crop disease detection.

---

## Key Features

- Crop disease detection model and API for image-based diagnosis
- Web frontend (Vite + React + TypeScript) with user authentication and forum
- Java backend (Spring Boot) providing REST APIs and persistence
- Uploads storage for images and documents

---

## Repository Layout

- `backend/` — Java backend (Maven, Spring Boot). Includes `mvnw` for cross-platform runs.
- `frontend/` — Vite + React + TypeScript web app (UI components, pages, API clients).
- `ai/` — AI/ML experiments and services. See `ai/Crop_Disease_Detection_Part` for the crop-disease detector service and model artifacts.
- `uploads/` — Storage for user-uploaded files (images, docs).

---

## Quick Start

Prerequisites:

- Java 21 (or the version required by the backend)
- Node.js 22 and npm (or pnpm/yarn)
- Python 3.8+ for the ML service (if you plan to run it locally)

1) Backend (development)

On Windows (from repository root):

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Or build then run the JAR:

```powershell
cd backend
.\mvnw.cmd package
java -jar target\*.jar
```

Configuration: application properties live under `backend/src/main/resources/application.properties` and the packaged copy under `target/classes/application.properties`.

2) Frontend (development)

From repository root:

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite (usually http://localhost:5173).

3) AI / ML Service (crop disease detector)

The ML service is in `ai/Crop_Disease_Detection_Part/backend` and exposes a simple Flask/fastAPI app (`app.py`). Typical steps:

```bash
cd ai/Crop_Disease_Detection_Part/backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# Unix
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The model artifacts (if present) are in `ai/Crop_Disease_Detection_Part/backend/models_out` — ensure paths in `app.py` match the model locations.

4) File uploads

Use the `uploads/` directory for storing images and other uploaded content. Ensure the backend is configured to read/write that path and that the folder has appropriate permissions.

---

## Environment & Secrets

The backend may rely on environment variables or configuration in `application.properties` for database URLs, JWT secrets, and other credentials. Before running in production, set the appropriate env vars or update the properties file securely.

---

## Development Tips

- Backend: explore REST controllers under `backend/src/main/java` to see available endpoints.
- Frontend: API clients live in `frontend/src/api` (e.g., `ml.ts`, `requests.ts`).
- ML: adjust model paths and preprocessing steps in `ai/Crop_Disease_Detection_Part/backend/leaf_filter.py` and `app.py` if you retrain or move model files.

---

## Contributing

1. Fork the repo and create a branch for your change.
2. Run backend and frontend locally to reproduce issues or test features.
3. Open a pull request with a clear description and testing steps.

---

## License

This project currently does not include a license file. Add a `LICENSE` file (for example, MIT) if you want to open-source this project.

---

## Contact

Questions or help? Open an issue in this repository or contact the maintainers.
