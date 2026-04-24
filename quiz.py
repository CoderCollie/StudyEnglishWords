import csv
import random
import sys

def load_data(file_path):
    words_by_level = {}
    try:
        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                level = row['cefr'].upper()
                if level not in words_by_level:
                    words_by_level[level] = []
                words_by_level[level].append({
                    'word': row['word'],
                    'definition': row['definition'],
                    'type': row['type']
                })
    except FileNotFoundError:
        print(f"Error: {file_path} not found.")
        sys.exit(1)
    return words_by_level

def run_quiz():
    data = load_data('oxford_5000.csv')
    levels = sorted(data.keys())
    
    print("=== English Word Quiz (Oxford 5000) ===")
    print(f"Available Levels: {', '.join(levels)}")
    
    choice = input(f"Select level ({'/'.join(levels)}): ").upper()
    if choice not in data:
        print("Invalid level selected. Defaulting to A1.")
        choice = 'A1'
    
    words = data[choice]
    score = 0
    total = 5 # 5 questions per session
    
    for i in range(total):
        target = random.choice(words)
        # Create 4 options: 1 correct + 3 random from the same level
        options = [target['definition']]
        while len(options) < 4:
            other = random.choice(words)
            if other['definition'] not in options:
                options.append(other['definition'])
        
        random.shuffle(options)
        
        print(f"\nQ{i+1}. [{target['word']}] ({target['type']})")
        for idx, opt in enumerate(options):
            print(f"  {idx + 1}) {opt}")
            
        try:
            user_ans = int(input("Answer (1-4): "))
            if options[user_ans - 1] == target['definition']:
                print("Correct! ✨")
                score += 1
            else:
                print(f"Wrong. The correct answer was: {target['definition']}")
        except (ValueError, IndexError):
            print("Invalid input. Skipping...")

    print(f"\nQuiz Finished! Your Score: {score}/{total}")

if __name__ == "__main__":
    run_quiz()
