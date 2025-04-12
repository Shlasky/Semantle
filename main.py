from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import numpy as np
import random
import os
import pickle
from gensim.models import Word2Vec, KeyedVectors
import threading
from typing import List, Dict, Optional, Any

app = FastAPI(title="Hebrew Semantle API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
MODEL_PATH = 'models/model.mdl'
CACHE_FILE = 'similarity_cache.pkl'
MAX_ACTIVE_WORDS = 999_999_999
PRECOMPUTE_NEAREST = 1000
MIN_WORD_LENGTH = 3

# Global variables
model = None
words_list = []
target_word = 'חמאה'
similarity_cache = {}
nearest_words = []
initialization_status = {"initialized": False, "stage": "not_started", "message": "Initialization not started"}

# Models
class GuessRequest(BaseModel):
    guess: str

class ConfigRequest(BaseModel):
    max_active_words: Optional[int] = None
    precompute_nearest: Optional[int] = None
    min_word_length: Optional[int] = None

class GameStatus(BaseModel):
    initialized: bool
    stage: str
    message: str
    words_count: Optional[int] = None
    nearest_words_count: Optional[int] = None

class GuessResponse(BaseModel):
    similarity: float
    percentile: float
    rank: int
    total_words: int
    correct: bool
    message: Optional[str] = None

class ConfigResponse(BaseModel):
    success: bool
    message: str
    config: Dict[str, Any]

# Helper Functions
def load_model():
    """Load the Gensim word embedding model for Hebrew."""
    global model, initialization_status
    
    initialization_status = {"initialized": False, "stage": "loading_model", "message": "Loading language model..."}
    
    print("Loading Gensim model...")
    try:
        # Try different methods to load the model
        if os.path.exists(MODEL_PATH):
            try:
                # Method 1: Full Word2Vec model
                model_obj = Word2Vec.load(MODEL_PATH)
                model = model_obj.wv
                print("Loaded as full Word2Vec model")
            except Exception as e:
                print(f"Failed to load as full model: {e}")
                try:
                    # Method 2: KeyedVectors
                    model = KeyedVectors.load(MODEL_PATH)
                    print("Loaded as KeyedVectors")
                except Exception as e:
                    print(f"Failed to load as KeyedVectors: {e}")
                    return
        else:
            print(f"Model file {MODEL_PATH} not found!")
            return
        
        print(f"Model loaded with {len(model.key_to_index)} words")
    except Exception as e:
        print(f"Error loading model: {e}")
        model = None

def load_words():
    """Load words directly from the Gensim model."""
    global words_list, initialization_status
    
    initialization_status = {"initialized": False, "stage": "loading_words", "message": "Loading words..."}
    
    if not model:
        print("Model not loaded yet, cannot load words.")
        words_list = []
        return
    
    print("Extracting words from Gensim model...")
    
    # Get all Hebrew words from the model
    all_words = list(model.key_to_index.keys())
    
    # Filter for Hebrew words only
    all_hebrew_words = []
    for word in all_words:
        # Filter for Hebrew words (contains Hebrew unicode characters)
        if any(1424 <= ord(c) <= 1514 for c in word) and len(word) >= MIN_WORD_LENGTH:
            all_hebrew_words.append(word)
    
    print(f"Found {len(all_hebrew_words)} Hebrew words in model.")
    
    # Limit to MAX_ACTIVE_WORDS by random sampling
    if len(all_hebrew_words) > MAX_ACTIVE_WORDS:
        words_list = random.sample(all_hebrew_words, MAX_ACTIVE_WORDS)
        print(f"Randomly selected {MAX_ACTIVE_WORDS} words for active gameplay.")
    else:
        words_list = all_hebrew_words

def load_cache():
    """Load pre-computed similarity cache if it exists."""
    global similarity_cache
    
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'rb') as f:
                similarity_cache = pickle.load(f)
            print(f"Loaded similarity cache with {len(similarity_cache)} entries.")
        except Exception as e:
            print(f"Error loading cache: {e}")
            similarity_cache = {}
    else:
        similarity_cache = {}

