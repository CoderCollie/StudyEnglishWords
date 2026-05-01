import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import wordsData from './data.json';

const APP_VERSION = "1.14.2";
const SESSION_LENGTH = 10;

const LEVEL_MAP = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5 };
const REVERSE_LEVEL_MAP = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1' };

const calculateNextReview = (quality, prevInterval, prevEaseFactor) => {
  let interval;
  let easeFactor = prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  if (quality < 3) {
    interval = 0;
  } else if (prevInterval === 0) {
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
  const [userLevel, setUserLevel] = useState(1.0);
  const [currentWord, setCurrentWord] = useState(null);
  const [stats, setStats] = useState({});
  const [history, setHistory] = useState([]);
  
  const [quizOptions, setQuizOptions] = useState(null); 
  const [quizState, setQuizState] = useState('playing'); 
  const [selectedOption, setSelectedOption] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Session & Stats State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [wordsDoneInSession, setWordsDoneInSession] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionLearnedWords, setSessionLearnedWords] = useState([]);
  
  // Dashboard Specific Stats
  const [streak, setStreak] = useState(0);
  const [masteryPercent, setMasteryBar] = useState(0);
  const [fiveDayHistory, setFiveDayHistory] = useState([]);

  const [touchStart, setTouchStart] = useState({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    loadAllData();
  }, []);

  const getRecentDates = (days = 5) => {
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const loadAllData = () => {
    const savedStats = localStorage.getItem('study_progress');
    const savedLevel = localStorage.getItem('user_level');
    const savedHistory = localStorage.getItem('study_history');
    const savedStreak = localStorage.getItem('streak_data');
    
    let initialStats = {};
    let initialLevel = 1.0;

    if (savedStats) {
      initialStats = JSON.parse(savedStats);
      setStats(initialStats);
    }
    if (savedLevel) {
      initialLevel = parseFloat(savedLevel);
      setUserLevel(initialLevel);
    }

    const historyData = savedHistory ? JSON.parse(savedHistory) : {};
    const recentDates = getRecentDates(5);
    const historyArray = recentDates.map(date => ({
      date: date,
      count: historyData[date] || 0,
      label: date === new Date().toISOString().split('T')[0] ? 'Today' : date.split('-').slice(1).join('/')
    }));
    setFiveDayHistory(historyArray);

    const today = new Date().toISOString().split('T')[0];
    if (savedStreak) {
      const streakData = JSON.parse(savedStreak);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (streakData.lastDate === today || streakData.lastDate === yesterdayStr) {
        setStreak(streakData.count);
      } else {
        setStreak(0);
      }
    }

    const currentLvlStr = REVERSE_LEVEL_MAP[Math.floor(initialLevel)] || 'A1';
    const wordsInCurrentLevel = wordsData.filter(w => w.cefr === currentLvlStr);
    const learnedInCurrentLevel = wordsInCurrentLevel.filter(w => initialStats[w.word]);
    setMasteryBar(Math.round((learnedInCurrentLevel.length / wordsInCurrentLevel.length) * 100));

    setIsLoading(false);
  };

  const updateHistoryAndStreak = () => {
    const today = new Date().toISOString().split('T')[0];
    
    const savedHistory = localStorage.getItem('study_history');
    const historyData = savedHistory ? JSON.parse(savedHistory) : {};
    const newTodayCount = (historyData[today] || 0) + 1;
    const newHistoryData = { ...historyData, [today]: newTodayCount };
    localStorage.setItem('study_history', JSON.stringify(newHistoryData));

    setFiveDayHistory(prev => prev.map(item => 
      item.date === today ? { ...item, count: newTodayCount } : item
    ));

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    let newStreak = streak;
    const savedStreak = localStorage.getItem('streak_data');
    const streakData = savedStreak ? JSON.parse(savedStreak) : { lastDate: '', count: 0 };

    if (streakData.lastDate !== today) {
      if (streakData.lastDate === yesterdayStr || streakData.lastDate === '') {
        newStreak = streakData.count + 1;
      } else {
        newStreak = 1;
      }
      setStreak(newStreak);
      localStorage.setItem('streak_data', JSON.stringify({ lastDate: today, count: newStreak }));
    }
  };

  const saveAllData = (newStats, newLevel) => {
    setStats(newStats);
    setUserLevel(newLevel);
    localStorage.setItem('study_progress', JSON.stringify(newStats));
    localStorage.setItem('user_level', newLevel.toString());
    
    const currentLvlStr = REVERSE_LEVEL_MAP[Math.floor(newLevel)] || 'A1';
    const wordsInCurrentLevel = wordsData.filter(w => w.cefr === currentLvlStr);
    const learnedInCurrentLevel = wordsInCurrentLevel.filter(w => newStats[w.word]);
    setMasteryBar(Math.round((learnedInCurrentLevel.length / wordsInCurrentLevel.length) * 100));
  };

  const handleForceUpdate = async () => {
    if (window.confirm("Delete all caches and refresh to latest version?")) {
      try {
        // 1. Unregister all service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (let registration of registrations) {
            await registration.unregister();
          }
        }
        // 2. Clear all Cache Storage
        if ('caches' in window) {
           const cacheNames = await caches.keys();
           await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        // 3. Force reload ignoring browser cache
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
    return [wordObj.definition, ...wrongDefs].sort(() => 0.5 - Math.random());
  };

  const pickNextWord = (currentStats, currentLvl, currentSessionLearned = sessionLearnedWords, isBackAction = false) => {
    if (!isBackAction && currentWord) setHistory(prev => [...prev, currentWord].slice(-20));

    const now = new Date();
    const dueWords = wordsData.filter(w => {
      const wordStat = currentStats[w.word];
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
    
    let levelAdjustment = (quality >= 4) ? 0.05 : (quality <= 2 ? -0.1 : 0);
    const newLevel = Math.min(5.9, Math.max(1.0, currentLvl + levelAdjustment));
    
    saveAllData(newStats, newLevel);
    updateHistoryAndStreak();

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
    const newStats = { ...stats, [currentWord.word]: { interval: 0, easeFactor: 2.5, nextDate: new Date().toISOString() } };
    saveAllData(newStats, userLevel);
    updateHistoryAndStreak();
    
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

  const handleTouchStart = (e) => setTouchStart({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, time: Date.now() });

  const handleTouchEnd = (e) => {
    if (!touchStart.time || !isSessionActive) return;
    const touchEndX = e.nativeEvent.pageX;
    const touchEndY = e.nativeEvent.pageY;
    const distanceX = touchEndX - touchStart.x;
    const distanceY = Math.abs(touchEndY - touchStart.y);
    const timeDiff = Date.now() - touchStart.time;

    if (distanceX > 60 && distanceY < 60 && timeDiff < 500) handleGoBack();
    else if (Math.abs(distanceX) < 10 && distanceY < 10 && timeDiff < 500) {
      if (!quizOptions) handleNextInLearnMode();
    }
    setTouchStart({ x: 0, y: 0, time: 0 });
  };

  const handleQuizAnswer = (option) => {
    if (quizState !== 'playing' || !isSessionActive) return;
    setSelectedOption(option);
    if (option === currentWord.definition) {
      setQuizState('correct');
      setTimeout(() => processRating(4, stats, userLevel), 300);
    } else {
      setQuizState('wrong');
      setTimeout(() => processRating(1, stats, userLevel), 600);
    }
  };

  if (isLoading) return <SafeAreaView style={styles.container}><Text style={styles.loadingText}>Loading...</Text></SafeAreaView>;

  if (!isSessionActive) {
    const currentLevelLabel = REVERSE_LEVEL_MAP[Math.floor(userLevel)] || 'A1';
    const maxCountInHistory = Math.max(...fiveDayHistory.map(h => h.count), 10);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        
        <View style={styles.dashboardContainer}>
          <View style={styles.topStatsRow}>
             <View style={styles.streakSmallBox}>
               <Text style={styles.streakSmallEmoji}>🔥</Text>
               <Text style={styles.streakSmallCount}>{streak}</Text>
             </View>
             <View style={styles.levelSmallBox}>
               <Text style={styles.levelSmallText}>{currentLevelLabel}</Text>
             </View>
          </View>

          <View style={styles.graphCard}>
            <Text style={styles.graphTitle}>Weekly Progress</Text>
            <View style={styles.barContainer}>
              {fiveDayHistory.map((item, idx) => (
                <View key={idx} style={styles.barColumn}>
                  <View style={styles.barWrapper}>
                    <View style={[styles.barFill, { height: `${(item.count / maxCountInHistory) * 100}%` }]} />
                  </View>
                  <Text style={[styles.barLabel, item.label === 'Today' && styles.todayLabel]}>{item.label}</Text>
                  <Text style={styles.barCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.masterySection}>
            <View style={styles.masteryHeader}>
              <Text style={styles.masteryTitle}>{currentLevelLabel} Mastery</Text>
              <Text style={styles.masteryPercent}>{masteryPercent}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${masteryPercent}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.mainStartSection}>
          <Text style={styles.welcomeTitle}>
            {sessionCompleted ? "Excellent Work! 🎉" : "Ready to Advance?"}
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={startSession} activeOpacity={0.8}>
            <Text style={styles.startBtnText}>Start 10 Words</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.versionBtn} onPress={handleForceUpdate}>
          <Text style={styles.versionText}>v{APP_VERSION} ↻</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <StatusBar style="auto" />
      <View style={styles.sessionHeader}>
        <TouchableOpacity onPress={() => setIsSessionActive(false)} style={styles.quitBtn}>
          <Text style={styles.quitBtnText}>✕ Quit</Text>
        </TouchableOpacity>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>{wordsDoneInSession + 1} / {SESSION_LENGTH}</Text>
        </View>
      </View>

      <View style={styles.studyCardContainer}>
        <View style={styles.mainCard}>
          <View style={styles.cardWordSection}>
            <Text style={styles.cardWordText}>{currentWord?.word}</Text>
            <Text style={styles.cardTypeText}>{currentWord?.type}</Text>
          </View>

          <View style={styles.cardContentDivider} />

          {quizOptions ? (
            <View style={styles.cardOptionsContainer}>
              {quizOptions.map((opt, idx) => {
                let btnStyle = [styles.cardOptionBtn];
                let textStyle = [styles.cardOptionText];
                if (quizState !== 'playing') {
                  if (opt === currentWord.definition) { btnStyle.push(styles.cardOptionCorrect); textStyle.push(styles.cardOptionTextCorrect); }
                  else if (opt === selectedOption) { btnStyle.push(styles.cardOptionWrong); textStyle.push(styles.cardOptionTextWrong); }
                }
                return (
                  <TouchableOpacity key={idx} style={btnStyle} activeOpacity={0.7} onPress={() => handleQuizAnswer(opt)} disabled={quizState !== 'playing'}>
                    <Text style={textStyle}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.cardDefinitionSection}>
              <View style={styles.cardDefinitionRow}>
                <Text style={styles.cardLabel}>Definition</Text>
                <Text style={styles.cardDefinitionText}>{currentWord?.definition}</Text>
              </View>
              <View style={[styles.cardDefinitionRow, { marginTop: 20 }]}>
                <Text style={styles.cardLabel}>Example</Text>
                <Text style={styles.cardExampleText}>{currentWord?.example}</Text>
              </View>
              <Text style={styles.cardHintText}>Tap anywhere to continue</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.versionBtn} onPress={handleForceUpdate}>
        <Text style={styles.versionText}>v{APP_VERSION}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  loadingText: { fontSize: 18, color: '#86868b', marginTop: 200, alignSelf: 'center' },
  
  // Dashboard Styles
  dashboardContainer: { width: '100%', paddingHorizontal: 25, paddingTop: 80 },
  topStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  streakSmallBox: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  streakSmallEmoji: { fontSize: 18, marginRight: 5 },
  streakSmallCount: { fontSize: 18, fontWeight: 'bold', color: '#1d1d1f' },
  levelSmallBox: { backgroundColor: '#0071e3', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  levelSmallText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  graphCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 30, shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  graphTitle: { fontSize: 14, fontWeight: 'bold', color: '#86868b', marginBottom: 20, textAlign: 'center' },
  barContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120 },
  barColumn: { alignItems: 'center', width: '18%' },
  barWrapper: { width: 12, height: 100, backgroundColor: '#f5f5f7', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#0071e3', borderRadius: 6 },
  barLabel: { fontSize: 10, color: '#86868b', marginTop: 8, fontWeight: '500' },
  todayLabel: { color: '#0071e3', fontWeight: 'bold' },
  barCount: { fontSize: 10, color: '#1d1d1f', fontWeight: 'bold', marginTop: 2 },

  masterySection: { width: '100%' },
  masteryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-end' },
  masteryTitle: { fontSize: 13, fontWeight: 'bold', color: '#86868b' },
  masteryPercent: { fontSize: 16, fontWeight: '900', color: '#1d1d1f' },
  progressBarBg: { height: 8, backgroundColor: '#e5e5e7', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#34c759', borderRadius: 4 },

  mainStartSection: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 40 },
  welcomeTitle: { fontSize: 20, fontWeight: 'bold', color: '#1d1d1f', marginBottom: 20 },
  startBtn: { backgroundColor: '#1d1d1f', paddingVertical: 18, paddingHorizontal: 45, borderRadius: 22, shadowColor: '#000', shadowOffset: {width:0, height:6}, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Study Screen Styles
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, marginTop: 60 },
  quitBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  quitBtnText: { color: '#ff3b30', fontSize: 14, fontWeight: 'bold' },
  progressBadge: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 12, backgroundColor: '#1d1d1f' },
  progressText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  studyCardContainer: { flex: 1, padding: 20, justifyContent: 'center' },
  mainCard: { backgroundColor: '#fff', borderRadius: 32, padding: 25, shadowColor: '#000', shadowOffset: {width:0, height:12}, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5, minHeight: '75%' },
  cardWordSection: { alignItems: 'center', paddingVertical: 10 },
  cardWordText: { fontSize: 44, fontWeight: 'bold', color: '#1d1d1f', textAlign: 'center' },
  cardTypeText: { fontSize: 18, color: '#0071e3', fontStyle: 'italic', marginTop: 5 },
  cardContentDivider: { height: 1, backgroundColor: '#f0f0f2', marginVertical: 20, width: '100%' },
  
  cardDefinitionSection: { flex: 1, justifyContent: 'center' },
  cardLabel: { fontSize: 11, color: '#86868b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  cardDefinitionText: { fontSize: 20, color: '#1d1d1f', lineHeight: 28, fontWeight: '600' },
  cardExampleText: { fontSize: 17, color: '#424245', fontStyle: 'italic', lineHeight: 24 },
  cardHintText: { textAlign: 'center', color: '#d1d1d6', fontSize: 12, marginTop: 30, fontStyle: 'italic' },
  
  cardOptionsContainer: { flex: 1, justifyContent: 'center' },
  cardOptionBtn: { backgroundColor: '#f5f5f7', padding: 18, borderRadius: 20, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
  cardOptionText: { fontSize: 15, color: '#1d1d1f', lineHeight: 21 },
  cardOptionCorrect: { backgroundColor: '#e8f5e9', borderColor: '#34c759' },
  cardOptionTextCorrect: { color: '#248a3d', fontWeight: 'bold' },
  cardOptionWrong: { backgroundColor: '#fff5f5', borderColor: '#ff3b30' },
  cardOptionTextWrong: { color: '#c30000' },

  versionBtn: { position: 'absolute', bottom: 15, right: 20, padding: 5 },
  versionText: { color: '#d1d1d6', fontSize: 10 }
});
