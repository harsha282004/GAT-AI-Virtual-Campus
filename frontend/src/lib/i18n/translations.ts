import type { AppLanguage } from "@/store/languageStore";

/** Lightweight static-UI translation dictionary. Keys are the literal
 * English source strings (not codes) — translate(lang, text) looks the
 * English text up in the target language's dict and falls back to
 * returning the English text unchanged if the key is missing or the
 * language is "en". This means there is no separate English dictionary to
 * keep in sync, and a missing translation degrades gracefully instead of
 * ever showing "undefined". Deliberately NOT i18next/react-i18next — the
 * project has no i18n framework dependency today and this project's
 * static-string surface is small enough that a plain lookup table is the
 * "safest minimal approach" (see backend/RAG note in chat.ts: dynamic RAG
 * answers are NOT translated here, only static UI chrome). */

const kn: Record<string, string> = {
  // Navbar
  Home: "ಮುಖಪುಟ",
  Campus: "ಕ್ಯಾಂಪಸ್",
  "Virtual Tour": "ವರ್ಚುವಲ್ ಪ್ರವಾಸ",
  Map: "ನಕ್ಷೆ",
  Language: "ಭಾಷೆ",
  "AI Assistant": "ಎಐ ಸಹಾಯಕ",
  About: "ನಮ್ಮ ಬಗ್ಗೆ",

  // Hero
  "EST. 2001 • VTU AFFILIATED • NAAC A GRADE": "ಸ್ಥಾಪನೆ 2001 • VTU ಸಂಯೋಜಿತ • NAAC A ಗ್ರೇಡ್",
  "Explore Virtual Tour": "ವರ್ಚುವಲ್ ಪ್ರವಾಸ ವೀಕ್ಷಿಸಿ",
  "Ask the AI Assistant": "ಎಐ ಸಹಾಯಕರನ್ನು ಕೇಳಿ",
  "Est. 2001": "ಸ್ಥಾಪನೆ 2001",
  "NAAC A Grade": "NAAC A ಗ್ರೇಡ್",
  "10-Acre Campus": "10-ಎಕರೆ ಕ್ಯಾಂಪಸ್",

  // Features section
  Platform: "ವೇದಿಕೆ",
  "Everything you need to explore GAT": "GAT ಅನ್ವೇಷಿಸಲು ಬೇಕಾದ ಎಲ್ಲವೂ",
  "One connected platform for prospective students, parents, and visitors to understand the campus before ever setting foot on it.":
    "ಕ್ಯಾಂಪಸ್‌ಗೆ ಭೇಟಿ ನೀಡುವ ಮೊದಲೇ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ವಿದ್ಯಾರ್ಥಿಗಳು, ಪೋಷಕರು ಮತ್ತು ಸಂದರ್ಶಕರಿಗಾಗಿ ಒಂದು ಸಂಪರ್ಕಿತ ವೇದಿಕೆ.",
  "AI Chat Assistant": "ಎಐ ಚಾಟ್ ಸಹಾಯಕ",
  "Ask questions about admissions, academics, or facilities and get answers grounded in GAT's own knowledge base.":
    "ಪ್ರವೇಶ, ಶೈಕ್ಷಣಿಕ ಅಥವಾ ಸೌಲಭ್ಯಗಳ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ ಮತ್ತು GAT ಯ ಜ್ಞಾನ ಆಧಾರದ ಮೇಲೆ ಉತ್ತರಗಳನ್ನು ಪಡೆಯಿರಿ.",
  "360° Virtual Tour": "360° ವರ್ಚುವಲ್ ಪ್ರವಾಸ",
  "Walk through campus panorama by panorama, Street-View style, starting from the Main Gate.":
    "ಮುಖ್ಯ ದ್ವಾರದಿಂದ ಪ್ರಾರಂಭಿಸಿ, ಸ್ಟ್ರೀಟ್-ವ್ಯೂ ಶೈಲಿಯಲ್ಲಿ ಕ್ಯಾಂಪಸ್ ಅನ್ನು ಪನೋರಮಾ ಮೂಲಕ ಪನೋರಮಾ ವೀಕ್ಷಿಸಿ.",
  "3D Campus Map": "3D ಕ್ಯಾಂಪಸ್ ನಕ್ಷೆ",
  "See the whole ~10-acre campus from above, with buildings and pathways rendered in interactive 3D.":
    "ಸಂಪೂರ್ಣ ~10-ಎಕರೆ ಕ್ಯಾಂಪಸ್ ಅನ್ನು ಮೇಲಿನಿಂದ ನೋಡಿ, ಕಟ್ಟಡಗಳು ಮತ್ತು ಮಾರ್ಗಗಳು ಇಂಟರಾಕ್ಟಿವ್ 3D ಯಲ್ಲಿ.",
  "Voice Navigation": "ಧ್ವನಿ ನ್ಯಾವಿಗೇಷನ್",
  '"Take me to the library" — speak your destination and let the assistant guide the way.':
    '"ನನ್ನನ್ನು ಗ್ರಂಥಾಲಯಕ್ಕೆ ಕರೆದೊಯ್ಯಿ" — ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನವನ್ನು ಹೇಳಿ, ಸಹಾಯಕ ದಾರಿ ತೋರಿಸುತ್ತಾರೆ.',
  "Multi-language Support": "ಬಹು-ಭಾಷಾ ಬೆಂಬಲ",
  "Interact in English, Kannada, or Hindi as the platform expands.":
    "ಇಂಗ್ಲಿಷ್, ಕನ್ನಡ ಅಥವಾ ಹಿಂದಿಯಲ್ಲಿ ಸಂವಹನ ನಡೆಸಿ.",

  // Chat / AI Assistant page
  "GAT Assistant": "GAT ಸಹಾಯಕ",
  "Ask about admissions, academics, facilities, or navigation":
    "ಪ್ರವೇಶ, ಶೈಕ್ಷಣಿಕ, ಸೌಲಭ್ಯ ಅಥವಾ ದಾರಿಯ ಬಗ್ಗೆ ಕೇಳಿ",
  "Clear conversation": "ಸಂಭಾಷಣೆ ತೆರವುಗೊಳಿಸಿ",
  "Ask about admissions, academics, facilities…": "ಪ್ರವೇಶ, ಶೈಕ್ಷಣಿಕ, ಸೌಲಭ್ಯಗಳ ಬಗ್ಗೆ ಕೇಳಿ…",
  "Listening…": "ಕೇಳುತ್ತಿದೆ…",
  "Processing…": "ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲಾಗುತ್ತಿದೆ…",
  "Send message": "ಸಂದೇಶ ಕಳುಹಿಸಿ",
  "Start voice input": "ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಪ್ರಾರಂಭಿಸಿ",
  "Stop voice input": "ಧ್ವನಿ ಇನ್‌ಪುಟ್ ನಿಲ್ಲಿಸಿ",
  "Release to stop listening": "ಕೇಳುವುದನ್ನು ನಿಲ್ಲಿಸಲು ಬಿಡಿ",
  "Press and hold, or tap, to ask by voice": "ಧ್ವನಿಯ ಮೂಲಕ ಕೇಳಲು ಒತ್ತಿ ಹಿಡಿಯಿರಿ ಅಥವಾ ಟ್ಯಾಪ್ ಮಾಡಿ",
  "Voice input isn't supported in this browser": "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಬೆಂಬಲಿತವಿಲ್ಲ",
  "Voice input isn't supported in this browser.": "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಬೆಂಬಲಿತವಿಲ್ಲ.",
  "Stop speaking": "ಮಾತನಾಡುವುದನ್ನು ನಿಲ್ಲಿಸಿ",
  "Listen to answer": "ಉತ್ತರ ಆಲಿಸಿ",
  "Read answers aloud": "ಉತ್ತರಗಳನ್ನು ಗಟ್ಟಿಯಾಗಿ ಓದಿ",
  Copy: "ನಕಲಿಸಿ",
  Copied: "ನಕಲಿಸಲಾಗಿದೆ",

  // Voice error messages (useSpeechRecognition.ts)
  "Microphone access was denied. Allow microphone permission to use voice input.":
    "ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ. ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಬಳಸಲು ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನೀಡಿ.",
  "No speech detected. Please try again.": "ಯಾವುದೇ ಮಾತು ಪತ್ತೆಯಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  "No microphone was found on this device.": "ಈ ಸಾಧನದಲ್ಲಿ ಯಾವುದೇ ಮೈಕ್ರೊಫೋನ್ ಕಂಡುಬಂದಿಲ್ಲ.",
  "A network error interrupted voice recognition. Please try again.":
    "ನೆಟ್‌ವರ್ಕ್ ದೋಷ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆಗೆ ಅಡ್ಡಿಪಡಿಸಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  "Voice input couldn't be processed. Please try typing your question instead.":
    "ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ.",
  "Couldn't start voice input. Please try again.":
    "ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಪ್ರಾರಂಭಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  "Voice input timed out. Please try again.": "ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಸಮಯ ಮೀರಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",

  // Hero heading fragments (kept split to match the existing multi-line
  // layout — "Global Academy"/"of Technology," are the institution's own
  // name and are intentionally left untranslated, same as GAT/CSE/etc.)
  "reimagined as": "ಒಂದು ವರ್ಚುವಲ್ ಕ್ಯಾಂಪಸ್ ಆಗಿ",
  "a virtual campus.": "ಮರುರೂಪಿಸಲಾಗಿದೆ.",
  "Growing Ahead Of Time — explore GAT's buildings, laboratories, classrooms and facilities using an AI-guided assistant, indoor navigation, immersive 360° virtual tours and an interactive 3D campus map.":
    "Growing Ahead Of Time — GAT ಕಟ್ಟಡಗಳು, ಪ್ರಯೋಗಾಲಯಗಳು, ತರಗತಿ ಕೊಠಡಿಗಳು ಮತ್ತು ಸೌಲಭ್ಯಗಳನ್ನು ಎಐ-ಚಾಲಿತ ಸಹಾಯಕ, ಒಳಾಂಗಣ ನ್ಯಾವಿಗೇಷನ್, 360° ವರ್ಚುವಲ್ ಟೂರ್ ಮತ್ತು ಇಂಟರಾಕ್ಟಿವ್ 3D ಕ್ಯಾಂಪಸ್ ನಕ್ಷೆಯ ಮೂಲಕ ಅನ್ವೇಷಿಸಿ.",

  // Footer
  Explore: "ಅನ್ವೇಷಿಸಿ",
  Departments: "ವಿಭಾಗಗಳು",
  Contact: "ಸಂಪರ್ಕಿಸಿ",
  "Campus Overview": "ಕ್ಯಾಂಪಸ್ ಅವಲೋಕನ",
  "Growing Ahead Of Time — a VTU-affiliated engineering college established in 2001, NAAC A grade and AICTE approved.":
    "Growing Ahead Of Time — 2001ರಲ್ಲಿ ಸ್ಥಾಪಿತವಾದ VTU ಸಂಯೋಜಿತ ಎಂಜಿನಿಯರಿಂಗ್ ಕಾಲೇಜು, NAAC A ಗ್ರೇಡ್ ಮತ್ತು AICTE ಅನುಮೋದಿತ.",
  "Rajarajeshwari Nagar, Bangalore, Karnataka": "ರಾಜರಾಜೇಶ್ವರಿ ನಗರ, ಬೆಂಗಳೂರು, ಕರ್ನಾಟಕ",
  "Campus buses from Majestic, Shivajinagar, Kengeri, Jayanagar":
    "ಮೆಜೆಸ್ಟಿಕ್, ಶಿವಾಜಿನಗರ, ಕೆಂಗೇರಿ, ಜಯನಗರದಿಂದ ಕ್ಯಾಂಪಸ್ ಬಸ್‌ಗಳು",
  "All rights reserved.": "ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.",
  "Built as an AI Agent-Based Indoor Virtual Campus Tour project.":
    "ಎಐ ಏಜೆಂಟ್ ಆಧಾರಿತ ಇಂಡೋರ್ ವರ್ಚುವಲ್ ಕ್ಯಾಂಪಸ್ ಟೂರ್ ಪ್ರಾಜೆಕ್ಟ್ ಆಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ.",
  "Back to top": "ಮೇಲಕ್ಕೆ ಹಿಂತಿರುಗಿ",

  // CampusStatistics
  "At a Glance": "ಒಂದು ನೋಟದಲ್ಲಿ",
  "GAT by the numbers": "ಸಂಖ್ಯೆಗಳಲ್ಲಿ GAT",
  "A snapshot of the campus this platform is built to represent.":
    "ಈ ವೇದಿಕೆ ಪ್ರತಿನಿಧಿಸುವ ಕ್ಯಾಂಪಸ್‌ನ ಒಂದು ಸ್ನ್ಯಾಪ್‌ಶಾಟ್.",
  "Year Established": "ಸ್ಥಾಪನಾ ವರ್ಷ",
  "Campus Area": "ಕ್ಯಾಂಪಸ್ ವಿಸ್ತೀರ್ಣ",
  "Engineering Departments": "ಎಂಜಿನಿಯರಿಂಗ್ ವಿಭಾಗಗಳು",
  "Main Auditorium": "ಮುಖ್ಯ ಸಭಾಂಗಣ",

  // WhyChooseGAT
  "About GAT": "GAT ಬಗ್ಗೆ",
  "Why students choose Global Academy of Technology": "ವಿದ್ಯಾರ್ಥಿಗಳು Global Academy of Technology ಅನ್ನು ಏಕೆ ಆಯ್ಕೆ ಮಾಡುತ್ತಾರೆ",
  "VTU-affiliated engineering programs (BE, MTech, MSc, MBA)":
    "VTU ಸಂಯೋಜಿತ ಎಂಜಿನಿಯರಿಂಗ್ ಕಾರ್ಯಕ್ರಮಗಳು (BE, MTech, MSc, MBA)",
  "NAAC A Grade accredited institution": "NAAC A ಗ್ರೇಡ್ ಮಾನ್ಯತೆ ಪಡೆದ ಸಂಸ್ಥೆ",
  "AICTE approved and recognized": "AICTE ಅನುಮೋದಿತ ಮತ್ತು ಮಾನ್ಯತೆ ಪಡೆದಿದೆ",
  "Modern labs and infrastructure across 6 departments":
    "6 ವಿಭಾಗಗಳಾದ್ಯಂತ ಆಧುನಿಕ ಪ್ರಯೋಗಾಲಯಗಳು ಮತ್ತು ಮೂಲಸೌಕರ್ಯ",
  "Experienced faculty and dedicated placement support":
    "ಅನುಭವಿ ಬೋಧಕ ವರ್ಗ ಮತ್ತು ಸಮರ್ಪಿತ ಪ್ಲೇಸ್‌ಮೆಂಟ್ ಬೆಂಬಲ",
  "On-campus hostel with separate boys' and girls' blocks":
    "ಪ್ರತ್ಯೇಕ ಬಾಲಕರ ಮತ್ತು ಬಾಲಕಿಯರ ಬ್ಲಾಕ್‌ಗಳೊಂದಿಗೆ ಕ್ಯಾಂಪಸ್ ಹಾಸ್ಟೆಲ್",
  "Growing Ahead Of Time": "Growing Ahead Of Time",
  "Since 2001, GAT has trained engineers across Computer Science, Information Science, Electronics, Electrical, Mechanical, and Civil Engineering — with admission through KCET, COMEDK, PGCET, GATE, and KMAT.":
    "2001ರಿಂದ, GAT ಕಂಪ್ಯೂಟರ್ ಸೈನ್ಸ್, ಇನ್ಫರ್ಮೇಶನ್ ಸೈನ್ಸ್, ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್, ಎಲೆಕ್ಟ್ರಿಕಲ್, ಮೆಕ್ಯಾನಿಕಲ್ ಮತ್ತು ಸಿವಿಲ್ ಎಂಜಿನಿಯರಿಂಗ್‌ನಲ್ಲಿ ಎಂಜಿನಿಯರ್‌ಗಳಿಗೆ ತರಬೇತಿ ನೀಡಿದೆ — KCET, COMEDK, PGCET, GATE ಮತ್ತು KMAT ಮೂಲಕ ಪ್ರವೇಶ.",

  // LeadershipSection
  Leadership: "ನಾಯಕತ್ವ",
  "A Message from Our Leadership": "ನಮ್ಮ ನಾಯಕತ್ವದಿಂದ ಒಂದು ಸಂದೇಶ",

  // CampusShowcase
  "Campus Showcase": "ಕ್ಯಾಂಪಸ್ ಪ್ರದರ್ಶನ",
  "See GAT's campus for yourself": "GAT ಕ್ಯಾಂಪಸ್ ಅನ್ನು ನೀವೇ ನೋಡಿ",
  "A glimpse of the buildings and grounds you'll explore in the Virtual Tour and 3D map.":
    "ವರ್ಚುವಲ್ ಟೂರ್ ಮತ್ತು 3D ನಕ್ಷೆಯಲ್ಲಿ ನೀವು ಅನ್ವೇಷಿಸುವ ಕಟ್ಟಡಗಳು ಮತ್ತು ಆವರಣದ ಒಂದು ನೋಟ.",
  "Explore Campus": "ಕ್ಯಾಂಪಸ್ ಅನ್ವೇಷಿಸಿ",

  // Testimonials
  "Student Voices": "ವಿದ್ಯಾರ್ಥಿ ಧ್ವನಿಗಳು",
  "What life at GAT looks like": "GAT ಯಲ್ಲಿ ಜೀವನ ಹೇಗಿದೆ",
  "Representative reflections from students across departments.":
    "ವಿವಿಧ ವಿಭಾಗಗಳ ವಿದ್ಯಾರ್ಥಿಗಳ ಪ್ರಾತಿನಿಧಿಕ ಅನಿಸಿಕೆಗಳು.",
  "The labs and faculty support in the CSE department gave me the confidence to take on real projects, not just coursework.":
    "CSE ವಿಭಾಗದ ಪ್ರಯೋಗಾಲಯಗಳು ಮತ್ತು ಬೋಧಕ ವರ್ಗದ ಬೆಂಬಲ ನನಗೆ ಕೇವಲ ಕೋರ್ಸ್‌ವರ್ಕ್ ಅಲ್ಲದೆ ನೈಜ ಪ್ರಾಜೆಕ್ಟ್‌ಗಳನ್ನು ಕೈಗೆತ್ತಿಕೊಳ್ಳುವ ವಿಶ್ವಾಸ ನೀಡಿತು.",
  "Being able to explore the campus and departments online before choosing my branch would have made my decision so much easier.":
    "ನನ್ನ ಶಾಖೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡುವ ಮೊದಲು ಕ್ಯಾಂಪಸ್ ಮತ್ತು ವಿಭಾಗಗಳನ್ನು ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಅನ್ವೇಷಿಸಲು ಸಾಧ್ಯವಾಗಿದ್ದರೆ ನನ್ನ ನಿರ್ಧಾರ ತುಂಬಾ ಸುಲಭವಾಗುತ್ತಿತ್ತು.",
  "The hostel facilities and the central location made settling into campus life straightforward from day one.":
    "ಹಾಸ್ಟೆಲ್ ಸೌಲಭ್ಯಗಳು ಮತ್ತು ಕೇಂದ್ರ ಸ್ಥಳವು ಮೊದಲ ದಿನದಿಂದಲೇ ಕ್ಯಾಂಪಸ್ ಜೀವನಕ್ಕೆ ಹೊಂದಿಕೊಳ್ಳುವುದನ್ನು ಸುಲಭಗೊಳಿಸಿತು.",
  "Final Year Student": "ಅಂತಿಮ ವರ್ಷದ ವಿದ್ಯಾರ್ಥಿ",
  "Second Year Student": "ಎರಡನೇ ವರ್ಷದ ವಿದ್ಯಾರ್ಥಿ",
  "Third Year Student": "ಮೂರನೇ ವರ್ಷದ ವಿದ್ಯಾರ್ಥಿ",
  "Computer Science & Engineering": "ಕಂಪ್ಯೂಟರ್ ಸೈನ್ಸ್ & ಎಂಜಿನಿಯರಿಂಗ್",
  "Electronics & Communication": "ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್ & ಕಮ್ಯುನಿಕೇಶನ್",
  "Mechanical Engineering": "ಮೆಕ್ಯಾನಿಕಲ್ ಎಂಜಿನಿಯರಿಂಗ್",

  // CallToAction
  "Experience GAT like never before": "GAT ಅನ್ನು ಹಿಂದೆಂದೂ ಇಲ್ಲದಂತೆ ಅನುಭವಿಸಿ",
  "From your first question to your last turn down a corridor — explore the campus your way.":
    "ನಿಮ್ಮ ಮೊದಲ ಪ್ರಶ್ನೆಯಿಂದ ಕಾರಿಡಾರಿನ ಕೊನೆಯ ತಿರುವಿನವರೆಗೆ — ಕ್ಯಾಂಪಸ್ ಅನ್ನು ನಿಮ್ಮದೇ ರೀತಿಯಲ್ಲಿ ಅನ್ವೇಷಿಸಿ.",
  "Start the Virtual Tour": "ವರ್ಚುವಲ್ ಟೂರ್ ಪ್ರಾರಂಭಿಸಿ",
  "Chat with the Assistant": "ಸಹಾಯಕರೊಂದಿಗೆ ಚಾಟ್ ಮಾಡಿ",

  // Campus page
  "Campus Experience": "ಕ್ಯಾಂಪಸ್ ಅನುಭವ",
  "Explore the GAT Campus": "GAT ಕ್ಯಾಂಪಸ್ ಅನ್ವೇಷಿಸಿ",
  "Discover the spaces, facilities, learning environments, and architectural highlights that make Global Academy of Technology a vibrant campus for learning and innovation.":
    "Global Academy of Technology ಅನ್ನು ಕಲಿಕೆ ಮತ್ತು ನಾವೀನ್ಯತೆಗೆ ಚೈತನ್ಯಶೀಲ ಕ್ಯಾಂಪಸ್ ಆಗಿಸುವ ಸ್ಥಳಗಳು, ಸೌಲಭ್ಯಗಳು, ಕಲಿಕಾ ಪರಿಸರಗಳು ಮತ್ತು ವಾಸ್ತುಶಿಲ್ಪದ ವೈಶಿಷ್ಟ್ಯಗಳನ್ನು ಅನ್ವೇಷಿಸಿ.",

  // Virtual Tour — buildings/floors (also used as display names for
  // dynamic building/floor values coming from the tour data, since t()
  // looks up by literal value, not a separate key)
  Buildings: "ಕಟ್ಟಡಗಳು",
  "Main Building": "ಮುಖ್ಯ ಕಟ್ಟಡ",
  Entrance: "ಪ್ರವೇಶ ದ್ವಾರ",
  "Ground Floor": "ನೆಲ ಮಹಡಿ",
  "First Floor": "ಮೊದಲ ಮಹಡಿ",
  "Second Floor": "ಎರಡನೇ ಮಹಡಿ",
  "Third Floor": "ಮೂರನೇ ಮಹಡಿ",
  "Central Quadrangle": "ಕೇಂದ್ರ ಚೌಕ",

  // Virtual Tour — top bar / mode toggle / bottom controls
  "Manual Tour": "ಸ್ವಯಂ ಪ್ರವಾಸ",
  "Guided Tour": "ಮಾರ್ಗದರ್ಶಿತ ಪ್ರವಾಸ",
  "Show sidebar": "ಸೈಡ್‌ಬಾರ್ ತೋರಿಸಿ",
  "Hide sidebar": "ಸೈಡ್‌ಬಾರ್ ಮರೆಮಾಡಿ",
  Previous: "ಹಿಂದಿನದು",
  "Reset View": "ವೀಕ್ಷಣೆ ಮರುಹೊಂದಿಸಿ",
  Fullscreen: "ಪೂರ್ಣ ಪರದೆ",
  Next: "ಮುಂದಿನದು",

  // Virtual Tour — guided tour controls/panel
  "Start Guided Tour": "ಮಾರ್ಗದರ್ಶಿತ ಪ್ರವಾಸ ಪ್ರಾರಂಭಿಸಿ",
  Pause: "ವಿರಾಮ",
  Resume: "ಮುಂದುವರಿಸಿ",
  Stop: "ನಿಲ್ಲಿಸಿ",
  Restart: "ಮರುಪ್ರಾರಂಭಿಸಿ",
  Slow: "ನಿಧಾನ",
  Normal: "ಸಾಮಾನ್ಯ",
  Fast: "ವೇಗ",
  "AI Guide": "ಎಐ ಮಾರ್ಗದರ್ಶಿ",
  Paused: "ವಿರಾಮಗೊಂಡಿದೆ",
  "Guided tour complete.": "ಮಾರ್ಗದರ್ಶಿತ ಪ್ರವಾಸ ಪೂರ್ಣಗೊಂಡಿದೆ.",
  "Taking in the view…": "ದೃಶ್ಯವನ್ನು ವೀಕ್ಷಿಸಲಾಗುತ್ತಿದೆ…",
  "Looking left…": "ಎಡಕ್ಕೆ ನೋಡುತ್ತಿದೆ…",
  "Returning to center…": "ಕೇಂದ್ರಕ್ಕೆ ಹಿಂತಿರುಗುತ್ತಿದೆ…",
  "Looking right…": "ಬಲಕ್ಕೆ ನೋಡುತ್ತಿದೆ…",
  "Walking forward…": "ಮುಂದೆ ನಡೆಯುತ್ತಿದೆ…",

  // Virtual Tour — cross-floor hotspot placement (dev tool)
  "Cross-Floor Hotspots": "ಅಡ್ಡ-ಮಹಡಿ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು",
  Place: "ಇರಿಸಿ",
  Cancel: "ರದ್ದುಮಾಡಿ",
  "Select destination scene…": "ಗಮ್ಯ ದೃಶ್ಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ…",
  "Label (optional)": "ಲೇಬಲ್ (ಐಚ್ಛಿಕ)",
  "Saving…": "ಉಳಿಸಲಾಗುತ್ತಿದೆ…",
  "Save Changes": "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ",
  "Delete hotspot": "ಹಾಟ್‌ಸ್ಪಾಟ್ ಅಳಿಸಿ",
  Save: "ಉಳಿಸಿ",
  "Click on the panorama where another floor is visible.":
    "ಮತ್ತೊಂದು ಮಹಡಿ ಕಾಣಿಸುವ ಸ್ಥಳದಲ್ಲಿ ಪನೋರಮಾ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ.",
  "Click Place and then click anywhere inside the panorama to create a new cross-floor hotspot.":
    "ಹೊಸ ಅಡ್ಡ-ಮಹಡಿ ಹಾಟ್‌ಸ್ಪಾಟ್ ರಚಿಸಲು 'ಇರಿಸಿ' ಕ್ಲಿಕ್ ಮಾಡಿ ನಂತರ ಪನೋರಮಾ ಒಳಗೆ ಎಲ್ಲಿಯಾದರೂ ಕ್ಲಿಕ್ ಮಾಡಿ.",
  "Click any existing hotspot marker inside the panorama to edit or delete it.":
    "ಸಂಪಾದಿಸಲು ಅಥವಾ ಅಳಿಸಲು ಪನೋರಮಾ ಒಳಗಿನ ಯಾವುದೇ ಅಸ್ತಿತ್ವದಲ್ಲಿರುವ ಹಾಟ್‌ಸ್ಪಾಟ್ ಗುರುತು ಕ್ಲಿಕ್ ಮಾಡಿ.",
  "Click where the other floor is visible": "ಇನ್ನೊಂದು ಮಹಡಿ ಕಾಣಿಸುವ ಸ್ಥಳದಲ್ಲಿ ಕ್ಲಿಕ್ ಮಾಡಿ",

  // Virtual Tour — immersive toggle
  "Enter immersive mode": "ಇಮ್ಮರ್ಸಿವ್ ಮೋಡ್ ಪ್ರವೇಶಿಸಿ",
  "Exit immersive mode": "ಇಮ್ಮರ್ಸಿವ್ ಮೋಡ್‌ನಿಂದ ನಿರ್ಗಮಿಸಿ",
  "Immersive mode (Space)": "ಇಮ್ಮರ್ಸಿವ್ ಮೋಡ್ (Space)",
  "Exit immersive mode (Space)": "ಇಮ್ಮರ್ಸಿವ್ ಮೋಡ್‌ನಿಂದ ನಿರ್ಗಮಿಸಿ (Space)",

  // Virtual Tour — panorama load states
  "Loading panorama…": "ಪನೋರಮಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
  "This panorama couldn't be loaded": "ಈ ಪನೋರಮಾ ಲೋಡ್ ಆಗಲಿಲ್ಲ",
  "The image may be missing or your connection dropped. Try again.":
    "ಚಿತ್ರ ಕಾಣೆಯಾಗಿರಬಹುದು ಅಥವಾ ನಿಮ್ಮ ಸಂಪರ್ಕ ಕಡಿತಗೊಂಡಿರಬಹುದು. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",

  // Virtual Tour — minimap
  "(you are here)": "(ನೀವು ಇಲ್ಲಿದ್ದೀರಿ)",
  "(visited)": "(ಭೇಟಿ ನೀಡಲಾಗಿದೆ)",
};

