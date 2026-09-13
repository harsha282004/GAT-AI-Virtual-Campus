# AI Agent–Driven Smart Campus Assistant with Immersive Virtual Tour Navigation

<p align="center">
  <strong>
    An intelligent smart-campus platform combining AI agents, Hybrid RAG,
    grounded question answering, immersive 360° virtual navigation,
    indoor A* pathfinding, and interactive campus exploration.
  </strong>
</p>

<p align="center">
  🌐 <a href="https://gat-ai-virtual-campus.vercel.app/">Live Application</a>
  &nbsp;&nbsp;•&nbsp;&nbsp;
  💻 <a href="https://github.com/harsha282004/GAT-AI-Virtual-Campus">GitHub Repository</a>
</p>

---

## 📌 Overview

The **AI Agent–Driven Smart Campus Assistant** is an intelligent web-based platform designed for exploring and interacting with a university campus digitally.

The system combines:

- 🤖 Multi-agent AI query routing
- 📚 Hybrid Retrieval-Augmented Generation (RAG)
- 🧠 Meta Llama 3.2 for grounded response naturalization
- 🔎 Dense + BM25 information retrieval
- 🗺️ Indoor A* pathfinding
- 🌐 360° immersive virtual campus navigation
- 🛰️ Interactive satellite campus mapping
- 🏫 Academic and campus information discovery
- 🏢 Building, floor, room and facility exploration
- ☁️ Cloud deployment using Vercel, Railway and Supabase

The implementation is based on **Global Academy of Technology (GAT), Bengaluru**, using institutional information and campus spatial data.

The objective is to create a single digital interface through which a student, visitor, faculty member or prospective applicant can:

> **Ask → Discover → Navigate → Explore**

without requiring separate systems for campus information, navigation and virtual exploration.

---

# 🎯 Problem Statement

Traditional campus information systems are generally fragmented.

A user may need to:

1. Search the institution's website for academic information.
2. Find PDFs for syllabus or regulations.
3. Contact the institution for admission-related information.
4. Physically locate buildings and rooms.
5. Use separate maps for outdoor navigation.
6. Ask different departments for campus information.
7. Visit the campus physically to understand its layout.

These processes make campus discovery time-consuming and difficult, especially for:

- New students
- Parents
- Visitors
- Prospective students
- Faculty
- Students unfamiliar with campus

This project addresses the problem by combining **AI-based information retrieval, campus intelligence, spatial navigation and immersive virtual exploration into one platform.**

---

# 💡 Proposed Solution

The platform acts as a unified **Smart Campus Assistant**.

A user can enter a natural-language query such as:

```text
Where is the Computer Science department?


User Query
    │
    ▼
Next.js Frontend
    │
    ▼
FastAPI /api/v1/chat
    │
    ▼
Multi-Agent Supervisor
    │
    ├── Navigation
    ├── Admissions
    ├── Academic
    ├── Facilities / Events
    └── General
    │
    ▼
Agent-specific processing
    │
    ▼
Hybrid Retrieval / Campus Tools
    │
    ├── Dense Retrieval
    ├── BM25 Retrieval
    ├── Heuristic Reranking
    ├── PostgreSQL Queries
    └── Spatial / Navigation Tools
    │
    ▼
Confidence Gate
    │
    ├── HIGH
    ├── MEDIUM
    └── LOW
    │
    ├── LOW → Verified Refusal
    │
    ▼
Grounded Answer
    │
    ▼
Meta Llama 3.2
    │
    ▼
Naturalized Response
    │
    ▼
Post-generation Grounding Checks
    │
    ├── Unsupported claim?
    ├── New number?
    ├── Missing entity?
    ├── Grounded token dropped?
    └── Invalid output?
    │
    ├── FAIL → Original verified response
    │
    ▼
Final Response