def choose_target_word():
    """Select a random target word for the game."""
    global target_word, nearest_words, initialization_status
    
    initialization_status = {"initialized": False, "stage": "selecting_word", "message": "Selecting target word..."}
    
    # Choose a word that's in the model vocabulary
    candidates = [word for word in words_list if word in model]
    if not candidates:
        print("No valid words found in both word list and model vocabulary.")
        return
    if not target_word:
        target_word = random.choice(candidates)
    print(f"Selected target word: {target_word}")
    
    # Pre-calculate the nearest words for the given target
    compute_nearest_words()

def compute_similarity(word1, word2):
    """Compute cosine similarity between two words."""
    if word1 not in model or word2 not in model:
        return -100  # Word not in vocabulary
    
    try:
        # Gensim has built-in similarity calculation
        similarity = model.similarity(word1, word2)
        return similarity
    except Exception as e:
        print(f"Error computing similarity: {e}")
        return -100

def compute_nearest_words():
    """Find the nearest words to the target for ranking."""
    global nearest_words, initialization_status
    
    # Only compute if we haven't already or if target has changed
    cache_key = f"nearest_{target_word}"
    if cache_key in similarity_cache:
        nearest_words = similarity_cache[cache_key]
        print(f"Loaded {len(nearest_words)} nearest words from cache.")
        initialization_status = {"initialized": True, "stage": "ready", "message": "Game ready"}
        return
    
    print(f"Computing nearest words to {target_word}...")
    similarities = []
    
    # First compute similarity for all words in our active vocabulary
    for word in words_list:
        if word in model:
            sim = compute_similarity(target_word, word)
            similarities.append((word, sim))
    
    # Sort by similarity (highest to lowest)
    nearest_words = sorted(similarities, key=lambda x: x[1], reverse=True)
    
    # Limit to top PRECOMPUTE_NEAREST words to save memory
    nearest_words = nearest_words[:PRECOMPUTE_NEAREST]
    
    # Cache the result
    similarity_cache[cache_key] = nearest_words
    
    # Save cache periodically (not on every computation to avoid I/O overhead)
    if len(similarity_cache) % 10 == 0:
        try:
            with open(CACHE_FILE, 'wb') as f:
                pickle.dump(similarity_cache, f)
        except Exception as e:
            print(f"Error saving cache: {e}")
    
    print(f"Computed and cached {len(nearest_words)} word similarities.")
    print_nearest_words(20)  # Print top 20 words for debugging
    
    initialization_status = {"initialized": True, "stage": "ready", "message": "Game ready"}

def get_rank(guess_word):
    """Get the exact rank of the guess among all words (1 is closest)."""
    if not nearest_words:
        return 0
    
    # Find the position of the guess in the sorted list (1-based index)
    for i, (word, _) in enumerate(nearest_words):
        if word == guess_word:
            return i + 1
    
    return len(nearest_words)  # Word not found in the nearest words

def print_nearest_words(n=20):
    """Print the top n nearest words to the target word."""
    if not target_word or not nearest_words:
        print("Target word or nearest words not available yet.")
        return
        
    print(f"\nTop {n} nearest words to '{target_word}':")
    print("-" * 40)
    print(f"{'Rank':<6}{'Word':<20}{'Similarity':<10}")
    print("-" * 40)
    
    for i, (word, similarity) in enumerate(nearest_words[:n]):
        print(f"{i+1:<6}{word:<20}{similarity*100:.2f}")
    print("-" * 40)

def initialize():
    """Initialize the game on startup."""
    global model, words_list, target_word, initialization_status
    
    try:
        print("Starting initialization...")
        load_model()
        if model:
            load_words()
            load_cache()
            choose_target_word()
            print("Initialization complete!")
        else:
            initialization_status = {"initialized": False, "stage": "error", "message": "Failed to load model"}
    except Exception as e:
        print(f"Initialization error: {e}")
        initialization_status = {"initialized": False, "stage": "error", "message": f"Error: {str(e)}"}

