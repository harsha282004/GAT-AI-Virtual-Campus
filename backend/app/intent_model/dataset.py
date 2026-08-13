"""Phase 10 — Intent classifier training data.

HONESTY NOTE (read before assuming this is real user-query traffic): this
is a small, hand-authored SYNTHETIC seed dataset, not logged real user
queries — this project has no query logs to train from. Each example was
written to cover genuine paraphrase variety for a fixed set of intents, in
the same spirit as Phase 2's build_kb.py relabeling a Kaggle CSV into
GAT-branded content: an honest, clearly-labelled bootstrap dataset, not a
claim of production-scale training data. See Phase 10's own review report
for the model's measured (not assumed) held-out accuracy.

INTENTS map directly onto specialist agents for routing purposes (see
classify.py's INTENT_TO_AGENT), but are deliberately more fine-grained than
the 5 agents so the classifier reports a genuinely useful intent label
(e.g. distinguishing ROOM_LOCATION from DEPARTMENT_LOCATION) even though
several intents currently route to the same agent.
"""

from __future__ import annotations

INTENTS = [
    "ADMISSIONS",
    "COURSES",
    "DEPARTMENTS",
    "ACADEMICS",
    "FACILITIES",
    "ROOM_LOCATION",
    "DEPARTMENT_LOCATION",
    "LABORATORY_LOCATION",
    "VIRTUAL_TOUR",
    "CAMPUS_INFO",
    "GENERAL",
    "UNKNOWN",
]