const hi: Record<string, string> = {
  // Navbar
  Home: "होम",
  Campus: "कैंपस",
  "Virtual Tour": "वर्चुअल टूर",
  Map: "मानचित्र",
  Language: "भाषा",
  "AI Assistant": "एआई सहायक",
  About: "हमारे बारे में",

  // Hero
  "EST. 2001 • VTU AFFILIATED • NAAC A GRADE": "स्थापना 2001 • VTU संबद्ध • NAAC A ग्रेड",
  "Explore Virtual Tour": "वर्चुअल टूर देखें",
  "Ask the AI Assistant": "एआई सहायक से पूछें",
  "Est. 2001": "स्थापना 2001",
  "NAAC A Grade": "NAAC A ग्रेड",
  "10-Acre Campus": "10-एकड़ कैंपस",

  // Features section
  Platform: "प्लेटफ़ॉर्म",
  "Everything you need to explore GAT": "GAT को जानने के लिए आपको जो कुछ भी चाहिए",
  "One connected platform for prospective students, parents, and visitors to understand the campus before ever setting foot on it.":
    "कैंपस आने से पहले ही उसे समझने के लिए छात्रों, अभिभावकों और आगंतुकों के लिए एक जुड़ा हुआ प्लेटफ़ॉर्म।",
  "AI Chat Assistant": "एआई चैट सहायक",
  "Ask questions about admissions, academics, or facilities and get answers grounded in GAT's own knowledge base.":
    "प्रवेश, शिक्षा या सुविधाओं के बारे में प्रश्न पूछें और GAT के ज्ञान आधार पर आधारित उत्तर पाएं।",
  "360° Virtual Tour": "360° वर्चुअल टूर",
  "Walk through campus panorama by panorama, Street-View style, starting from the Main Gate.":
    "मुख्य द्वार से शुरू करते हुए, स्ट्रीट-व्यू शैली में कैंपस को पैनोरमा दर पैनोरमा देखें।",
  "3D Campus Map": "3D कैंपस मानचित्र",
  "See the whole ~10-acre campus from above, with buildings and pathways rendered in interactive 3D.":
    "पूरे ~10-एकड़ कैंपस को ऊपर से देखें, इमारतें और रास्ते इंटरैक्टिव 3D में।",
  "Voice Navigation": "वॉयस नेविगेशन",
  '"Take me to the library" — speak your destination and let the assistant guide the way.':
    '"मुझे लाइब्रेरी ले चलो" — अपना गंतव्य बोलें और सहायक आपको रास्ता दिखाएगा।',
  "Multi-language Support": "बहु-भाषा समर्थन",
  "Interact in English, Kannada, or Hindi as the platform expands.":
    "अंग्रेज़ी, कन्नड़ या हिंदी में बातचीत करें।",

  // Chat / AI Assistant page
  "GAT Assistant": "GAT सहायक",
  "Ask about admissions, academics, facilities, or navigation":
    "प्रवेश, शिक्षा, सुविधाओं या दिशा-निर्देश के बारे में पूछें",
  "Clear conversation": "बातचीत साफ़ करें",
  "Ask about admissions, academics, facilities…": "प्रवेश, शिक्षा, सुविधाओं के बारे में पूछें…",
  "Listening…": "सुन रहा है…",
  "Processing…": "प्रोसेस हो रहा है…",
  "Send message": "संदेश भेजें",
  "Start voice input": "वॉयस इनपुट शुरू करें",
  "Stop voice input": "वॉयस इनपुट बंद करें",
  "Release to stop listening": "सुनना बंद करने के लिए छोड़ें",
  "Press and hold, or tap, to ask by voice": "वॉयस से पूछने के लिए दबाकर रखें या टैप करें",
  "Voice input isn't supported in this browser": "इस ब्राउज़र में वॉयस इनपुट समर्थित नहीं है",
  "Voice input isn't supported in this browser.": "इस ब्राउज़र में वॉयस इनपुट समर्थित नहीं है।",
  "Stop speaking": "बोलना बंद करें",
  "Listen to answer": "उत्तर सुनें",
  "Read answers aloud": "उत्तर ज़ोर से पढ़ें",
  Copy: "कॉपी करें",
  Copied: "कॉपी हो गया",

  // Voice error messages (useSpeechRecognition.ts)
  "Microphone access was denied. Allow microphone permission to use voice input.":
    "माइक्रोफ़ोन एक्सेस अस्वीकृत कर दिया गया। वॉयस इनपुट उपयोग करने के लिए माइक्रोफ़ोन अनुमति दें।",
  "No speech detected. Please try again.": "कोई आवाज़ नहीं मिली। कृपया फिर से प्रयास करें।",
  "No microphone was found on this device.": "इस डिवाइस पर कोई माइक्रोफ़ोन नहीं मिला।",
  "A network error interrupted voice recognition. Please try again.":
    "एक नेटवर्क त्रुटि ने वॉयस पहचान में बाधा डाली। कृपया फिर से प्रयास करें।",
  "Voice input couldn't be processed. Please try typing your question instead.":
    "वॉयस इनपुट प्रोसेस नहीं हो सका। कृपया अपना प्रश्न टाइप करें।",
  "Couldn't start voice input. Please try again.": "वॉयस इनपुट शुरू नहीं हो सका। कृपया फिर से प्रयास करें।",
  "Voice input timed out. Please try again.": "वॉयस इनपुट का समय समाप्त हो गया। कृपया फिर से प्रयास करें।",

  // Hero heading fragments (kept split to match the existing multi-line
  // layout — "Global Academy"/"of Technology," are the institution's own
  // name and are intentionally left untranslated, same as GAT/CSE/etc.)
  "reimagined as": "एक वर्चुअल कैंपस के रूप में",
  "a virtual campus.": "फिर से कल्पना की गई।",
  "Growing Ahead Of Time — explore GAT's buildings, laboratories, classrooms and facilities using an AI-guided assistant, indoor navigation, immersive 360° virtual tours and an interactive 3D campus map.":
    "Growing Ahead Of Time — GAT की इमारतों, प्रयोगशालाओं, कक्षाओं और सुविधाओं को एआई-गाइडेड सहायक, इनडोर नेविगेशन, 360° वर्चुअल टूर और इंटरैक्टिव 3D कैंपस मानचित्र के माध्यम से देखें।",

  // Footer
  Explore: "एक्सप्लोर करें",
  Departments: "विभाग",
  Contact: "संपर्क करें",
  "Campus Overview": "कैंपस अवलोकन",
  "Growing Ahead Of Time — a VTU-affiliated engineering college established in 2001, NAAC A grade and AICTE approved.":
    "Growing Ahead Of Time — 2001 में स्थापित एक VTU संबद्ध इंजीनियरिंग कॉलेज, NAAC A ग्रेड और AICTE अनुमोदित।",
  "Rajarajeshwari Nagar, Bangalore, Karnataka": "राजराजेश्वरी नगर, बेंगलुरु, कर्नाटक",
  "Campus buses from Majestic, Shivajinagar, Kengeri, Jayanagar":
    "मैजेस्टिक, शिवाजीनगर, केंगेरी, जयनगर से कैंपस बसें",
  "All rights reserved.": "सर्वाधिकार सुरक्षित।",
  "Built as an AI Agent-Based Indoor Virtual Campus Tour project.":
    "एक एआई एजेंट-आधारित इनडोर वर्चुअल कैंपस टूर प्रोजेक्ट के रूप में निर्मित।",
  "Back to top": "ऊपर वापस जाएँ",

  // CampusStatistics
  "At a Glance": "एक नज़र में",
  "GAT by the numbers": "आंकड़ों में GAT",
  "A snapshot of the campus this platform is built to represent.":
    "इस प्लेटफ़ॉर्म द्वारा दर्शाए गए कैंपस की एक झलक।",
  "Year Established": "स्थापना वर्ष",
  "Campus Area": "कैंपस क्षेत्रफल",
  "Engineering Departments": "इंजीनियरिंग विभाग",
  "Main Auditorium": "मुख्य सभागार",

  // WhyChooseGAT
  "About GAT": "GAT के बारे में",
  "Why students choose Global Academy of Technology": "विद्यार्थी Global Academy of Technology को क्यों चुनते हैं",
  "VTU-affiliated engineering programs (BE, MTech, MSc, MBA)":
    "VTU संबद्ध इंजीनियरिंग कार्यक्रम (BE, MTech, MSc, MBA)",
  "NAAC A Grade accredited institution": "NAAC A ग्रेड मान्यता प्राप्त संस्थान",
  "AICTE approved and recognized": "AICTE अनुमोदित और मान्यता प्राप्त",
  "Modern labs and infrastructure across 6 departments":
    "6 विभागों में आधुनिक प्रयोगशालाएँ और बुनियादी ढाँचा",
  "Experienced faculty and dedicated placement support":
    "अनुभवी शिक्षक स्टाफ और समर्पित प्लेसमेंट सहायता",
  "On-campus hostel with separate boys' and girls' blocks":
    "अलग बालक और बालिका ब्लॉक के साथ कैंपस में छात्रावास",
  "Growing Ahead Of Time": "Growing Ahead Of Time",
  "Since 2001, GAT has trained engineers across Computer Science, Information Science, Electronics, Electrical, Mechanical, and Civil Engineering — with admission through KCET, COMEDK, PGCET, GATE, and KMAT.":
    "2001 से, GAT ने कंप्यूटर साइंस, इंफॉर्मेशन साइंस, इलेक्ट्रॉनिक्स, इलेक्ट्रिकल, मैकेनिकल और सिविल इंजीनियरिंग में इंजीनियर तैयार किए हैं — KCET, COMEDK, PGCET, GATE और KMAT के माध्यम से प्रवेश।",

  // LeadershipSection
  Leadership: "नेतृत्व",
  "A Message from Our Leadership": "हमारे नेतृत्व की ओर से एक संदेश",

  // CampusShowcase
  "Campus Showcase": "कैंपस झलक",
  "See GAT's campus for yourself": "GAT का कैंपस स्वयं देखें",
  "A glimpse of the buildings and grounds you'll explore in the Virtual Tour and 3D map.":
    "वर्चुअल टूर और 3D मानचित्र में आप जिन इमारतों और परिसर को देखेंगे, उनकी एक झलक।",
  "Explore Campus": "कैंपस देखें",

  // Testimonials
  "Student Voices": "विद्यार्थियों की राय",
  "What life at GAT looks like": "GAT में जीवन कैसा है",
  "Representative reflections from students across departments.":
    "विभिन्न विभागों के विद्यार्थियों के प्रतिनिधि विचार।",
  "The labs and faculty support in the CSE department gave me the confidence to take on real projects, not just coursework.":
    "CSE विभाग की प्रयोगशालाओं और शिक्षकों के सहयोग ने मुझे केवल कोर्सवर्क ही नहीं, बल्कि वास्तविक प्रोजेक्ट लेने का आत्मविश्वास दिया।",
  "Being able to explore the campus and departments online before choosing my branch would have made my decision so much easier.":
    "अपनी शाखा चुनने से पहले कैंपस और विभागों को ऑनलाइन देख पाना मेरा निर्णय बहुत आसान बना देता।",
  "The hostel facilities and the central location made settling into campus life straightforward from day one.":
    "छात्रावास की सुविधाओं और केंद्रीय स्थान ने पहले दिन से ही कैंपस जीवन में ढलना आसान बना दिया।",
  "Final Year Student": "अंतिम वर्ष का विद्यार्थी",
  "Second Year Student": "द्वितीय वर्ष का विद्यार्थी",
  "Third Year Student": "तृतीय वर्ष का विद्यार्थी",
  "Computer Science & Engineering": "कंप्यूटर साइंस एवं इंजीनियरिंग",
  "Electronics & Communication": "इलेक्ट्रॉनिक्स एवं कम्युनिकेशन",
  "Mechanical Engineering": "मैकेनिकल इंजीनियरिंग",

  // CallToAction
  "Experience GAT like never before": "GAT का अनुभव पहले जैसा कभी नहीं",
  "From your first question to your last turn down a corridor — explore the campus your way.":
    "आपके पहले प्रश्न से लेकर गलियारे के आख़िरी मोड़ तक — कैंपस को अपने तरीके से देखें।",
  "Start the Virtual Tour": "वर्चुअल टूर शुरू करें",
  "Chat with the Assistant": "सहायक से बात करें",

  // Campus page
  "Campus Experience": "कैंपस अनुभव",
  "Explore the GAT Campus": "GAT कैंपस देखें",
  "Discover the spaces, facilities, learning environments, and architectural highlights that make Global Academy of Technology a vibrant campus for learning and innovation.":
    "Global Academy of Technology को सीखने और नवाचार के लिए एक जीवंत कैंपस बनाने वाले स्थानों, सुविधाओं, शिक्षण परिवेशों और स्थापत्य विशेषताओं को जानें।",

  // Virtual Tour — buildings/floors
  Buildings: "इमारतें",
  "Main Building": "मुख्य भवन",
  Entrance: "प्रवेश द्वार",
  "Ground Floor": "भूतल",
  "First Floor": "पहली मंज़िल",
  "Second Floor": "दूसरी मंज़िल",
  "Third Floor": "तीसरी मंज़िल",
  "Central Quadrangle": "केंद्रीय प्रांगण",

  // Virtual Tour — top bar / mode toggle / bottom controls
  "Manual Tour": "स्वयं भ्रमण",
  "Guided Tour": "निर्देशित भ्रमण",
  "Show sidebar": "साइडबार दिखाएँ",
  "Hide sidebar": "साइडबार छिपाएँ",
  Previous: "पिछला",
  "Reset View": "दृश्य रीसेट करें",
  Fullscreen: "पूर्ण स्क्रीन",
  Next: "अगला",

  // Virtual Tour — guided tour controls/panel
  "Start Guided Tour": "निर्देशित भ्रमण शुरू करें",
  Pause: "रोकें",
  Resume: "फिर से शुरू करें",
  Stop: "बंद करें",
  Restart: "पुनः आरंभ करें",
  Slow: "धीमा",
  Normal: "सामान्य",
  Fast: "तेज़",
  "AI Guide": "एआई गाइड",
  Paused: "रुका हुआ",
  "Guided tour complete.": "निर्देशित भ्रमण पूर्ण हुआ।",
  "Taking in the view…": "दृश्य देखा जा रहा है…",
  "Looking left…": "बाईं ओर देख रहे हैं…",
  "Returning to center…": "केंद्र की ओर लौट रहे हैं…",
  "Looking right…": "दाईं ओर देख रहे हैं…",
  "Walking forward…": "आगे बढ़ रहे हैं…",

  // Virtual Tour — cross-floor hotspot placement (dev tool)
  "Cross-Floor Hotspots": "क्रॉस-फ्लोर हॉटस्पॉट",
  Place: "रखें",
  Cancel: "रद्द करें",
  "Select destination scene…": "गंतव्य दृश्य चुनें…",
  "Label (optional)": "लेबल (वैकल्पिक)",
  "Saving…": "सहेजा जा रहा है…",
  "Save Changes": "बदलाव सहेजें",
  "Delete hotspot": "हॉटस्पॉट हटाएँ",
  Save: "सहेजें",
  "Click on the panorama where another floor is visible.":
    "जहाँ दूसरी मंज़िल दिखाई दे रही हो वहाँ पैनोरमा पर क्लिक करें।",
  "Click Place and then click anywhere inside the panorama to create a new cross-floor hotspot.":
    "नया क्रॉस-फ्लोर हॉटस्पॉट बनाने के लिए 'रखें' पर क्लिक करें और फिर पैनोरमा के अंदर कहीं भी क्लिक करें।",
  "Click any existing hotspot marker inside the panorama to edit or delete it.":
    "संपादित करने या हटाने के लिए पैनोरमा के अंदर किसी भी मौजूदा हॉटस्पॉट मार्कर पर क्लिक करें।",
  "Click where the other floor is visible": "जहाँ दूसरी मंज़िल दिखाई दे रही हो वहाँ क्लिक करें",

  // Virtual Tour — immersive toggle
  "Enter immersive mode": "इमर्सिव मोड में जाएँ",
  "Exit immersive mode": "इमर्सिव मोड से बाहर निकलें",
  "Immersive mode (Space)": "इमर्सिव मोड (Space)",
  "Exit immersive mode (Space)": "इमर्सिव मोड से बाहर निकलें (Space)",

  // Virtual Tour — panorama load states
  "Loading panorama…": "पैनोरमा लोड हो रहा है…",
  "This panorama couldn't be loaded": "यह पैनोरमा लोड नहीं हो सका",
  "The image may be missing or your connection dropped. Try again.":
    "छवि उपलब्ध नहीं है या आपका कनेक्शन टूट गया है। फिर से प्रयास करें।",

  // Virtual Tour — minimap
  "(you are here)": "(आप यहाँ हैं)",
  "(visited)": "(देखा जा चुका है)",
};

