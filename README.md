<p align="center">
  <img src="https://img.shields.io/badge/AgriVerse-🌿-2ea44f?style=for-the-badge&labelColor=1a1a2e" alt="AgriVerse" />
</p>

<h1 align="center">🌾 AgriVerse</h1>

<p align="center">
  <strong>Cultivating Tomorrow's Agriculture — An AI-Powered Platform for Farmers</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Spring_Boot-4.0-6DB33F?style=flat-square&logo=spring-boot&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/TensorFlow-2.16-FF6F00?style=flat-square&logo=tensorflow&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Capacitor-Android-3880FF?style=flat-square&logo=capacitor&logoColor=white" />
</p>

---

## 📖 Overview

**AgriVerse** is a full-stack agricultural management platform that empowers farmers with AI-driven crop disease detection, connects them with government agricultural officers via interactive maps, and fosters knowledge sharing through community forums and a ticket-based request system.

The platform is built as a multi-tier architecture with three distinct services:

| Service | Stack | Status | Purpose |
|---------|-------|--------|---------|
| **Backend API** | Spring Boot 4 · Java 21 · PostgreSQL | ✅ Active | Core REST API, auth, data management |
| **Frontend** | React · Vite · TypeScript · TailwindCSS · shadcn/ui | ✅ Active | Web & Android app (via Capacitor) |
| **ML Service (Deep Learning)** | Python · Flask · TensorFlow · MobileNetV2 | ✅ Active | Crop disease detection (multi-crop) |
| **ML Service (Traditional)** | Python · FastAPI · scikit-learn · HOG | 📦 Legacy | Original 4-crop disease detection |

---

## ✨ Features

### 🔬 AI-Powered Crop Disease Detection

AgriVerse's disease detection system went through two iterations:

> **🧪 V1 — Traditional ML (Legacy):** The initial approach used handcrafted features (HOG descriptors + HSV color histograms) with classical ML classifiers (SVM, Random Forest). This was limited to **4 specific crops** — Rice, Jute, Potato, and Tomato — each requiring a separately trained model. *The code is preserved in `ML/` but is no longer actively used.*
>
> **🚀 V2 — Deep Learning (Current):** The system was rebuilt using **MobileNetV2** as a feature extractor with a scikit-learn classifier head. This approach generalizes across **many crop types** without needing separate per-crop models, delivering significantly better accuracy and scalability.

**Current capabilities (V2):**
- Upload a photo of a crop leaf and get instant disease diagnosis
- **MobileNetV2** deep feature extraction → classifier pipeline
- Smart **leaf validation** — OpenCV-based green region detection + contour analysis automatically rejects non-leaf images
- Optional **ML leaf gate** for additional validation
- Top-5 predictions with confidence scores
- AI-generated treatment advice (Bengali language support via n8n integration)

### 🗺️ Interactive Government Officer Map
- **Leaflet-powered** interactive map showing nearby agricultural officers
- Geolocation-based distance sorting (Haversine formula)
- Search & filter officers by name or email
- One-click **Google Maps directions** to any officer
- Deep linking support — share direct links to specific officers
- Responsive floating sidebar with detail view

### 💬 Community Forum
- Topic-based discussion boards for agricultural knowledge sharing
- Create posts, comment, and engage with the farming community
- View recent forum activity from your dashboard
- Pre-seeded topics for common agricultural categories

### 📋 Request & Ticket System
- Farmers can submit requests/issues to government officers
- Real-time **chat interface** for request conversations
- Request forwarding between officers
- Status tracking (Open → In Progress → Resolved)

### 🔐 Authentication & Authorization
- **JWT-based** authentication with Spring Security
- Role-based access control: **Admin**, **Farmer**, **Government Officer**
- **Email verification** flow with resend capability
- Protected routes with role-specific dashboards

### 👤 User Management
- User profile with editable information
- **Location tracking** — users can set/update their GPS coordinates
- Admin panel for user management and system oversight
- Government Officer dashboard with specialized tools

---

## 🏗️ Architecture