# (text, intent) pairs. Deliberately includes the Phase 10 spec's own
# paraphrase test groups (Section 16) — the whole point of this model is to
# recognize exactly this kind of variation — plus additional held-out-style
# variants not copied from the spec, so evaluation isn't purely memorizing
# the literal spec examples.
TRAINING_EXAMPLES: list[tuple[str, str]] = [
    # ---- ADMISSIONS ----
    ("What is the admission process?", "ADMISSIONS"),
    ("How do I apply for admission?", "ADMISSIONS"),
    ("What are the admission requirements?", "ADMISSIONS"),
    ("How can I get admitted to GAT?", "ADMISSIONS"),
    ("What is the eligibility criteria for admission?", "ADMISSIONS"),
    ("Tell me about the KCET counselling process.", "ADMISSIONS"),
    ("What entrance exams are accepted?", "ADMISSIONS"),
    ("How do I join this college?", "ADMISSIONS"),
    ("What is the cutoff for admission?", "ADMISSIONS"),
    ("Is COMEDK accepted for admission?", "ADMISSIONS"),
    ("What documents are needed to apply?", "ADMISSIONS"),
    ("When does the admission process start?", "ADMISSIONS"),
    ("Explain the seat matrix for admissions.", "ADMISSIONS"),
    ("Can I get admission through management quota?", "ADMISSIONS"),
    ("What is the application procedure for GAT?", "ADMISSIONS"),
    # ---- COURSES ----
    ("What courses are available?", "COURSES"),
    ("What programs does GAT offer?", "COURSES"),
    ("Which courses can I study?", "COURSES"),
    ("What engineering branches are offered?", "COURSES"),
    ("What all courses are there in the college?", "COURSES"),
    ("What can I study here?", "COURSES"),
    ("What undergraduate programs are offered?", "COURSES"),
    ("Tell me the list of courses at GAT.", "COURSES"),
    ("What degrees does the college offer?", "COURSES"),
    ("Which UG and PG programs are available?", "COURSES"),
    ("What B.E. programs are there?", "COURSES"),
    ("Does GAT offer an MBA program?", "COURSES"),
    ("What is the duration of the courses?", "COURSES"),
    ("What subjects are taught in first year?", "COURSES"),
    # ---- DEPARTMENTS ----
    ("What departments does GAT offer?", "DEPARTMENTS"),
    ("What departments are available in GAT?", "DEPARTMENTS"),
    ("Which departments are there?", "DEPARTMENTS"),
    ("What branches are offered?", "DEPARTMENTS"),
    ("Tell me the departments in the college.", "DEPARTMENTS"),
    ("Which engineering departments exist at GAT?", "DEPARTMENTS"),
    ("How many departments does the college have?", "DEPARTMENTS"),
    ("List all the departments at GAT.", "DEPARTMENTS"),
    ("What academic departments are there?", "DEPARTMENTS"),
    ("Does GAT have a Computer Science department?", "DEPARTMENTS"),
    # ---- ACADEMICS (general academic questions not about a course/department list) ----
    ("What is the syllabus for CSE?", "ACADEMICS"),
    ("Who are the faculty members in ECE?", "ACADEMICS"),
    ("How many semesters are there in the B.E. program?", "ACADEMICS"),
    ("What is the curriculum structure?", "ACADEMICS"),
    ("Tell me about the academic calendar.", "ACADEMICS"),
    ("What specializations are offered in M.Tech?", "ACADEMICS"),
    ("How is the grading system structured?", "ACADEMICS"),
    ("What is the medium of instruction?", "ACADEMICS"),
    # ---- FACILITIES ----
    ("What facilities are available on campus?", "FACILITIES"),
    ("Does the college have a hostel?", "FACILITIES"),
    ("Is there a gym on campus?", "FACILITIES"),
    ("What sports facilities are available?", "FACILITIES"),
    ("Tell me about the canteen.", "FACILITIES"),
    ("Is wifi available on campus?", "FACILITIES"),
    ("What transport facilities does GAT provide?", "FACILITIES"),
    ("Does the campus have bus routes?", "FACILITIES"),
    ("What amenities are available for students?", "FACILITIES"),
    ("Tell me about the campus infrastructure.", "FACILITIES"),
    # ---- ROOM_LOCATION ----
    ("Where is room 202?", "ROOM_LOCATION"),
    ("Where is room no 202?", "ROOM_LOCATION"),
    ("Which floor is room 202 on?", "ROOM_LOCATION"),
    ("Where can I find 202?", "ROOM_LOCATION"),
    ("Tell me the location of room number 202.", "ROOM_LOCATION"),
    ("Where is room 303?", "ROOM_LOCATION"),
    ("Where can I find room 303?", "ROOM_LOCATION"),
    ("Which floor is 303?", "ROOM_LOCATION"),
    ("Tell me about room number 303.", "ROOM_LOCATION"),
    ("Where's room 201?", "ROOM_LOCATION"),
    ("Room 310 is on which floor?", "ROOM_LOCATION"),
    ("What floor is room no. 405 on?", "ROOM_LOCATION"),
    ("Locate room 112 for me.", "ROOM_LOCATION"),
    ("Which room is 419B?", "ROOM_LOCATION"),
    # ---- DEPARTMENT_LOCATION ----
    ("Where is the CSE department?", "DEPARTMENT_LOCATION"),
    ("Where is ISE?", "DEPARTMENT_LOCATION"),
    ("Which floor is ECE on?", "DEPARTMENT_LOCATION"),
    ("Where is the mechanical department located?", "DEPARTMENT_LOCATION"),
    ("Tell me the location of the EEE department.", "DEPARTMENT_LOCATION"),
    ("Where can I find the AI&DS department?", "DEPARTMENT_LOCATION"),
    ("Where is the HOD office of CSE?", "DEPARTMENT_LOCATION"),
    ("Which floor is the Chemistry department on?", "DEPARTMENT_LOCATION"),
    # ---- LABORATORY_LOCATION ----
    ("Where is the Power System Simulation Lab?", "LABORATORY_LOCATION"),
    ("Where is the Chemistry Lab?", "LABORATORY_LOCATION"),
    ("Which floor is the Computer Lab on?", "LABORATORY_LOCATION"),
    ("Where can I find the Electrical Machines Lab?", "LABORATORY_LOCATION"),
    ("Tell me the location of the Von Neumann Lab.", "LABORATORY_LOCATION"),
    ("Where is the Server Room?", "LABORATORY_LOCATION"),
    ("Where are the washrooms?", "LABORATORY_LOCATION"),
    ("Where is the nearest toilet?", "LABORATORY_LOCATION"),
    # ---- VIRTUAL_TOUR ----
    ("Show me the panorama for the library.", "VIRTUAL_TOUR"),
    ("What does the campus look like?", "VIRTUAL_TOUR"),
    ("Can I take a virtual tour of the campus?", "VIRTUAL_TOUR"),
    ("Show me the 360 view of the entrance.", "VIRTUAL_TOUR"),
    ("What panorama should I open next?", "VIRTUAL_TOUR"),
    ("Let me explore the campus virtually.", "VIRTUAL_TOUR"),
    # ---- CAMPUS_INFO ----
    ("What is the address of GAT?", "CAMPUS_INFO"),
    ("What is the official contact information?", "CAMPUS_INFO"),
    ("When was GAT established?", "CAMPUS_INFO"),
    ("What is the history of GAT?", "CAMPUS_INFO"),
    ("Is GAT NAAC accredited?", "CAMPUS_INFO"),
    ("What is the vision and mission of the college?", "CAMPUS_INFO"),
    ("Tell me about Global Academy of Technology.", "CAMPUS_INFO"),
    ("What is the phone number of the college?", "CAMPUS_INFO"),
    # ---- GENERAL ----
    ("Hi", "GENERAL"),
    ("Hello, how are you?", "GENERAL"),
    ("Who is the principal of GAT?", "GENERAL"),
    ("Tell me something interesting about GAT.", "GENERAL"),
    ("What can you help me with?", "GENERAL"),
    ("What is GAT?", "GENERAL"),
    # ---- UNKNOWN (clearly off-topic — must NOT be answered from GAT data) ----
    ("What is the capital of France?", "UNKNOWN"),
    ("What is the population of Bangalore?", "UNKNOWN"),
    ("How do I bake a chocolate cake?", "UNKNOWN"),
    ("Who won the FIFA World Cup?", "UNKNOWN"),
    ("What's the weather like today?", "UNKNOWN"),
    ("Tell me a joke.", "UNKNOWN"),
    # ---- additional paraphrase variety (held-out-style, not copied from
    # the Phase 10 spec's own examples) — improves generalization beyond
    # memorizing the spec's literal wording. ----
    ("How does one apply to GAT?", "ADMISSIONS"),
    ("What score do I need to get in?", "ADMISSIONS"),
    ("Is there a management quota seat available?", "ADMISSIONS"),
    ("What is the last date to apply?", "ADMISSIONS"),
    ("Do you accept GATE scores for PG admission?", "ADMISSIONS"),
    ("What are the eligibility marks required?", "ADMISSIONS"),
    ("What programs can I enroll in?", "COURSES"),
    ("List the engineering courses offered here.", "COURSES"),
    ("Does the college have a mechanical engineering course?", "COURSES"),
    ("What are the available UG degrees?", "COURSES"),
    ("Can I do an MBA at this college?", "COURSES"),
    ("What technical courses are on offer?", "COURSES"),
    ("What are all the branches in this college?", "DEPARTMENTS"),
    ("How many engineering branches does GAT run?", "DEPARTMENTS"),
    ("Name the departments at Global Academy of Technology.", "DEPARTMENTS"),
    ("Is there an Information Science department?", "DEPARTMENTS"),
    ("What branches of engineering are taught here?", "DEPARTMENTS"),
    ("Who teaches data structures in CSE?", "ACADEMICS"),
    ("What is the exam pattern?", "ACADEMICS"),
    ("How many credits are required to graduate?", "ACADEMICS"),
    ("What electives are offered in the final year?", "ACADEMICS"),
    ("Does the hostel have separate blocks for boys and girls?", "FACILITIES"),
    ("What indoor games are available?", "FACILITIES"),
    ("Is there a library on campus?", "FACILITIES"),
    ("Tell me about the laboratories available for students.", "FACILITIES"),
    ("Are campus buses available from Majestic?", "FACILITIES"),
    ("Where's room 213?", "ROOM_LOCATION"),
    ("Can you tell me where room 108 is?", "ROOM_LOCATION"),
    ("I need to find room number 306.", "ROOM_LOCATION"),
    ("What floor has room 417?", "ROOM_LOCATION"),
    ("Point me to room 110A.", "ROOM_LOCATION"),
    ("Room #305, where is it?", "ROOM_LOCATION"),
    ("Where is the ISE department located?", "DEPARTMENT_LOCATION"),
    ("On which floor is the EEE department?", "DEPARTMENT_LOCATION"),
    ("Find the location of the Mechanical department.", "DEPARTMENT_LOCATION"),
    ("Where is the Civil Engineering department?", "DEPARTMENT_LOCATION"),
    ("Where do I find the AI and ML department?", "DEPARTMENT_LOCATION"),
    ("Where is the Von Neumann Lab located?", "LABORATORY_LOCATION"),
    ("Which floor has the Big Data lab?", "LABORATORY_LOCATION"),
    ("Where is the nearest washroom?", "LABORATORY_LOCATION"),
    ("Find the Innovation Lab for me.", "LABORATORY_LOCATION"),
    ("Where can I see 360 photos of the campus?", "VIRTUAL_TOUR"),
    ("I want to explore the campus online.", "VIRTUAL_TOUR"),
    ("Give me a virtual walkthrough of the college.", "VIRTUAL_TOUR"),
    ("What is GAT's full form?", "CAMPUS_INFO"),
    ("Where is the college situated?", "CAMPUS_INFO"),
    ("Is the college affiliated to VTU?", "CAMPUS_INFO"),
    ("What accreditation does GAT hold?", "CAMPUS_INFO"),
    ("Good morning", "GENERAL"),
    ("Can you help me?", "GENERAL"),
    ("What can this chatbot do?", "GENERAL"),
    ("What is the recipe for biryani?", "UNKNOWN"),
    ("Who is the president of the United States?", "UNKNOWN"),
    ("What is 2 plus 2?", "UNKNOWN"),
    ("Tell me about the stock market.", "UNKNOWN"),
]

assert {intent for _, intent in TRAINING_EXAMPLES} == set(INTENTS), (
    "Every intent in INTENTS must have at least one training example, and "
    "vice versa — otherwise the classifier silently can never predict a "
    "whole class."
)