const DICTIONARIES: Record<AppLanguage, Record<string, string> | null> = {
  en: null,
  kn,
  hi,
};

/** English text -> selected-language text, falling back to the English
 * text unchanged when the language is English or the string has no
 * translation entry yet. Never throws, never returns undefined. */
export function translate(language: AppLanguage, text: string): string {
  if (language === "en") return text;
  return DICTIONARIES[language]?.[text] ?? text;
}

/** BCP-47 tags for SpeechRecognition/SpeechSynthesis. Indian English
 * (en-IN) is preferred over en-US for this India-based campus project,
 * per the existing useSpeechRecognition default of "en-US" being upgraded
 * here — falls back to en-US if the platform has no en-IN voice/engine. */
export const SPEECH_LANG: Record<AppLanguage, string> = {
  en: "en-IN",
  kn: "kn-IN",
  hi: "hi-IN",
};

// Dynamic (numbered/interpolated) Virtual Tour strings — translate()'s
// plain key lookup can't hold a template, so these are small explicit
// per-language functions instead. Kept alongside the dictionaries above
// so tour terminology never drifts between the two.

export function tMinimapStepOf(language: AppLanguage, current: number, total: number): string {
  if (language === "kn") return `${total} ರಲ್ಲಿ ${current}ನೇ ಹಂತ`;
  if (language === "hi") return `${total} में से चरण ${current}`;
  return `Step ${current} of ${total}`;
}