```
AgriVerse/
├── backend/                    # Spring Boot 4 REST API
│   └── src/main/java/com/example/agriverse/
│       ├── config/             # Security, CORS, role seeding
│       ├── controller/         # REST endpoints (incl. MlWorkflowController)
│       ├── dto/                # Request/response DTOs
│       ├── model/              # JPA entities
│       ├── repository/         # Spring Data JPA repos
│       └── service/            # Business logic + JWT
│
├── frontend/                   # React + Vite + TypeScript
│   └── src/
│       ├── api/                # Axios API clients
│       ├── components/         # Reusable UI (shadcn/ui + custom)
│       ├── context/            # Auth & Theme providers
│       ├── hooks/              # Custom hooks (geolocation, toast)
│       ├── pages/              # Page components
│       │   ├── forum/          # Forum topic/post pages
│       │   ├── ml/             # Disease detection page
│       │   └── requests/       # Request/ticket pages
│       └── routes/             # Protected & admin route guards
│
├── deep_learn_part/            # ✅ ACTIVE — Deep Learning ML service
│   ├── backend/                # Flask API + TensorFlow models
│   │   ├── app.py              # Flask server (port 5000)
│   │   ├── leaf_filter.py      # OpenCV leaf detection & cropping
│   │   └── models/             # Pre-trained model files
            ├── leaf_detector.keras
│   │       ├── plant_disease_classifier.pkl
│   │       ├── mobilenetv2_feature_extractor.keras
│   │       └── leaf_gate.pkl   # (optional) ML leaf gate
│   └── frontend/               # Standalone HTML/CSS/JS demo UI
│
└── ML/                         # 📦 LEGACY — Traditional ML pipeline
    └── Crop_Disease_Detection_Part/
        ├── backend/
        │   ├── app.py           # FastAPI server (not actively used)
        │   ├── embeddings.py    # Feature extraction (HOG + color)
        │   ├── finetune.py      # Model training scripts
        │   ├── cross_validate.py
        │   ├── evaluate.py
        │   ├── leaf_filter.py   # Leaf validation
        │   └── models_out/      # Trained models (.pkl)
        │       ├── rice_model.pkl
        │       ├── jute_model.pkl
        │       ├── potato_model.pkl
        │       └── tomato_model.pkl
        └── frontend/            # Standalone demo UI
```

---

## 🛠️ Tech Stack

### Backend (Java)
| Technology | Version | Purpose |
|---|---|---|
| Spring Boot | 4.0.0 | Application framework |
| Spring Security | — | Authentication & authorization |
| Spring Data JPA | — | Database ORM |
| PostgreSQL | 15+ | Relational database |
| JJWT | 0.11.5 | JWT token handling |
| SpringDoc OpenAPI | 2.1.0 | API documentation (Swagger UI) |
| Lombok | — | Boilerplate reduction |
| Java | 21 | Runtime |

### Frontend (TypeScript)
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3 | UI framework |
| Vite | 7.3 | Build tool & dev server |
| TypeScript | 5.8 | Type safety |
| TailwindCSS | 3.4 | Utility-first CSS |
| shadcn/ui (Radix) | — | Component library |
| React Router | 6.30 | Client-side routing |
| TanStack Query | 5.83 | Server state management |
| Axios | 1.13 | HTTP client |
| Leaflet + React Leaflet | 1.9 / 4.2 | Interactive maps |
| Recharts | 2.15 | Data visualization |
| Capacitor | 8.0 | Native Android wrapper |
| Zod + React Hook Form | — | Form validation |
| Sonner | 1.7 | Toast notifications |

### ML Service — Deep Learning (Active)
| Technology | Version | Purpose |
|---|---|---|
| Flask | 3.0.3 | REST API server |
| TensorFlow | 2.16.2 | MobileNetV2 feature extraction |
| scikit-learn | 1.8.0 | Classifier head (on extracted features) |
| OpenCV | < 4.12 | Image processing & leaf validation |
| Pillow | 10.4.0 | Image handling |
| joblib | 1.4.2 | Model serialization |

### ML Service — Traditional (Legacy)
| Technology | Purpose |
|---|---|
| FastAPI | REST API server |
| scikit-learn | SVM / Random Forest classifiers |
| scikit-image | HOG feature extraction |
| OpenCV | Color histograms & leaf filtering |

---

## 🚀 Getting Started

### Prerequisites

- **Java 21** (JDK)
- **Node.js 18+** and npm (or Bun)
- **Python 3.10+** with pip
- **PostgreSQL 15+**
- **Maven** (included via wrapper: `mvnw`)

### 1. Database Setup

```sql
-- Connect to PostgreSQL and create the database
CREATE DATABASE agriverse_db;
CREATE USER agriverse_sazid WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE agriverse_db TO agriverse_sazid;
```

### 2. Backend (Spring Boot)

```bash
cd backend

# Configure database credentials in:
#   src/main/resources/application.properties

# Build & run
./mvnw spring-boot:run
```

The backend starts on **http://localhost:8080**. Swagger UI is available at `/swagger-ui.html`.

