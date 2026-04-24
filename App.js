import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import wordsData from './data.json';

// --- SRS (SM-2) Logic ---
const calculateNextReview = (quality, prevInterval, prevEaseFactor) => {
  let interval;
  let easeFactor = prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  if (quality < 3) {
    interval = 1; // Wrong, review again tomorrow
  } else if (prevInterval === 1) {
    interval = 6;
  } else {
    interval = Math.round(prevInterval * easeFactor);
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  return { interval, easeFactor, nextDate: nextDate.toISOString() };
};

export default function App() {
  const [level, setLevel] = useState(null);
  const [currentWord, setCurrentWord] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [stats, setStats] = useState({}); // Word-specific SRS data

  // Load progress from localStorage (for web)
  useEffect(() => {
    const saved = localStorage.getItem('study_progress');
    if (saved) setStats(JSON.parse(saved));
  }, []);

  const saveProgress = (word, srsData) => {
    const newStats = { ...stats, [word]: srsData };
    setStats(newStats);
    localStorage.setItem('study_progress', JSON.stringify(newStats));
  };

  const startStudy = (selectedLevel) => {
    setLevel(selectedLevel);
    const filteredWords = wordsData.filter(w => w.cefr === selectedLevel);
    // Logic: Pick words due today OR new words
    pickNextWord(filteredWords);
  };

  const pickNextWord = (pool) => {
    const now = new Date();
    // Simple logic: pick a random word from the level for now
    // (In full version, prioritize 'due' words)
    const randomWord = pool[Math.floor(Math.random() * pool.length)];
    setCurrentWord(randomWord);
    setIsFlipped(false);
  };

  const handleRating = (quality) => {
    const prev = stats[currentWord.word] || { interval: 0, easeFactor: 2.5 };
    const nextSrs = calculateNextReview(quality, prev.interval, prev.easeFactor);
    saveProgress(currentWord.word, nextSrs);
    
    // Pick next word
    const filteredWords = wordsData.filter(w => w.cefr === level);
    pickNextWord(filteredWords);
  };

  if (!level) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>English Study</Text>
        <Text style={styles.subtitle}>Select Level</Text>
        <View style={styles.levelGrid}>
          {['A1', 'A2', 'B1', 'B2', 'C1'].map(l => (
            <TouchableOpacity key={l} style={styles.levelButton} onPress={() => startStudy(l)}>
              <Text style={styles.levelText}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setLevel(null)}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.levelIndicator}>{level} Level</Text>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity 
          activeOpacity={0.9} 
          style={[styles.card, isFlipped ? styles.cardBack : styles.cardFront]} 
          onPress={() => setIsFlipped(!isFlipped)}
        >
          {!isFlipped ? (
            <View style={styles.centered}>
              <Text style={styles.wordText}>{currentWord?.word}</Text>
              <Text style={styles.typeText}>{currentWord?.type}</Text>
              <Text style={styles.hintText}>Tap to see meaning</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.cardBackContent}>
              <Text style={styles.definitionLabel}>Definition</Text>
              <Text style={styles.definitionText}>{currentWord?.definition}</Text>
              <View style={styles.divider} />
              <Text style={styles.exampleLabel}>Example</Text>
              <Text style={styles.exampleText}>{currentWord?.example}</Text>
            </ScrollView>
          )}
        </TouchableOpacity>
      </View>

      {isFlipped && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.rateBtn, {backgroundColor: '#ff4d4d'}]} onPress={() => handleRating(1)}>
            <Text style={styles.rateBtnText}>Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rateBtn, {backgroundColor: '#ffcc00'}]} onPress={() => handleRating(3)}>
            <Text style={styles.rateBtnText}>Hard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rateBtn, {backgroundColor: '#4CAF50'}]} onPress={() => handleRating(5)}>
            <Text style={styles.rateBtnText}>Easy</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10, color: '#1d1d1f' },
  subtitle: { fontSize: 18, color: '#86868b', marginBottom: 30 },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15 },
  levelButton: { width: 80, height: 80, backgroundColor: '#fff', borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  levelText: { fontSize: 24, fontWeight: '600', color: '#0071e3' },
  header: { width: '100%', paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 60 },
  backBtn: { fontSize: 18, color: '#0071e3' },
  levelIndicator: { fontSize: 18, fontWeight: 'bold', color: '#1d1d1f' },
  cardContainer: { width: Dimensions.get('window').width * 0.85, height: 450, marginTop: 40 },
  card: { flex: 1, borderRadius: 30, padding: 30, shadowColor: '#000', shadowOffset: {width:0, height:10}, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  cardFront: { backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  cardBack: { backgroundColor: '#fff' },
  centered: { alignItems: 'center' },
  wordText: { fontSize: 48, fontWeight: 'bold', color: '#1d1d1f', textAlign: 'center' },
  typeText: { fontSize: 18, color: '#0071e3', marginTop: 10, fontStyle: 'italic' },
  hintText: { fontSize: 14, color: '#bfbfbf', marginTop: 100 },
  cardBackContent: { paddingBottom: 20 },
  definitionLabel: { fontSize: 14, color: '#86868b', marginBottom: 8 },
  definitionText: { fontSize: 20, color: '#1d1d1f', lineHeight: 28, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 20 },
  exampleLabel: { fontSize: 14, color: '#86868b', marginBottom: 8 },
  exampleText: { fontSize: 18, color: '#424245', fontStyle: 'italic', lineHeight: 26 },
  buttonRow: { flexDirection: 'row', width: '85%', justifyContent: 'space-between', marginTop: 30 },
  rateBtn: { flex: 1, marginHorizontal: 5, paddingVertical: 15, borderRadius: 15, alignItems: 'center' },
  rateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
