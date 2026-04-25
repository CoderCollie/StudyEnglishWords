import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import wordsData from './data.json';

const APP_VERSION = "1.11.0";
const SESSION_LENGTH = 10;

const LEVEL_MAP = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5 };
const REVERSE_LEVEL_MAP = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1' };

const calculateNextReview = (quality, prevInterval, prevEaseFactor) => {
  let interval;
  let easeFactor = prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  if (quality < 3) {
    interval = 0; // 틀리면 오늘 다시 퀴즈
  } else if (prevInterval === 0) {
    interval = 1; // 처음 퀴즈 맞히면 내일 복습
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
  const [userLevel, setUserLevel] = useState(1.0);
  const [currentWord, setCurrentWord] = useState(null);
  const [stats, setStats] = useState({});
  const [history, setHistory] = useState([]);
  
  const [quizOptions, setQuizOptions] = useState(null); 
  const [quizState, setQuizState] = useState('playing'); 
  const [selectedOption, setSelectedOption] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Session State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [wordsDoneInSession, setWordsDoneInSession] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionLearnedWords, setSessionLearnedWords] = useState([]); // 이번 세션에서 새로 배운 단어들

  const [touchStart, setTouchStart] = useState({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    const savedStats = localStorage.getItem('study_progress');
    const savedLevel = localStorage.getItem('user_level');
    
    if (savedStats) setStats(JSON.parse(savedStats));
    if (savedLevel) setUserLevel(parseFloat(savedLevel));
    
    setIsLoading(false);
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

  const startSession = () => {
    setWordsDoneInSession(0);
    setHistory([]);
    setSessionCompleted(false);
    setSessionLearnedWords([]);
    setIsSessionActive(true);
    pickNextWord(stats, userLevel, []);
  };

  const generateQuizOptions = (wordObj) => {
    const sameLevelWords = wordsData.filter(w => w.cefr === wordObj.cefr && w.word !== wordObj.word);
    const shuffledWrong = sameLevelWords.sort(() => 0.5 - Math.random()).slice(0, 3);
    const wrongDefs = shuffledWrong.map(w => w.definition);
    const allOptions = [wordObj.definition, ...wrongDefs].sort(() => 0.5 - Math.random());
    return allOptions;
  };

  const pickNextWord = (currentStats, currentLvl, currentSessionLearned = sessionLearnedWords, isBackAction = false) => {
    if (!isBackAction && currentWord) {
      setHistory(prev => {
          const newHistory = [...prev, currentWord];
          return newHistory.slice(-20);
      });
    }

    const now = new Date();
    
    const dueWords = wordsData.filter(w => {
      const wordStat = currentStats[w.word];
      // 방금 배운 신규 단어는 다음 세션부터 퀴즈로 나오도록 제외
      return wordStat && new Date(wordStat.nextDate) <= now && !currentSessionLearned.includes(w.word);
    });

    let selected = null;
    let isReview = false;

    if (dueWords.length > 0) {
      selected = dueWords[Math.floor(Math.random() * dueWords.length)];
      isReview = true;
    } else {
      const targetLevelStr = REVERSE_LEVEL_MAP[Math.floor(currentLvl)] || 'A1';
      const newWordsPool = wordsData.filter(w => w.cefr === targetLevelStr && !currentStats[w.word]);
      
      if (newWordsPool.length > 0) {
        selected = newWordsPool[Math.floor(Math.random() * newWordsPool.length)];
      } else {
        selected = wordsData[Math.floor(Math.random() * wordsData.length)];
        isReview = !!currentStats[selected.word] && !currentSessionLearned.includes(selected.word);
      }
    }

    setCurrentWord(selected);
    setSelectedOption(null);

    if (isReview) {
      setQuizOptions(generateQuizOptions(selected));
      setQuizState('playing');
    } else {
      setQuizOptions(null);
    }
  };

  const handleGoBack = () => {
    if (history.length > 0) {
      const prevWord = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setCurrentWord(prevWord);
      setQuizOptions(null); 
      setSelectedOption(null);
      setQuizState('playing');
      setWordsDoneInSession(prev => Math.max(0, prev - 1));
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

    const newWordsDone = wordsDoneInSession + 1;
    if (newWordsDone >= SESSION_LENGTH) {
      setIsSessionActive(false);
      setSessionCompleted(true);
    } else {
      setWordsDoneInSession(newWordsDone);
      pickNextWord(newStats, newLevel, sessionLearnedWords);
    }
  };

  const handleNextInLearnMode = () => {
    // 신규 단어를 확인하면 '오늘 퀴즈를 봐야 할 단어'로 등록하되, 이번 세션에서는 안 나오게 기록
    const newStats = { 
      ...stats, 
      [currentWord.word]: { 
        interval: 0, 
        easeFactor: 2.5, 
        nextDate: new Date().toISOString() 
      } 
    };
    saveAllData(newStats, userLevel);
    
    const updatedSessionLearned = [...sessionLearnedWords, currentWord.word];
    setSessionLearnedWords(updatedSessionLearned);

    const newWordsDone = wordsDoneInSession + 1;
    if (newWordsDone >= SESSION_LENGTH) {
      setIsSessionActive(false);
      setSessionCompleted(true);
    } else {
      setWordsDoneInSession(newWordsDone);
      pickNextWord(newStats, userLevel, updatedSessionLearned);
    }
  };

  const handleTouchStart = (e) => {
    setTouchStart({ 
      x: e.nativeEvent.pageX, 
      y: e.nativeEvent.pageY,
      time: Date.now()
    });
  };

  const handleTouchEnd = (e) => {
    if (!touchStart.time || !isSessionActive) return;
    
    const touchEndX = e.nativeEvent.pageX;
    const touchEndY = e.nativeEvent.pageY;
    const distanceX = touchEndX - touchStart.x;
    const distanceY = Math.abs(touchEndY - touchStart.y);
    const timeDiff = Date.now() - touchStart.time;

    if (distanceX > 60 && distanceY < 60 && timeDiff < 500) {
      handleGoBack();
    } 
    else if (Math.abs(distanceX) < 10 && distanceY < 10 && timeDiff < 500) {
      if (!quizOptions) {
        handleNextInLearnMode();
      }
    }
    
    setTouchStart({ x: 0, y: 0, time: 0 });
  };

  const handleQuizAnswer = (option) => {
    if (quizState !== 'playing' || !isSessionActive) return;
    setSelectedOption(option);
    
    if (option === currentWord.definition) {
      setQuizState('correct');
      setTimeout(() => {
        processRating(4, stats, userLevel);
      }, 300);
    } else {
      setQuizState('wrong');
      setTimeout(() => {
        processRating(1, stats, userLevel);
      }, 600);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!isSessionActive) {
    const currentLevelLabel = REVERSE_LEVEL_MAP[Math.floor(userLevel)] || 'A1';
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.contentContainer}>
          <View style={styles.wordSection}>
            <Text style={styles.wordText}>
              {sessionCompleted ? "Session Complete! 🎉" : "Ready to Study?"}
            </Text>
            <Text style={[styles.typeText, { marginTop: 15 }]}>
              {sessionCompleted ? `Great job! You've learned ${SESSION_LENGTH} words.` : `Current Level: ${currentLevelLabel}`}
            </Text>
          </View>
          
          <View style={styles.optionsContainer}>
             <TouchableOpacity style={styles.startBtn} onPress={startSession} activeOpacity={0.8}>
                <Text style={styles.startBtnText}>
                  {sessionCompleted ? "Start Another Session" : "Start Session"}
                </Text>
             </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.versionBtn} onPress={handleForceUpdate}>
          <Text style={styles.versionText}>v{APP_VERSION}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <StatusBar style="auto" />
      
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>{wordsDoneInSession + 1} / {SESSION_LENGTH}</Text>
      </View>

      {quizOptions ? (
        <View style={styles.contentContainer}>
          <View style={styles.wordSection}>
            <Text style={styles.wordText}>{currentWord?.word}</Text>
            <Text style={styles.typeText}>{currentWord?.type}</Text>
          </View>
          
          <View style={styles.optionsContainer}>
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
          </View>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <View style={styles.wordSection}>
            <Text style={styles.wordText}>{currentWord?.word}</Text>
            <Text style={styles.typeText}>{currentWord?.type}</Text>
          </View>

          <View style={styles.definitionSection}>
            <View style={styles.definitionCard}>
              <Text style={styles.definitionLabel}>Definition</Text>
              <Text style={styles.definitionText}>{currentWord?.definition}</Text>
              <View style={styles.divider} />
              <Text style={styles.exampleLabel}>Example</Text>
              <Text style={styles.exampleText}>{currentWord?.example}</Text>
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.versionBtn} onPress={handleForceUpdate}>
        <Text style={styles.versionText}>v{APP_VERSION}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  loadingText: { fontSize: 18, color: '#86868b', marginTop: 200, alignSelf: 'center' },
  
  progressContainer: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  progressText: { color: '#86868b', fontSize: 14, fontWeight: 'bold' },

  contentContainer: { 
    flex: 1, 
    paddingHorizontal: 20, 
    paddingTop: 80, 
    paddingBottom: 40,
    justifyContent: 'space-around'
  },
  
  wordSection: { 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 20
  },
  wordText: { fontSize: 48, fontWeight: 'bold', color: '#1d1d1f', textAlign: 'center' },
  typeText: { fontSize: 18, color: '#0071e3', fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
  
  definitionSection: {
    flex: 1,
    justifyContent: 'center'
  },
  definitionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {width:0, height:8},
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5
  },
  definitionLabel: { fontSize: 13, color: '#86868b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  definitionText: { fontSize: 22, color: '#1d1d1f', lineHeight: 30, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 25 },
  exampleLabel: { fontSize: 13, color: '#86868b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  exampleText: { fontSize: 18, color: '#424245', fontStyle: 'italic', lineHeight: 26 },
  
  optionsContainer: { 
    justifyContent: 'center',
  },
  optionBtn: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 15, 
    borderWidth: 2, 
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {width:0, height:4},
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  optionText: { fontSize: 16, color: '#1d1d1f', lineHeight: 22 },
  optionCorrect: { backgroundColor: '#e8f5e9', borderColor: '#4CAF50' },
  optionTextCorrect: { color: '#2e7d32', fontWeight: '700' },
  optionWrong: { backgroundColor: '#ffebee', borderColor: '#ff5252' },
  optionTextWrong: { color: '#c62828' },
  
  startBtn: { backgroundColor: '#1d1d1f', paddingVertical: 22, borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0, height:8}, shadowOpacity: 0.15, shadowRadius: 15, elevation: 8, marginTop: 40 },
  startBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  versionBtn: { position: 'absolute', bottom: 10, right: 15, padding: 10 },
  versionText: { color: '#bfbfbf', fontSize: 10 }
});