> **Environment Variables to configure:**
> - `spring.datasource.url` — PostgreSQL connection URL
> - `spring.datasource.username` / `password` — DB credentials
> - `jwt.secret` — Secret key for JWT signing

### 3. Frontend (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend starts on **http://localhost:5173**.

#### Android Build (Capacitor)

```bash
npm run build
npx cap sync android
npx cap open android
```

### 4. ML Service (Deep Learning — Active)

This is the **currently active** disease detection service used by the main app.

```bash
cd deep_learn_part/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the Flask server
python app.py
```

The ML service starts on **http://localhost:5000**.

#### Health Check
```bash
curl http://localhost:5000/health
```

> **Note:** You need the pre-trained model files in `deep_learn_part/backend/models/` — specifically `plant_disease_classifier.pkl` and `mobilenetv2_feature_extractor.keras`. These are not included in the repo due to size; contact the team or retrain using the training notebooks.

### 5. ML Service (Traditional — Legacy, Optional)

> ⚠️ **This service is no longer actively used.** It was the original approach before the deep learning migration. The code is preserved for reference and development history.

```bash
cd ML/Crop_Disease_Detection_Part/backend

# Install dependencies
pip install fastapi uvicorn scikit-learn scikit-image opencv-python-headless joblib numpy

# Run the FastAPI server (port 5000)
python app.py
```

---

## 📡 API Endpoints

### Backend (Spring Boot)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/signup` | ❌ | Register new user |
| `POST` | `/api/auth/signin` | ❌ | Login & get JWT |
| `GET` | `/api/auth/verify-email` | ❌ | Verify email token |
| `GET` | `/api/users/me` | ✅ | Get current user info |
| `PUT` | `/api/users/location` | ✅ | Update user location |
| `GET` | `/api/map/officers` | ✅ | Get all govt officers with locations |
| `GET` | `/api/forum/topics` | ✅ | List forum topics |
| `POST` | `/api/forum/topics/{id}/posts` | ✅ | Create a forum post |
| `GET` | `/api/forum/posts/{id}` | ✅ | Get post with comments |
| `POST` | `/api/requests` | ✅ | Create a new request |
| `GET` | `/api/requests` | ✅ | List user's requests |
| `POST` | `/api/ml/predict-and-create` | ✅ | Run ML prediction |
| `GET` | `/api/admin/**` | 🔒 | Admin-only endpoints |

### ML Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service status & loaded models |
| `POST` | `/predict` | Upload image → get disease prediction |

---

## 🌱 Disease Detection: Evolution & Current State

### Current System (Deep Learning — `deep_learn_part/`)

The active system uses a **MobileNetV2** backbone for feature extraction paired with a scikit-learn classifier. This single, unified model can detect diseases across **many crop species** without needing separate per-crop models.

| Component | Details |
|---|---|
| Feature Extractor | MobileNetV2 (pre-trained on ImageNet) |
| Classifier | scikit-learn (trained on extracted features) |
| Leaf Validation | OpenCV green-region detection + contour analysis |
| Input | Any crop leaf photo (auto-validated) |
| Output | Disease name, confidence %, top-5 predictions |

### Legacy System (Traditional ML — `ML/`)

The original system used handcrafted features and required a **separate model per crop**:

| Crop | Model File | Approach |
|------|-----------|----------|
| 🌾 Rice | `rice_model.pkl` | HOG + color histograms → SVM/RF |
| 🥔 Potato | `potato_model.pkl` | HOG + color histograms → SVM/RF |
| 🍅 Tomato | `tomato_model.pkl` | HOG + color histograms → SVM/RF |
| 🌿 Jute | `jute_model.pkl` | HOG + color histograms → SVM/RF |

> This approach was limited by the need to train and maintain individual models per crop and could only classify diseases within those 4 crops. The deep learning approach solved both limitations.

### Why We Migrated

| | Traditional ML (V1) | Deep Learning (V2) |
|---|---|---|
| **Crops supported** | 4 (fixed) | Many (extensible) |
| **Models needed** | 1 per crop | 1 unified model |
| **Feature engineering** | Manual (HOG + color) | Automatic (MobileNetV2) |
| **Accuracy** | Good for trained crops | Better generalization |
| **Scalability** | Low — retrain per crop | High — single model |

---

## 🔑 User Roles

| Role | Access |
|------|--------|
| **Farmer** | Dashboard, forum, disease detection, map, requests |
| **Govt Officer** | All farmer features + officer dashboard, request management |
| **Admin** | Full access + admin panel, user management, system config |

---


---

## 📄 License

This project is for educational and development purposes.
