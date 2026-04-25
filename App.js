import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import wordsData from './data.json';

const APP_VERSION = "1.2.0";

// CEFR Level mapping for calculation
const LEVEL_MAP = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5 };
const REVERSE_LEVEL_MAP = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1' };

const calculateNextReview = (quality, prevInterval, prevEaseFactor) => {
  let interval;
  let easeFactor = prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  if (quality < 3) {
    interval = 1;
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
  const [isStarted, setIsStarted] = useState(false);
  const [userLevel, setUserLevel] = useState(1.0); // Start at A1
  const [currentWord, setCurrentWord] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [stats, setStats] = useState({});
  
  // Quiz specific state
  const [quizOptions, setQuizOptions] = useState(null); // null means flashcard mode
  const [quizState, setQuizState] = useState('playing'); // playing, correct, wrong
  const [selectedOption, setSelectedOption] = useState(null);

  useEffect(() => {
    const savedStats = localStorage.getItem('study_progress');
    const savedLevel = localStorage.getItem('user_level');
    if (savedStats) setStats(JSON.parse(savedStats));
    if (savedLevel) setUserLevel(parseFloat(savedLevel));
  }, []);

  const saveAllData = (newStats, newLevel) => {
    setStats(newStats);
    setUserLevel(newLevel);
    localStorage.setItem('study_progress', JSON.stringify(newStats));
    localStorage.setItem('user_level', newLevel.toString());
  };

  const handleForceUpdate = async () => {
    if (window.confirm("Check for updates and refresh the app?")) {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (let registration of registrations) {
            await registration.unregister();
          }
        }
        window.location.reload(true);
      } catch (error) {
        window.location.reload();
      }
    }
  };

  const generateQuizOptions = (wordObj) => {
    const sameLevelWords = wordsData.filter(w => w.cefr === wordObj.cefr && w.word !== wordObj.word);
    const shuffledWrong = sameLevelWords.sort(() => 0.5 - Math.random()).slice(0, 3);
    const wrongDefs = shuffledWrong.map(w => w.definition);
    const allOptions = [wordObj.definition, ...wrongDefs].sort(() => 0.5 - Math.random());
    return allOptions;
  };

  const pickNextWord = (currentStats, currentLvl) => {
    const now = new Date();
    
    // 1. Priority: Words due for review (QUIZ MODE)
    const dueWords = wordsData.filter(w => {
      const wordStat = currentStats[w.word];
      return wordStat && new Date(wordStat.nextDate) <= now;
    });

    let selected = null;
    let isReview = false;

    if (dueWords.length > 0) {
      selected = dueWords[Math.floor(Math.random() * dueWords.length)];
      isReview = true;
    } else {
      // 2. New words around current user level (FLASHCARD MODE)
      const targetLevelStr = REVERSE_LEVEL_MAP[Math.floor(currentLvl)] || 'A1';
      const newWordsPool = wordsData.filter(w => w.cefr === targetLevelStr && !currentStats[w.word]);
      
      if (newWordsPool.length > 0) {
        selected = newWordsPool[Math.floor(Math.random() * newWordsPool.length)];
      } else {
        selected = wordsData[Math.floor(Math.random() * wordsData.length)];
        isReview = !!currentStats[selected.word];
      }
    }

    setCurrentWord(selected);
    setIsFlipped(false);
    setSelectedOption(null);

    if (isReview) {
      setQuizOptions(generateQuizOptions(selected));
      setQuizState('playing');
    } else {
      setQuizOptions(null);
    }
  };

  const processRating = (quality, currentStats, currentLvl) => {
    const prev = currentStats[currentWord.word] || { interval: 0, easeFactor: 2.5 };
    const nextSrs = calculateNextReview(quality, prev.interval, prev.easeFactor);
    const newStats = { ...currentStats, [currentWord.word]: nextSrs };
    
    let levelAdjustment = 0;
    if (quality >= 4) levelAdjustment = 0.05;
    if (quality <= 2) levelAdjustment = -0.1;
    
    const newLevel = Math.min(5.9, Math.max(1.0, currentLvl + levelAdjustment));
    saveAllData(newStats, newLevel);
    pickNextWord(newStats, newLevel);
  };

  const handleFlashcardRating = (quality) => {
    processRating(quality, stats, userLevel);
  };

  const handleQuizAnswer = (option) => {
    if (quizState !== 'playing') return;
    setSelectedOption(option);
    
    if (option === currentWord.definition) {
      setQuizState('correct');
      setTimeout(() => {
        processRating(4, stats, userLevel);
      }, 1000);
    } else {
      setQuizState('wrong');
      setTimeout(() => {
        processRating(1, stats, userLevel);
      }, 2500);
    }
  };

  if (!isStarted) {
    const currentLevelLabel = REVERSE_LEVEL_MAP[Math.floor(userLevel)];
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>English Study</Text>
        <Text style={styles.subtitle}>Hybrid Learning System</Text>
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Your Level</Text>
          <Text style={styles.statusValue}>{currentLevelLabel}</Text>
          <Text style={styles.statusSubText}>New: Flashcard / Reviews: Quiz</Text>
        </View>
        <TouchableOpacity style={styles.mainStartBtn} onPress={() => {
          setIsStarted(true);
          pickNextWord(stats, userLevel);
        }}>
          <Text style={styles.mainStartBtnText}>Start Learning</Text>
        </TouchableOpacity>
        <View style={styles.footer}>
          <Text style={styles.versionText}>v{APP_VERSION}</Text>
          <TouchableOpacity style={styles.updateBtn} onPress={handleForceUpdate}>
            <Text style={styles.updateBtnText}>Check for Updates</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsStarted(false)}>
          <Text style={styles.backBtn}>← Quit</Text>
        </TouchableOpacity>
        <Text style={styles.levelIndicator}>{currentWord?.cefr} | {quizOptions ? 'Test' : 'Learn'}</Text>
      </View>

      {quizOptions ? (
        <View style={[styles.cardContainer, { height: 550 }]}>
          <View style={[styles.card, styles.cardFront]}>
            <Text style={styles.quizWordText}>{currentWord?.word}</Text>
            <Text style={styles.typeText}>{currentWord?.type}</Text>
            <ScrollView style={styles.optionsContainer}>
              {quizOptions.map((opt, idx) => {
                let btnStyle = [styles.optionBtn];
                let textStyle = [styles.optionText];
                if (quizState !== 'playing') {
                  if (opt === currentWord.definition) {
                    btnStyle.push(styles.optionCorrect);
                    textStyle.push(styles.optionTextCorrect);
                  } else if (opt === selectedOption) {
                    btnStyle.push(styles.optionWrong);
                    textStyle.push(styles.optionTextWrong);
                  }
                }
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={btnStyle}
                    activeOpacity={0.7}
                    onPress={() => handleQuizAnswer(opt)}
                    disabled={quizState !== 'playing'}
                  >
                    <Text style={textStyle}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : (
        <>
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
              <TouchableOpacity style={[styles.rateBtn, {backgroundColor: '#ff4d4d'}]} onPress={() => handleFlashcardRating(1)}>
                <Text style={styles.rateBtnText}>Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rateBtn, {backgroundColor: '#ffcc00'}]} onPress={() => handleFlashcardRating(3)}>
                <Text style={styles.rateBtnText}>Hard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rateBtn, {backgroundColor: '#4CAF50'}]} onPress={() => handleFlashcardRating(5)}>
                <Text style={styles.rateBtnText}>Easy</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 5, color: '#1d1d1f' },
  subtitle: { fontSize: 18, color: '#86868b', marginBottom: 40 },
  statusBox: { backgroundColor: '#fff', padding: 30, borderRadius: 25, alignItems: 'center', width: '80%', marginBottom: 40, shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },
  statusLabel: { fontSize: 14, color: '#86868b', marginBottom: 10 },
  statusValue: { fontSize: 48, fontWeight: 'bold', color: '#0071e3', marginBottom: 10 },
  statusSubText: { fontSize: 12, color: '#bfbfbf', textAlign: 'center' },
  mainStartBtn: { backgroundColor: '#0071e3', paddingVertical: 20, paddingHorizontal: 60, borderRadius: 30, shadowColor: '#0071e3', shadowOffset: {width:0, height:8}, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  mainStartBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  header: { width: '100%', paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 60 },
  backBtn: { fontSize: 18, color: '#0071e3' },
  levelIndicator: { fontSize: 14, fontWeight: '600', color: '#86868b' },
  cardContainer: { width: Dimensions.get('window').width * 0.9, height: 450, marginTop: 40 },
  card: { flex: 1, borderRadius: 30, padding: 30, shadowColor: '#000', shadowOffset: {width:0, height:10}, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  cardFront: { backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  cardBack: { backgroundColor: '#fff' },
  centered: { alignItems: 'center' },
  wordText: { fontSize: 48, fontWeight: 'bold', color: '#1d1d1f', textAlign: 'center' },
  quizWordText: { fontSize: 42, fontWeight: 'bold', color: '#1d1d1f', textAlign: 'center' },
  typeText: { fontSize: 18, color: '#0071e3', marginTop: 5, fontStyle: 'italic', marginBottom: 20 },
  hintText: { fontSize: 14, color: '#bfbfbf', marginTop: 100 },
  cardBackContent: { paddingBottom: 20 },
  definitionLabel: { fontSize: 14, color: '#86868b', marginBottom: 8 },
  definitionText: { fontSize: 20, color: '#1d1d1f', lineHeight: 28, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 20 },
  exampleLabel: { fontSize: 14, color: '#86868b', marginBottom: 8 },
  exampleText: { fontSize: 18, color: '#424245', fontStyle: 'italic', lineHeight: 26 },
  buttonRow: { flexDirection: 'row', width: '90%', justifyContent: 'space-between', marginTop: 30 },
  rateBtn: { flex: 1, marginHorizontal: 5, paddingVertical: 15, borderRadius: 15, alignItems: 'center' },
  rateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  footer: { position: 'absolute', bottom: 40, alignItems: 'center' },
  versionText: { color: '#86868b', fontSize: 12, marginBottom: 5 },
  updateBtn: { padding: 10 },
  updateBtnText: { color: '#0071e3', fontSize: 14, textDecorationLine: 'underline' },
  optionsContainer: { width: '100%', marginTop: 10 },
  optionBtn: { width: '100%', backgroundColor: '#f5f5f7', padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  optionText: { fontSize: 16, color: '#1d1d1f', lineHeight: 22 },
  optionCorrect: { backgroundColor: '#e8f5e9', borderColor: '#4CAF50' },
  optionTextCorrect: { color: '#2e7d32', fontWeight: '600' },
  optionWrong: { backgroundColor: '#ffebee', borderColor: '#ff5252' },
  optionTextWrong: { color: '#c62828' }
});
