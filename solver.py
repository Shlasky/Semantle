import numpy as np
from gensim.models import Word2Vec, KeyedVectors
import heapq
from collections import defaultdict
import argparse

class SemantleSolver:
    def __init__(self, model_path, top_n=20):
        """
        Initialize the Semantle solver with a word embedding model.
        
        Args:
            model_path: Path to the Gensim word embeddings model
            top_n: Number of suggestions to return
        """
        print("Loading word embedding model...")
        try:
            # Try loading as Word2Vec model
            self.model = Word2Vec.load(model_path)
            # If it's a full model, get the vectors part
            if hasattr(self.model, 'wv'):
                self.model = self.model.wv
            print("Loaded as Word2Vec model")
        except Exception as e:
            print(f"Failed to load as Word2Vec: {e}")
            try:
                # Try loading as KeyedVectors
                self.model = KeyedVectors.load(model_path)
                print("Loaded as KeyedVectors")
            except Exception as e:
                print(f"Failed to load as KeyedVectors: {e}")
                raise ValueError(f"Could not load model: {e}")
        
        self.top_n = top_n
        
        # Get vocabulary depending on the model version
        try:
            # Newer Gensim versions
            if hasattr(self.model, 'key_to_index'):
                vocabulary = list(self.model.key_to_index.keys())
            # Older Gensim versions
            elif hasattr(self.model, 'vocab'):
                vocabulary = list(self.model.vocab.keys())
            # Word2Vec models
            elif hasattr(self.model, 'wv') and hasattr(self.model.wv, 'vocab'):
                vocabulary = list(self.model.wv.vocab.keys())
            else:
                # Last resort - try to access index_to_key (newer versions) or index2word (older versions)
                if hasattr(self.model, 'index_to_key'):
                    vocabulary = self.model.index_to_key
                elif hasattr(self.model, 'index2word'):
                    vocabulary = self.model.index2word
                else:
                    raise AttributeError("Could not find vocabulary in model")
        except Exception as e:
            print(f"Error accessing vocabulary: {e}")
            vocabulary = []
        
        print(f"Model loaded with {len(vocabulary)} words")
        
        # Only keep Hebrew words in vocabulary
        self.hebrew_vocab = [w for w in vocabulary 
                           if any(1424 <= ord(c) <= 1514 for c in w)]
        print(f"Found {len(self.hebrew_vocab)} Hebrew words in vocabulary")
    
    def find_candidate_words(self, clues):
        """
        Find the most likely candidate words based on given clues.
        
        Args:
            clues: List of tuples (word, similarity_score)
            
        Returns:
            List of (word, score) pairs representing the best candidates
        """
        # Check if word is in model's vocabulary
        def word_in_model(word):
            try:
                # Try newer Gensim versions with key_to_index
                if hasattr(self.model, 'key_to_index'):
                    return word in self.model.key_to_index
                # Try older versions with vocab dictionary
                elif hasattr(self.model, 'vocab'):
                    return word in self.model.vocab
                # Try getting the vector directly
                else:
                    _ = self.model[word]
                    return True
            except (KeyError, ValueError):
                return False
        
        # Filter out words not in our vocabulary
        valid_clues = [(word, sim) for word, sim in clues if word_in_model(word)]
        
        if not valid_clues:
            return [("No valid clues provided", 0)]
        
        # Calculate a weighted score for each word in vocabulary
        candidates = defaultdict(float)
        
        # Sort clues by similarity (highest first)
        valid_clues.sort(key=lambda x: x[1], reverse=True)
        
        # Give more weight to higher similarity clues
        weights = np.linspace(1.0, 0.1, len(valid_clues))
        
        print(f"Analyzing {len(valid_clues)} clues...")
        
        # For each word in vocabulary, calculate how well its similarities match the clues
        for i, word in enumerate(self.hebrew_vocab):
            if i % 1000 == 0:
                print(f"Processed {i}/{len(self.hebrew_vocab)} words...")
            
            score = 0
            for j, (clue_word, clue_sim) in enumerate(valid_clues):
                # Calculate how close the actual similarity is to the expected similarity
                try:
                    # Calculate actual similarity between candidate and clue word
                    actual_sim = self.model.similarity(word, clue_word) * 100
                    
                    # Calculate how close this is to the expected similarity
                    error = abs(actual_sim - clue_sim)
                    
                    # Words with smaller error are better candidates
                    # We use negative error because we want to maximize similarity
                    weighted_score = -error * weights[j]
                    score += weighted_score
                except (KeyError, ValueError):
                    continue
            
            # Add any words that are already in clues with very high similarity
            high_similarity_bonus = sum(100 for w, s in valid_clues 
                                     if w == word and s > 70)
            score += high_similarity_bonus
            
            candidates[word] = score
        
        # Get the top N candidates with highest scores
        best_candidates = heapq.nlargest(self.top_n, candidates.items(), key=lambda x: x[1])
        
        # Remove any words we've already guessed
        guessed_words = {word for word, _ in clues}
        best_candidates = [(word, score) for word, score in best_candidates 
                          if word not in guessed_words]
        
        return best_candidates[:self.top_n]
    
    def suggest_next_guesses(self, clues):
        """
        Suggest the next best guesses based on given clues.
        
        Args:
            clues: List of tuples (word, similarity_score)
            
        Returns:
            List of suggested words
        """
        candidates = self.find_candidate_words(clues)
        return candidates

def parse_clues_from_file(filename):
    """Parse clues from a file with format: word similarity_score"""
    clues = []
    with open(filename, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 2:
                word = parts[0]
                try:
                    similarity = float(parts[1])
                    clues.append((word, similarity))
                except ValueError:
                    print(f"Skipping invalid line: {line}")
    return clues

def parse_clues_from_input():
    """Interactively parse clues from user input"""
    print("Enter your guesses and their similarity scores (one per line).")
    print("Format: <word> <similarity_score>")
    print("Enter an empty line when finished.")
    
    clues = []
    while True:
        line = input("> ").strip()
        if not line:
            break
        
        parts = line.split()
        if len(parts) >= 2:
            word = parts[0]
            try:
                similarity = float(parts[1])
                clues.append((word, similarity))
                print(f"Added: {word} ({similarity})")
            except ValueError:
                print("Invalid similarity score. Use a number.")
        else:
            print("Invalid format. Use: <word> <similarity_score>")
    
    return clues

def main():
    parser = argparse.ArgumentParser(description='Semantle puzzle solver')
    parser.add_argument('--model', default='model.mdl', help='Path to word embedding model')
    parser.add_argument('--file', help='File containing clues (word similarity_score format)')
    parser.add_argument('--top_n', type=int, default=20, help='Number of suggestions to return')
    
    args = parser.parse_args()
    
    solver = SemantleSolver(args.model, args.top_n)
    
    if args.file:
        clues = parse_clues_from_file(args.file)
    else:
        clues = parse_clues_from_input()
    
    print(f"\nAnalyzing {len(clues)} clues...")
    suggestions = solver.suggest_next_guesses(clues)
    
    print("\n===== Top Suggested Words =====")
    for i, (word, score) in enumerate(suggestions, 1):
        print(f"{i}. {word} (score: {score:.2f})")

if __name__ == "__main__":
    main()