<div align="center">

<img src="web/logo.png" alt="Jestally Logo" width="120" />

# 🤝 Jestally

### India's First Bidirectional AI-Powered Indian Sign Language Bridge

**Speak to Signs. Signs to Speech. Everywhere on the Web.**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-dl1agc4y4ofy6.cloudfront.net-a78bfa?style=for-the-badge)](https://dl1agc4y4ofy6.cloudfront.net)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Shada0%2Fjestally-181717?style=for-the-badge&logo=github)](https://github.com/Shada0/jestally)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](#-chrome-extension-installation)
[![AWS](https://img.shields.io/badge/AWS-SageMaker_+_Lambda-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](#-ai--cloud-architecture)

---

*Jestally bridges the communication gap between the Deaf/HoH community and the rest of the world — directly inside your browser, on any website, in real time.*

</div>

---

## 🎯 What Is Jestally?

Jestally is a **bidirectional Indian Sign Language (ISL) communication platform** built as a Chrome Extension and Web App. It works on **every website simultaneously** — no app switching, no uploads, no friction.

- **ISL Out** — Type or speak in any of 10 Indian languages → Jestally applies ISL grammar rules, translates, and plays the correct sign GIF/video in a floating panel.
- **ISL In** — Show a hand sign to your webcam → MediaPipe detects your landmarks → a custom LSTM model on AWS SageMaker classifies the gesture → the result is spoken aloud in your chosen language.

This is **India's first open, bidirectional, AI-powered ISL browser extension** — no app install, no sign-in, just open a page and communicate.

---

## 🎬 Demo

> **[▶ Try the live web app →](https://dl1agc4y4ofy6.cloudfront.net)**

| ISL Output (Text/Speech → Sign) | ISL Input (Sign → Speech) |
|---|---|
| ![ISL Out Demo](docs/isl-out-demo.gif) | ![ISL In Demo](docs/isl-in-demo.gif) |

*The floating Jestally panel works on every website — Wikipedia, Google, Gmail, anywhere.*

---

## ✨ Features

### 🔁 Bidirectional Communication
- **Text/Speech → ISL Signs** with animated GIF/MP4 output
- **Webcam Signs → Spoken Text** via real-time AI inference

### 🧠 AI & Machine Learning
- Custom **LSTM sequence model** trained on 30-frame hand landmark sequences
- **142 ISL classes** covering common words, alphabets, and phrases
- Deployed on **AWS SageMaker** (ml.c5.large) with millisecond inference
- **MediaPipe Hands** for real-time 21-point 3D landmark extraction at 30fps
- Confidence thresholding (≥55%) to suppress false positives
- Frame buffering with augmentation for robust sequence classification

### 🏛️ ISL Grammar Engine
- Built-in **ISL grammar transformer** — English follows Subject-Verb-Object; ISL follows Topic-Comment with time expressions first
- Automatically reorders tokens: `[TIME] → [SUBJECT] → [OBJECT] → [NEGATION] → [WH-WORD]`
- Drops grammatically-silent words (articles, copulas, auxiliary verbs)
- Sign alias dictionary maps common phrases (`"thank you"`, `"bye"`) to canonical ISL signs

### 🌐 Multilingual
- **10 Indian languages** — Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Bengali, Punjabi, English
- Auto-translation via MyMemory API with strict validation (rejects gibberish, error strings, oversized responses)
- TTS output in native language using Web Speech API with regional voice selection
- Retry logic with fallback to English — never speaks garbage

### 🔌 Chrome Extension (MV3)
- Works on **every website** as a floating, draggable, resizable panel
- Three panel sizes (S/M/L), minimisable, toggle on/off
- GIF/MP4 sign player with progress dots and loop control
- Text input + Speech recognition (where browser permits)
- Zero-config: API keys baked in, works immediately on install

### ☁️ Serverless Cloud Backend
- **AWS API Gateway + Lambda** for sign lookup (`/resolve`) and gesture recognition (`/recognize`)
- **AWS SageMaker** endpoint for LSTM inference
- **S3 + CloudFront** for ISL sign GIF/MP4 asset delivery
- Training pipeline: CSV landmarks → augmented 30-frame sequences → SageMaker training job

---

## 🏗️ AI & Cloud Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    JESTALLY SYSTEM                      │
│                                                         │
│  ┌──────────────┐        ┌──────────────────────────┐  │
│  │  Chrome      │        │     Web App              │  │
│  │  Extension   │        │  dl1agc4y4ofy6.cloudfront.net    │  │
│  │  (MV3)       │        │                          │  │
│  └──────┬───────┘        └────────────┬─────────────┘  │
│         │                             │                 │
│         └──────────┬──────────────────┘                 │
│                    │ HTTPS + API Key                    │
│         ┌──────────▼──────────────────────┐            │
│         │      AWS API Gateway            │            │
│         │   /resolve      /recognize      │            │
│         └──────┬────────────────┬─────────┘            │
│                │                │                       │
│    ┌───────────▼──┐   ┌─────────▼──────────┐          │
│    │  Lambda      │   │  Lambda             │          │
│    │  resolve     │   │  recognize_v3       │          │
│    │  (sign       │   │  (sequence →        │          │
│    │   lookup +   │   │   SageMaker)        │          │
│    │   S3 GIF     │   └─────────┬───────────┘          │
│    │   URLs)      │             │                       │
│    └───────┬──────┘   ┌─────────▼──────────┐          │
│            │          │  SageMaker          │          │
│    ┌───────▼──────┐   │  Endpoint           │          │
│    │  S3 +        │   │  (LSTM Model)       │          │
│    │  CloudFront  │   │  ml.c5.large        │          │
│    │  (GIF/MP4    │   │  142 ISL classes    │          │
│    │   assets)    │   └─────────────────────┘          │
│    └──────────────┘                                     │
└─────────────────────────────────────────────────────────┘

CLIENT SIDE (Extension / Browser)
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Webcam → MediaPipe Hands → 21 × 3D landmarks          │
│       → Frame buffer (30 frames)                        │
│       → Normalize relative to wrist                     │
│       → 63-feature vector × 30 frames                   │
│       → POST /recognize → SageMaker LSTM                │
│       → Predicted sign + confidence                     │
│       → Web Speech API (TTS in selected language)       │
│                                                         │
│  Text/Speech → ISL Grammar Engine                       │
│       → Translate to English (MyMemory API)             │
│       → Tokenize + reorder (ISL grammar rules)          │
│       → POST /resolve → Lambda → S3 GIF URLs            │
│       → GIF/MP4 player in floating panel                │
└─────────────────────────────────────────────────────────┘
```

### Model Details

| Property | Value |
|---|---|
| Architecture | LSTM (sequence classifier) |
| Input | 30 frames × 63 features (21 landmarks × xyz, wrist-normalized) |
| Output | 142 ISL class probabilities |
| Training data | 15,200 rows × 64 cols, 100–200 samples/class |
| Confidence threshold | 55% |
| Inference latency | ~200ms (SageMaker warm) |
| Hosting | AWS SageMaker `ml.c5.large` |
| Serving | AWS Lambda → API Gateway |

---

## 📁 Project Structure

```
jestally/
├── extension/                  # Chrome MV3 Extension
│   ├── manifest.json           # Extension manifest
│   ├── background.js           # Service worker (offscreen mgmt)
│   ├── content.js              # Injected panel + ISL pipeline
│   ├── offscreen.html/.js      # MediaPipe camera (CSP-isolated)
│   ├── panel.css               # Floating panel styles
│   ├── popup.html/.js          # Extension popup
│   ├── hands.js                # MediaPipe Hands (local bundle)
│   ├── hands_solution_*.js     # MediaPipe WASM support
│   ├── hands_solution_*.wasm   # WebAssembly binaries
│   ├── hand_landmark_*.tflite  # TFLite hand models
│   └── icons/                  # Extension icons
│
├── web/                        # Web App (AWS CloudFront)
│   ├── index.html              # Main app (ISL Out + ISL In)
│   ├── cam-ext.html            # Camera page
│   └── logo.png
│
├── lambda/
│   ├── recognize_v3.py         # Recognize Lambda handler
│   └── resolve.py              # Sign lookup Lambda handler
│
├── training/
│   ├── isl_landmarks.csv       # Raw landmark training data
│   ├── csv_to_sequences.py     # CSV → 30-frame sequences
│   └── train.py                # SageMaker training script
│
└── README.md
```

---

## 🚀 Installation

### Web App

The web app is live at **[dl1agc4y4ofy6.cloudfront.net](https://dl1agc4y4ofy6.cloudfront.net)** — no install needed.

To run locally:

```bash
git clone https://github.com/Shada0/jestally.git
cd jestally/web
# Just open index.html in Chrome — no build step required
open index.html
```

---

### 🔌 Chrome Extension Installation

> The extension is not yet on the Chrome Web Store. Install it manually in Developer Mode.

**Step 1 — Clone the repo**
```bash
git clone https://github.com/Shada0/jestally.git
cd jestally/extension
```

**Step 2 — Download MediaPipe assets** (required, ~25MB total)
```powershell
# Run in PowerShell inside the extension/ folder
$version = "0.4.1646424915"
$base = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@$version"
$files = @("hands.js","hands_solution_packed_assets_loader.js",
           "hands_solution_simd_wasm_bin.js","hands_solution_simd_wasm_bin.wasm",
           "hands_solution_wasm_bin.js","hands_solution_wasm_bin.wasm",
           "hands_solution_packed_assets.data","hands.binarypb",
           "hand_landmark_full.tflite","hand_landmark_lite.tflite")
foreach ($f in $files) { Invoke-WebRequest "$base/$f" -OutFile $f }
# Expose Hands constructor globally
Add-Content hands.js "`nwindow.Hands = Hands;"
```

**Step 3 — Load in Chrome**
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

**Step 4 — Use it**
- The Jestally panel appears on every page (bottom-right)
- Toggle it on with the purple switch
- ISL Out: type or speak → see signs
- ISL In: click **Start Camera** → show a hand sign → hear the result

---

## 📖 Usage

### ISL Out (Text/Speech → Signs)

1. Open any website
2. Enable the Jestally panel
3. Select your **input language** (e.g. Hindi)
4. Type a sentence or click 🎤 to speak
5. The panel translates to English → applies ISL grammar → plays the sign sequence

### ISL In (Signs → Speech)

1. Switch to the **👁 ISL In** tab
2. Click **📷 Start Camera** — allow camera access
3. Show an ISL hand sign to your webcam
4. Jestally detects landmarks, runs AI inference, and **speaks the result** in your chosen language

### Language Selection

- Quick-select from top Indian languages (English, Hindi, Tamil, Telugu)
- Dropdown for all 10 supported languages
- Language applies to both speech input and TTS output

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Extension | Chrome MV3, Offscreen Documents API |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Hand Tracking | MediaPipe Hands (21-point 3D landmarks) |
| AI Model | LSTM (custom trained, 142 classes) |
| Model Hosting | AWS SageMaker (ml.c5.large) |
| API | AWS API Gateway + Lambda (Python 3.11) |
| Storage | AWS S3 + CloudFront |
| Translation | MyMemory API |
| TTS | Web Speech API |
| Web Hosting | AWS S3 + CloudFront |

---

## 🗺️ Roadmap

### ✅ Completed
- [x] Bidirectional ISL pipeline (text→sign, sign→text)
- [x] 10-language support with real-time translation
- [x] ISL grammar engine with token reordering
- [x] Chrome Extension (MV3) with floating panel
- [x] AWS SageMaker LSTM inference (142 classes)
- [x] MediaPipe landmark extraction via Offscreen Document API

### 🔜 Near-term
- [ ] **Chrome Web Store** public listing
- [ ] Expand to **300+ ISL signs** with community data collection portal
- [ ] **Two-hand gesture** support for complex compound signs
- [ ] **Fingerspelling** (A–Z ISL alphabet) recognition
- [ ] Offline mode with on-device TFLite inference (no cloud dependency)
- [ ] **Firefox** extension port
- [ ] Sentence-level gesture chunking and natural phrase grouping
- [ ] Real-time **video call overlay** — Google Meet, Zoom, Teams

### 📡 Media & Broadcast Integration *(Long-term Vision)*

This is where Jestally's impact multiplies. The same bidirectional AI pipeline that works in a browser can be embedded as a **real-time ISL layer in broadcast media**:

- **Live news channels** — ISL interpreter overlay generated automatically alongside the anchor, reducing cost of human interpreters while scaling availability
- **YouTube & streaming platforms** — Auto-generated ISL sign track as a selectable caption track, similar to subtitles but in gesture video
- **OTT platforms** (Netflix, Hotstar, Prime) — ISL sign avatar layer for all content on demand
- **Government broadcasts & public announcements** — Mandatory accessibility compliance at scale
- **Educational video platforms** — ISL-enabled lectures and course content automatically

Currently, live ISL interpretation on Indian TV requires a human interpreter in the frame — expensive, inconsistent in quality, and unavailable for most channels. Jestally's AI pipeline can bring this to **every channel, every broadcast, at near-zero marginal cost**.

The architecture for this already exists in our system — the same Lambda + SageMaker inference engine that powers the extension can be exposed as a **streaming API** that media platforms call frame-by-frame.

### 📱 Platform Expansion
- [ ] **Android app** — same bidirectional pipeline, native camera access
- [ ] **iOS app** — Safari extension equivalent
- [ ] **Enterprise SDK** — embeddable widget for any web platform
- [ ] **API-as-a-Service** — public ISL inference API for third-party developers

---

## 🌍 Impact

Communication is something most of us take for granted. We speak, type, and interact effortlessly through digital platforms every day. But for millions in the Deaf and hard-of-hearing community, communication works differently — Indian Sign Language is their *first* language, yet almost no digital system was designed with it in mind.

Jestally addresses this gap directly. Not by asking the Deaf community to adapt to existing interfaces — but by making existing interfaces adapt to them.

India has an estimated **1.8 million Deaf individuals** and a severe shortage of ISL interpreters. The technology to bridge this gap already exists. What was missing was the interface.

| Problem | Jestally's Answer |
|---|---|
| No ISL support on any website | Chrome Extension works on **every** website |
| Interpreter shortage | AI inference available 24/7, no human needed |
| English-only digital systems | 10 Indian languages supported |
| Expensive assistive hardware | Works on any laptop webcam |
| App install friction | No install — open a page and communicate |

Jestally is built to be **open, accessible, and extensible** — so the community can grow the sign vocabulary and improve the model over time. Because communication should never exclude anyone.

---

## 🤝 Contributing

Contributions are very welcome — especially:

- New ISL landmark training data
- UI/UX improvements to the panel
- Additional language support
- Model architecture experiments
- Bug fixes and documentation

```bash
# Fork the repo, then:
git clone https://github.com/YOUR_USERNAME/jestally.git
cd jestally
git checkout -b feature/your-feature
# Make changes, commit, and open a PR
```

Please open an issue before starting large changes so we can discuss the approach.

---

## 🙏 Acknowledgements

- [MediaPipe](https://mediapipe.dev/) — Google's real-time hand landmark detection
- [MyMemory](https://mymemory.translated.net/) — Free translation API
- [AWS](https://aws.amazon.com/) — SageMaker, Lambda, API Gateway, S3, CloudFront
- The Indian Deaf community — for inspiring this work

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ❤️ for the Indian Deaf community

**[🌐 Live Demo](https://dl1agc4y4ofy6.cloudfront.net)** · **[📦 GitHub](https://github.com/Shada0/jestally)** · **[🐛 Issues](https://github.com/Shada0/jestally/issues)**

</div>
