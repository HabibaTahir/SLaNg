import sys
import warnings


warnings.filterwarnings("ignore")

# Lightweight keyword-based intent classifier.
# There is no trained model.pkl shipped with this repo, so instead of
# loading a non-existent pickle file (which always failed), we classify
# intent using simple keyword matching.
INTENT_KEYWORDS = {
    "derivative": ["deriv", "differentiate", "d/dx", "slope", "rate of change"],
    "integral": ["integr", "antideriv", "area under"],
}

def predict(text):
    try:
        lowered = text.lower()

        for intent, keywords in INTENT_KEYWORDS.items():
            if any(keyword in lowered for keyword in keywords):
                print(intent)
                return

        print("evaluate")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    
    if len(sys.argv) > 1:
        input_text = sys.argv[1]
        predict(input_text)
    else:
        print("Error: No text provided to predict.", file=sys.stderr)