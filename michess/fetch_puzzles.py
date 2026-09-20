import json
import pandas as pd
from datasets import load_dataset

print("Loading dataset from Hugging Face...")
# We only need the first 10,000 rows
dset = load_dataset("Lichess/chess-puzzles", split="train[:10000]")

df = dset.to_pandas()

# The columns we care about: PuzzleId, FEN, Moves, Rating
puzzles = []
for index, row in df.iterrows():
    puzzles.append({
        "id": row["PuzzleId"],
        "fen": row["FEN"],
        "moves": row["Moves"].split(" "),
        "rating": int(row["Rating"])
    })

print(f"Saving {len(puzzles)} puzzles to public/puzzles.json...")
with open("public/puzzles.json", "w") as f:
    json.dump(puzzles, f)
    
print("Done!")