export function tSceneOf(language: AppLanguage, current: number, total: number): string {
  if (language === "kn") return `${total} ರಲ್ಲಿ ${current}ನೇ ದೃಶ್ಯ`;
  if (language === "hi") return `${total} में से दृश्य ${current}`;
  return `Scene ${current} of ${total}`;
}

export function tScenesRemaining(language: AppLanguage, count: number): string {
  if (count === 0) {
    if (language === "kn") return "ಈ ಮಹಡಿಯಲ್ಲಿ ಕೊನೆಯ ದೃಶ್ಯ";
    if (language === "hi") return "इस मंज़िल का अंतिम दृश्य";
    return "Last scene on this floor";
  }
  if (language === "kn") return `${count} ದೃಶ್ಯ${count === 1 ? "" : "ಗಳು"} ಬಾಕಿಯಿದೆ`;
  if (language === "hi") return `${count} दृश्य शेष`;
  return `${count} scene${count === 1 ? "" : "s"} remaining`;
}

export function tCampusMapAria(language: AppLanguage, locationLabel: string): string {
  if (language === "kn") return `${locationLabel} ಕ್ಯಾಂಪಸ್ ನಕ್ಷೆ, ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಸ್ಥಳ ಮತ್ತು ಮಾರ್ಗವನ್ನು ತೋರಿಸುತ್ತದೆ`;
  if (language === "hi") return `${locationLabel} का कैंपस मानचित्र, आपकी वर्तमान स्थिति और मार्ग दिखा रहा है`;
  return `Campus map of ${locationLabel}, showing your current position and route`;
}
