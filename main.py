import os
import uuid
import re
import traceback
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from mistralai.client import Mistral
from mistralai.client.errors.sdkerror import SDKError
from supabase import create_client, Client

# ══════════════════════════════════════════════════════════════════
#  APP SETUP
# ══════════════════════════════════════════════════════════════════
app = FastAPI(
    title="Milo Engine",
    description="Campus gig marketplace AI orchestration — Mistral structured output",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

MISTRAL_API_KEY = os.getenv("VITE_MISTRAL_API_KEY")
mistral_client = Mistral(api_key=MISTRAL_API_KEY)


# ══════════════════════════════════════════════════════════════════
#  REAL DEMO PROFILES REGISTRY
# ══════════════════════════════════════════════════════════════════
MOCK_PROFILES = [
    { 'name': 'Alex Chen', 'tags': ['Tech/AI', 'Programming', 'Web Development'], 'loc': 'Engineering Quad' },
    { 'name': 'Jordan Smith', 'tags': ['Fitness', 'Sports Training', 'Nutrition'], 'loc': 'Athletic Center' },
    { 'name': 'Maya Patel', 'tags': ['Indie Music', 'Graphic Design', 'Photography'], 'loc': 'Arts Building' },
    { 'name': 'Liam Torres', 'tags': ['Gamer', 'Streaming', 'Tech Support'], 'loc': 'North Campus' },
    { 'name': 'Priya Rao', 'tags': ['Culinary Arts', 'Food & Grocery', 'Event Planning'], 'loc': 'Student Union' },
    { 'name': 'Kai Nakamura', 'tags': ['Tech/AI', 'Gamer', 'Robotics'], 'loc': 'East Hall' },
    { 'name': 'Zara Okonkwo', 'tags': ['Fitness', 'Dance', 'Photography'], 'loc': 'South Dorms' },
    { 'name': 'Diego Reyes', 'tags': ['Culinary Arts', 'Music Production', 'Cleaning'], 'loc': 'West Village' },
    { 'name': 'Luna Park', 'tags': ['Indie Music', 'Graphic Design', 'Creative Writing'], 'loc': 'Library' },
    { 'name': 'Raj Gupta', 'tags': ['Programming', 'Tech/AI', 'Tutoring'], 'loc': 'Engineering Quad' },
    { 'name': 'Ava Williams', 'tags': ['Pet Care', 'Fitness', 'Errands'], 'loc': 'North Campus' },
    { 'name': 'Marcus Brown', 'tags': ['Moving & Lifting', 'Fitness', 'Culinary Arts'], 'loc': 'East Hall' },
    { 'name': 'Sofia Martinez', 'tags': ['Photography', 'Event Help', 'Graphic Design'], 'loc': 'Student Union' },
    { 'name': 'Ethan Lee', 'tags': ['Tech Support', 'Programming', 'Gamer'], 'loc': 'South Dorms' },
    { 'name': 'Chloe Kim', 'tags': ['Tutoring', 'Creative Writing', 'Indie Music'], 'loc': 'Library' },
    { 'name': 'Omar Hassan', 'tags': ['Culinary Arts', 'Event Planning', 'Fitness'], 'loc': 'West Village' },
    { 'name': 'Ruby Taylor', 'tags': ['Photography', 'Videography', 'Indie Music'], 'loc': 'Arts Building' },
    { 'name': 'James Chen', 'tags': ['Car Maintenance', 'Tech Support', 'Errands'], 'loc': 'Parking Garage' },
    { 'name': 'Isla Murphy', 'tags': ['Pet Care', 'Culinary Arts', 'Cleaning'], 'loc': 'North Campus' },
    { 'name': 'Leo Schmidt', 'tags': ['Moving & Lifting', 'Fitness', 'Gamer'], 'loc': 'East Hall' },
]


# ══════════════════════════════════════════════════════════════════
#  REQUEST / RESPONSE MODELS
# ══════════════════════════════════════════════════════════════════
class ChatMessagePayload(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text")

class PaymentRange(BaseModel):
    min: int
    max: int

class UserProfile(BaseModel):
    user_id: str
    role: str  # 'finder', 'worker', or 'both'
    location: str
    max_walk_time_mins: int
    payment_range: PaymentRange
    skills_interests: List[str]

class ContextualChatPayload(BaseModel):
    session_id: str
    messages: List[ChatMessagePayload]
    user_profile: UserProfile

class MatchResult(BaseModel):
    id: str
    matched_user_name: str
    matched_user_id: str
    match_score: int
    title: str
    category: str
    pay_min: int
    pay_max: int
    campus_location: str
    walk_time_mins: int
    description: str
    decision: Optional[str] = None
    escrow_status: str = "pending"

class DirectivePayload(BaseModel):
    action: str

class MiloResponse(BaseModel):
    success: bool
    message: str
    milo_response: str
    matches: List[MatchResult] = Field(default_factory=list)
    awaiting_confirmation: bool = False
    slots_detected: Dict[str, Any] = Field(default_factory=dict)
    directive: DirectivePayload


# ══════════════════════════════════════════════════════════════════
#  MISTRAL STRUCTURED OUTPUT SCHEMA
# ══════════════════════════════════════════════════════════════════
class GigSlotTracker(BaseModel):
    extracted_intent: Optional[str] = Field(None, description="'find' (seeking work to earn money) or 'post' (hiring someone).")
    extracted_task_or_skill: Optional[str] = None
    extracted_location: Optional[str] = None
    extracted_pay_max: Optional[int] = None
    extracted_walk_time_mins: Optional[int] = None
    extracted_category: Optional[str] = None
    awaiting_confirmation: bool = False
    confirmed: bool = False
    slots_fully_complete: bool = False
    conversational_response: str


# ══════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT
# ══════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """You are Milo, a warm and efficient campus gig marketplace assistant.
Your SOLE purpose is to help users FIND gigs (earn money) or POST gigs (get help).

STEP 1 — COLLECT SLOTS
Collect these in order, asking ONE question at a time for any that are missing:
  Slot A  intent             Crucial: Are they looking to FIND work (earn money) or POST a gig (hire help)? Extract as 'find' or 'post'.
  Slot B  task_or_skill      What task or skill is needed?
  Slot C  location           Which campus location?
  Slot D  pay_max            What is the budget / pay rate? (extract number in USD)
  Slot E  walk_time_mins     Max walking distance in minutes?

EXTRACTION CONSTRAINTS:
• Read the ENTIRE message history to track parameters across conversational turns.
• Do not repeat questions or re-ask for variables established in earlier turns.

STEP 2 — CONFIRM
Once ALL required slots are filled, summarise and ask for confirmation:
  "Here's what I have: [task] at [location], up to $[pay]/hr, within [walk] mins walk. Want me to find matches now?"
Set awaiting_confirmation = True. Do NOT set confirmed = True or slots_fully_complete = True yet.

STEP 3 — SEARCH
If user responds affirmatively (e.g., 'yes', 'sure', 'go for it'):
  → Set confirmed = True, slots_fully_complete = True, awaiting_confirmation = False
  → conversational_response = "Great! Searching for the best matches for you right now..."
"""

CONFIRM_TOKENS = {
    "yes", "yep", "yeah", "yup", "sure", "ok", "okay", "go", "go ahead",
    "do it", "find them", "find matches", "search", "search now", "looks good",
    "correct", "right", "exactly", "absolutely", "perfect", "great",
    "sounds good", "proceed", "let's go", "lets go", "show me", "find",
}

CATEGORY_MAP = {
    "tutoring": "Academic Help", "study": "Academic Help", "homework": "Academic Help",
    "moving": "Physical Tasks", "cleaning": "Physical Tasks", "lifting": "Physical Tasks",
    "design": "Creative Work", "video": "Creative Work", "coding": "Tech Support",
}

CONFIRMATION_PROMPT_SIGNALS = ["want me to find matches", "shall i search", "ready to search", "search now"]

def last_assistant_was_confirmation_prompt(messages: List[ChatMessagePayload]) -> bool:
    last_assistant = next((m.content for m in reversed(messages) if m.role == "assistant"), "")
    if not last_assistant:
        return False
    lower = last_assistant.lower()
    return any(signal in lower for signal in CONFIRMATION_PROMPT_SIGNALS)

def user_msg_is_affirmative(last_user_msg: str) -> bool:
    cleaned = last_user_msg.lower().strip().rstrip("!.?,")
    if cleaned in CONFIRM_TOKENS:
        return True
    words = cleaned.split()
    if len(words) <= 5:
        return any(cleaned.startswith(token) for token in CONFIRM_TOKENS)
    return False

def server_side_confirmed(last_user_msg: str, messages: List[ChatMessagePayload], state: GigSlotTracker) -> bool:
    return (
        state.extracted_task_or_skill is not None
        and state.extracted_pay_max is not None
        and last_assistant_was_confirmation_prompt(messages)
        and user_msg_is_affirmative(last_user_msg)
    )

def resolve_category(task: Optional[str], extracted: Optional[str]) -> str:
    if extracted and extracted != "Other":
        return extracted
    if not task:
        return "Other"
    task_lower = task.lower()
    for keyword, category in CATEGORY_MAP.items():
        if keyword in task_lower:
            return category
    return "Other"

def build_match(raw: dict, task_label: str, category: str, pay_min: int, pay_max: int, location: str, walk: int) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "matched_user_name": raw.get("matched_user_name", "Campus Client"),
        "matched_user_id": raw.get("matched_user_id", f"mock-{uuid.uuid4().hex[:6]}"),
        "match_score": raw.get("match_score", 95),
        "title": raw.get("title", f"{task_label} Support"),
        "category": category,
        "pay_min": raw.get("pay_min", pay_min),
        "pay_max": int(raw.get("pay_max", pay_max)),
        "campus_location": raw.get("campus_location", location),
        "walk_time_mins": raw.get("walk_time_mins", walk),
        "description": raw.get("description", "Verified campus account with an active demo profile linked."),
        "decision": None,
        "escrow_status": "pending",
    }


# ══════════════════════════════════════════════════════════════════
#  MOCK MATCHES FUNCTION WITH STABLE DETERMINISTIC UUIDs
# ══════════════════════════════════════════════════════════════════
def mock_matches(task_label: str, category: str, pay_min: int, pay_max: int, location: str, walk: int, resolved_user_role: str) -> List[dict]:
    """
    Scans the true local MOCK_PROFILES list and returns actual accounts that 
    partially match either the target location or keywords in the task.
    Uses structural UUIDv5 transformations to satisfy database constraints 
    while establishing reliable links across frontend dashboards.
    """
    matched_peers = []
    task_lower = task_label.lower()
    loc_lower = location.lower() if location else ""

    # Filter and score profiles from the real static list
    for profile in MOCK_PROFILES:
        score = 70
        if loc_lower and loc_lower in profile['loc'].lower():
            score += 15
        tag_match = False
        for tag in profile['tags']:
            if tag.lower() in task_lower or task_lower in tag.lower():
                tag_match = True
                score += 15
        if (loc_lower in profile['loc'].lower()) or tag_match:
            matched_peers.append((profile['name'], min(score, 98), profile['loc']))

    # Fallback to defaults if no location/tag intersection matches
    if not matched_peers:
        matched_peers = [
            (MOCK_PROFILES[4]['name'], 95, MOCK_PROFILES[4]['loc']), # Priya Rao
            (MOCK_PROFILES[8]['name'], 91, MOCK_PROFILES[8]['loc']), # Luna Park
            (MOCK_PROFILES[14]['name'], 88, MOCK_PROFILES[14]['loc']), # Chloe Kim
        ]

    role_flag = "Client" if resolved_user_role == "worker" else "Helper"
    title_suffix = "Needed" if resolved_user_role == "worker" else "Provider"

    # Base seed namespace to generate deterministic structural UUIDs from text strings
    NAMESPACE_MILO = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')

    # Global mapping to lock specific characters to your application's expected view parameters
    deterministic_match_ids = {
        "luna-park": "b636f69d-7ca2-48df-9cde-9a84594efdf2",
        "chloe-kim": "c138f71a-28bc-499d-81fe-0a91638fedb1",
        "priya-rao": "a42948cf-3cbe-41de-bb47-195cbb41aa04"
    }

    results = []
    for name, score, loc in matched_peers[:3]:
        slug_name = name.lower().replace(' ', '-')
        
        # Converts text strings into database-acceptable UUID structures cleanly
        assigned_user_id = str(uuid.uuid5(NAMESPACE_MILO, f"user-{slug_name}"))
        
        # Use existing frontend intercept hashes if available, else derive cleanly
        if slug_name in deterministic_match_ids:
            generated_match_id = deterministic_match_ids[slug_name]
        else:
            generated_match_id = str(uuid.uuid5(NAMESPACE_MILO, f"match-live-{slug_name}"))
        
        results.append({
            "id": generated_match_id,
            "matched_user_name": f"{name} ({role_flag})",
            "matched_user_id": assigned_user_id,
            "match_score": score,
            "title": f"{task_label} {title_suffix}",
            "category": category,
            "pay_min": pay_min,
            "pay_max": pay_max,
            "campus_location": loc,
            "walk_time_mins": walk if walk > 0 else 10,
            "description": f"Active profile matching your criteria at {loc}. Log in directly to simulate message handshakes.",
            "decision": None,
            "escrow_status": "pending",
        })
    return results

def build_messages(messages: List[ChatMessagePayload]) -> List[Dict[str, str]]:
    out = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in messages:
        api_role = "assistant" if m.role in ["assistant", "agent"] else "user"
        out.append({"role": api_role, "content": m.content})
    return out


# ══════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "version": "2.0.0"}

@app.post("/api/chat", response_model=MiloResponse, tags=["Milo Agent"])
async def process_milo_agent_routing(payload: ContextualChatPayload):
    if not payload.messages:
        raise HTTPException(status_code=422, detail="messages array cannot be empty")

    last_user_msg = next((m.content for m in reversed(payload.messages) if m.role == "user"), "")

    try:
        mistral_analysis = mistral_client.chat.parse(
            model="mistral-large-latest",
            messages=build_messages(payload.messages),
            response_format=GigSlotTracker,
            temperature=0.15,
        )
        state: Optional[GigSlotTracker] = mistral_analysis.choices[0].message.parsed
    except SDKError as sdk_err:
        traceback.print_exc()
        if "429" in str(sdk_err):
            raise HTTPException(status_code=429, detail="Mistral API Rate Limit exceeded. Please slow down your requests.")
        raise HTTPException(status_code=502, detail=f"Mistral SDK Error: {str(sdk_err)}")
    except Exception as mistral_err:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Mistral API error: {str(mistral_err)}")

    if state is None:
        raise HTTPException(status_code=502, detail="Mistral returned an empty parse result")

    # Determine dynamic role if user selected 'both' in profile
    resolved_role = payload.user_profile.role.lower()
    if resolved_role == "both":
        if state.extracted_intent in ["find", "search", "work", "worker"]:
            resolved_role = "worker"
        elif state.extracted_intent in ["post", "hire", "finder"]:
            resolved_role = "finder"

    # Block progression if 'both' users haven't clarified their intent yet
    intent_missing = (payload.user_profile.role.lower() == "both" and resolved_role == "both")

    server_confirm = server_side_confirmed(last_user_msg, payload.messages, state)
    if server_confirm and not state.confirmed and not intent_missing:
        state.confirmed = True
        state.slots_fully_complete = True
        state.awaiting_confirmation = False
        state.conversational_response = "Great! Searching for the best matches for you right now..."

    slots_debug = {
        "intent": state.extracted_intent,
        "task": state.extracted_task_or_skill,
        "location": state.extracted_location,
        "pay_max": state.extracted_pay_max,
        "walk_time_mins": state.extracted_walk_time_mins,
        "category": state.extracted_category,
        "awaiting_confirmation": state.awaiting_confirmation,
        "confirmed": state.confirmed,
        "slots_fully_complete": state.slots_fully_complete,
        "server_confirm_override": server_confirm,
        "resolved_role": resolved_role
    }

    if not state.slots_fully_complete or not state.confirmed or intent_missing:
        # If intent is still missing, force Milo to ask
        if intent_missing and "?" not in state.conversational_response:
            state.conversational_response = "I can definitely help with that! Quick question: are you looking to earn money by doing this task, or are you looking to hire someone to do it for you?"

        return MiloResponse(
            success=True,
            message=state.conversational_response,
            milo_response=state.conversational_response,
            matches=[],
            awaiting_confirmation=state.awaiting_confirmation,
            slots_detected=slots_debug,
            directive=DirectivePayload(action="fill_param"),
        )

    task_label = state.extracted_task_or_skill or "Campus Help"
    location = state.extracted_location or payload.user_profile.location
    pay_max = int(state.extracted_pay_max or payload.user_profile.payment_range.max)
    pay_min = payload.user_profile.payment_range.min
    walk = int(state.extracted_walk_time_mins or payload.user_profile.max_walk_time_mins)
    category = resolve_category(state.extracted_task_or_skill, state.extracted_category)
    action = "post_gig" if resolved_role == "finder" else "search_gigs"

    formatted_matches: List[dict] = []
    try:
        db_resp = supabase_client.rpc(
            "match_campus_gigs",
            {
                "client_location": location,
                "client_max_walk": walk,
                "client_pay_max": pay_max,
                "client_skills": [task_label],
            },
        ).execute()
        raw_rows = getattr(db_resp, "data", []) or []
        formatted_matches = [
            build_match(r, task_label, category, pay_min, pay_max, location, walk)
            for r in raw_rows
        ]
    except Exception as db_err:
        print(f"[Supabase Fallback Activated] Reason: {db_err}")

    if not formatted_matches:
        formatted_matches = mock_matches(task_label, category, pay_min, pay_max, location, walk, resolved_role)

    return MiloResponse(
        success=True,
        message=state.conversational_response,
        milo_response=state.conversational_response,
        matches=[MatchResult(**m) for m in formatted_matches],
        awaiting_confirmation=False,
        slots_detected=slots_debug,
        directive=DirectivePayload(action=action),
    )


@app.post("/api/milo-agent-match", response_model=MiloResponse, include_in_schema=False)
async def legacy_milo_agent_match_alias(payload: ContextualChatPayload):
    return await process_milo_agent_routing(payload)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 10000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)