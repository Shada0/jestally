# Jestally — Ally Without Limits

> **AI4Bharat Hackathon 2026** · Indian Sign Language AI Platform · Powered by AWS

[![Live Demo](https://img.shields.io/badge/Live%20Demo-CloudFront-FF9900?style=flat&logo=amazon-aws)](https://dl1agc4y4ofy6.cloudfront.net)
[![GitHub](https://img.shields.io/badge/GitHub-Shada0%2Fjestally-181717?style=flat&logo=github)](https://github.com/Shada0/jestally)
[![Extension](https://img.shields.io/badge/Chrome%20Extension-Download-4285F4?style=flat&logo=google-chrome)](https://github.com/Shada0/jestally/releases/latest/download/jestally-extension.zip)
[![AWS](https://img.shields.io/badge/AWS-ap--south--1-FF9900?style=flat)](https://aws.amazon.com)

---

## The Problem

India has **63 million deaf and hard-of-hearing citizens** — yet there is no accessible, scalable tool to bridge communication between them and the hearing world. Education, healthcare, employment, and daily interaction remain out of reach for millions.

## The Solution

Jestally is a **fully serverless, AWS-native platform** that bridges spoken language and Indian Sign Language in real time — in both directions:

- **Speech / Text → ISL** — Speak or type in any of 22 Indian languages. Jestally reorders your input into correct ISL grammar using AI, then plays the full sign sequence as animated MP4 videos.
- **ISL → Speech** — Show a hand sign to the camera. Jestally classifies it using a TensorFlow model on SageMaker and speaks the result in your chosen Indian language.

No downloads. No plugins. No servers to manage. Works in any browser.

---

## Live Demo

| Resource | Link |
|---|---|
| 🌐 Web Application | https://dl1agc4y4ofy6.cloudfront.net |
| 🧩 Chrome Extension | [Download jestally-extension.zip](https://github.com/Shada0/jestally/releases/latest/download/jestally-extension.zip) |
| 📁 GitHub Repository | https://github.com/Shada0/jestally |

---

## Features

### Speech & Text → ISL Translation
- Voice input in 22 Indian languages via Web Speech API
- Input translation to English via Google Translate free endpoint
- AI ISL grammar reordering via Amazon Bedrock (Claude Haiku 3) — TIME first, Topic-Comment structure, WH-last
- Lemmatization — inflected forms reduced to root signs (seeing→see, going→go)
- Phrase-first resolution — multi-word expressions matched before individual words (4-gram → 3-gram → 2-gram → word)
- 151 ISL signs — letters A–Z, numbers 0–9, common vocabulary
- Animated MP4 sign videos served directly from S3

### Real-Time Sign Recognition
- On-device hand tracking via MediaPipe — 21-point skeleton, zero video leaves browser
- 30-frame skeletal sequences sent as 63-float vectors to AWS
- TensorFlow model on SageMaker classifies 151 ISL signs
- Top-3 predictions with confidence scores
- Multilingual TTS via ResponsiveVoice — speaks recognized signs in chosen Indian language

### Chrome Extension
- Manifest V3 Chrome extension
- Live ISL overlay inside Google Meet and Zoom
- No tab switching, no performance impact on the call

### Language Support
22 constitutionally scheduled Indian languages including Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Urdu and more.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│   Web App (CloudFront)          Chrome Extension (MV3)         │
│   Web Speech API                Google Meet · Zoom overlay     │
│   MediaPipe Hands (on-device)   ResponsiveVoice TTS            │
└──────────────────────┬──────────────────────────────────────────┘
                       │  HTTPS · REST · x-api-key
┌──────────────────────▼──────────────────────────────────────────┐
│                     AWS API GATEWAY                             │
│              /resolve (POST)  ·  /recognize (POST)             │
└───────────┬─────────────────────────────┬───────────────────────┘
            │                             │
┌───────────▼──────────┐      ┌───────────▼──────────────────────┐
│  Lambda: Resolver    │      │  Lambda: Recognizer              │
│  Node.js 20.x        │      │  SageMaker TF Serving            │
│                      │      │  151-class ISL model             │
│  1. normalizeText    │      │  30 frames × 63 floats input     │
│  2. Bedrock Haiku 3  │      │  sign + confidence + top3 output │
│     ISL grammar      │      └──────────────────────────────────┘
│  3. lemmatize        │
│  4. DynamoDB lookup  │
│  5. return gifs[]    │
└───────────┬──────────┘
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                    AWS DATA & AI LAYER                          │
│  DynamoDB: jestally-isl-dictionary-prod                        │
│  S3: jestally-isl-gifs-prod  — 151 MP4 sign videos            │
│  S3: jestally-app            — web app (CloudFront origin)     │
│  Amazon Bedrock  — Claude Haiku 3 (ISL grammar)               │
│  Amazon SageMaker — TF Serving (sign classification)          │
│  Amazon Translate — one-time seed of sign labels × 15 langs   │
└─────────────────────────────────────────────────────────────────┘
```

---

## AWS Services

| Service | Purpose |
|---|---|
| **Amazon CloudFront** | Global CDN — serves web app and extension UI |
| **Amazon S3** | Hosts web app, 151 ISL sign MP4 videos, ML model weights |
| **Amazon API Gateway** | REST API — API key auth, CORS, rate limiting |
| **AWS Lambda** | ISL resolver + sign recognizer (Node.js 20.x) |
| **Amazon DynamoDB** | ISL dictionary — phrase lookup with multilingual labels |
| **Amazon Bedrock** | Claude Haiku 3 — real-time ISL grammar reordering |
| **Amazon SageMaker** | TF Serving — 151-class sign classification |
| **Amazon Translate** | One-time seed — 165 sign labels × 15 Indian languages |
| **AWS IAM** | Least-privilege roles per service boundary |
| **Amazon CloudWatch** | Lambda logs, error monitoring |

---

## ISL Resolver Pipeline

```
POST /resolve { text, language }
        ↓
1. normalizeText()      — expand contractions, strip punctuation
2. applyISLGrammar()    — Amazon Bedrock Claude Haiku 3
                          TIME first · Topic-Comment · WH last
3. lemmatizeTokens()    — seeing→see · going→go · am→be
4. resolveSequence()    — DynamoDB 4-gram → 3-gram → 2-gram → word
5. pickLabel()          — translated_label per active language
        ↓
Response: {
  success, input, islOrdered, lemmatized, resolvedCount,
  gifs: [{ token, url, type, priority, translated_label, translated_labels }]
}
```

---

## Tech Stack

**Frontend:** Vanilla HTML/CSS/JS · MediaPipe Hands · Web Speech API · Google Translate (input translation) · MyMemory API (sign label fallback) · ResponsiveVoice TTS · ISL_TRANSLATIONS hardcoded map · Chrome Extension MV3

**Backend:** Node.js 20.x on AWS Lambda · AWS SDK v3 · Amazon Bedrock `apac.anthropic.claude-3-haiku-20240307-v1:0` · Custom lemmatizer · Phrase-first n-gram resolver

**ML:** TensorFlow/Keras sequence classifier · 30 frames × 63 floats input · Amazon SageMaker TF Serving

---

## DynamoDB Schema

```json
{
  "phrase": "thank you",
  "gif_url": "https://jestally-isl-gifs-prod.s3.ap-south-1.amazonaws.com/training-videos/Thank_You.mp4",
  "language": "ISL",
  "type": "phrase",
  "priority": 1,
  "translated_labels": {
    "en": "thank you", "hi": "धन्यवाद", "ta": "நன்றி",
    "te": "ధన్యవాదాలు", "kn": "ಧನ್ಯವಾದ", "ml": "നന്ദി",
    "bn": "ধন্যবাদ", "mr": "धन्यवाद", "gu": "આભાર",
    "pa": "ਧੰਨਵਾਦ", "ur": "شکریہ"
  }
}
```

---

## Chrome Extension Setup

1. Download [`jestally-extension.zip`](https://github.com/Shada0/jestally/releases/latest/download/jestally-extension.zip)
2. Right-click → **Extract All**
3. Open `chrome://extensions` → enable **Developer Mode**
4. Click **Load unpacked** → select the `extension-v3` folder
5. Pin from the Chrome toolbar puzzle icon 🧩

Works inside **Google Meet** and **Zoom**.

---

## Infrastructure

| Resource | Value |
|---|---|
| Web App | https://dl1agc4y4ofy6.cloudfront.net |
| Resolve API | https://ahwchrh9z0.execute-api.ap-south-1.amazonaws.com/prod/resolve |
| Recognize API | https://6n5ur96sk6.execute-api.ap-south-1.amazonaws.com/prod/recognize |
| DynamoDB Table | jestally-isl-dictionary-prod |
| SageMaker Endpoint | jestally-isl-endpoint-prod |
| AWS Region | ap-south-1 (Mumbai) |

---

## Key Design Decisions

**Seed-time translation:** Amazon Translate is called once per sign per language and stored in DynamoDB. Lambda never calls Translate at runtime — zero latency, zero cost per request.

**On-device hand tracking:** MediaPipe processes video locally. Only a 63-float vector per frame is sent to AWS — no video ever leaves the device.

**Phrase-first resolution:** Multi-word ISL expressions have distinct signs. 4-gram → 3-gram → 2-gram → word lookup ensures contextually accurate sequences.

**Bedrock for grammar:** ISL has SOV word order, topic-comment structure, time-first, WH-last — fundamentally different from English. Claude Haiku handles novel sentences at ~300ms with zero infrastructure.

**TTS label translation:** Sign labels are translated to Indian languages using a hardcoded ISL_TRANSLATIONS map (instant, offline). MyMemory API serves as a runtime fallback for any sign not in the map. ResponsiveVoice then speaks the result in the user's chosen language.

---

## Impact

| | |
|---|---|
| Target population | 63 million deaf/HoH in India |
| Languages supported | 22 scheduled Indian languages |
| ISL signs | 151 |
| Infrastructure cost at idle | $0 — fully serverless |
| Inference latency | ~160 ms |
| Setup required | None — works in any browser |

---

## Roadmap

**v1.0 · Live** — Speech-to-ISL, real-time sign recognition, Chrome extension for Meet & Zoom

**v2.0 · In Development** — WebSocket streaming, fingerspelling fallback

**v3.0 · Upcoming** — ASL/BSL/JSL support, 3D signing avatars via WebGL

**v4.0 · 2026** — Enterprise SDK, education institution portal

---

*Built for AI4Bharat Hackathon 2026 · © 2026 Jestally · Powered by AWS ap-south-1*