# Start initialization in background
threading.Thread(target=initialize).start()

# Routes
@app.get("/api/status", response_model=GameStatus)
async def get_status():
    """Return the current initialization status."""
    status = initialization_status.copy()
    
    # Add additional information if initialized
    if status["initialized"]:
        status["words_count"] = len(words_list)
        status["nearest_words_count"] = len(nearest_words)
    
    return status

@app.post("/api/guess", response_model=GuessResponse)
async def guess(request: GuessRequest):
    """Process a word guess and return similarity information."""
    if not initialization_status["initialized"]:
        raise HTTPException(status_code=503, detail="Game not initialized yet")
    
    guess_word = request.guess.strip()
    
    if not guess_word:
        raise HTTPException(status_code=400, detail="Empty guess")
    
    if guess_word not in model:
        return {
            "similarity": -100,
            "percentile": 0,
            "rank": PRECOMPUTE_NEAREST,
            "total_words": PRECOMPUTE_NEAREST,
            "message": "המילה אינה במילון המשחק",
            "correct": False
        }
    
    # Compute similarity
    similarity = compute_similarity(guess_word, target_word)
    rank = get_rank(guess_word)
    percentile = 100 * (1 - (rank / len(nearest_words))) if nearest_words else 0
    
    # Check if correct
    is_correct = (guess_word == target_word)
    
    response = {
        "similarity": round(similarity * 100, 2),  # Scale to percentage
        "percentile": round(percentile, 2),
        "rank": rank,
        "total_words": len(nearest_words),
        "correct": is_correct
    }
    
    if is_correct:
        response["message"] = "כל הכבוד! מצאת את המילה!"  # Congratulations! You found the word!
    
    return response

@app.post("/api/new_game", response_model=dict)
async def new_game():
    """Start a new game with a new target word."""
    if not initialization_status["initialized"]:
        raise HTTPException(status_code=503, detail="Game not initialized yet")
    
    choose_target_word()
    return {"success": True, "message": "משחק חדש התחיל"}  # New game started

@app.get("/api/hint", response_model=dict)
async def get_hint():
    """Get the first letter of the target word as a hint."""
    if not initialization_status["initialized"]:
        raise HTTPException(status_code=503, detail="Game not initialized yet")
    
    if target_word:
        return {"hint": target_word[0]}
    
    raise HTTPException(status_code=500, detail="No target word set")

@app.get("/api/config", response_model=dict)
async def get_config():
    """Get current configuration values."""
    return {
        "max_active_words": MAX_ACTIVE_WORDS,
        "precompute_nearest": PRECOMPUTE_NEAREST,
        "min_word_length": MIN_WORD_LENGTH
    }

@app.post("/api/config", response_model=ConfigResponse)
async def update_config(request: ConfigRequest):
    """Update game configuration."""
    global MAX_ACTIVE_WORDS, PRECOMPUTE_NEAREST, MIN_WORD_LENGTH
    
    # Update configuration if provided
    if request.max_active_words is not None:
        MAX_ACTIVE_WORDS = request.max_active_words
    if request.precompute_nearest is not None:
        PRECOMPUTE_NEAREST = request.precompute_nearest
    if request.min_word_length is not None:
        MIN_WORD_LENGTH = request.min_word_length
    
    # Re-initialize with new settings
    threading.Thread(target=initialize).start()
    
    return {
        "success": True,
        "message": "מאתחל מחדש עם הגדרות חדשות",
        "config": {
            "max_active_words": MAX_ACTIVE_WORDS,
            "precompute_nearest": PRECOMPUTE_NEAREST,
            "min_word_length": MIN_WORD_LENGTH
        }
    }

# Mount the static files directory
try:
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
except Exception as e:
    print(f"Warning: Could not mount static files - {e}")
    print("Make sure to create a 'static' directory with your frontend files")

# Run standalone if executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)