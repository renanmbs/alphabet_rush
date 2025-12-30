import React, { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";
import { categories as CATEGORIES } from "./categories";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ROUND_TIME = 15;

export default function App() {
  // ───────────────── STATE ─────────────────
  const [playerCount, setPlayerCount] = useState(0);
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [eliminated, setEliminated] = useState([]);
  const [skipsLeft, setSkipsLeft] = useState({});
  const [catSkipAvailable, setCatSkipAvailable] = useState(true);

  const [category, setCategory] = useState("");
  const [letters, setLetters] = useState(ALPHABET);
  const [usedLetters, setUsedLetters] = useState([]);

  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [turnStart, setTurnStart] = useState(null);
  const [pausedAt, setPausedAt] = useState(null);

  const [active, setActive] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  const [setup, setSetup] = useState(true);
  const [askingCount, setAskingCount] = useState(true);
  const [mode, setMode] = useState("choose");
  const [showRules, setShowRules] = useState(false);

  const [allCleared, setAllCleared] = useState(false);
  const [lastWinner, setLastWinner] = useState(null);
  const [winReason, setWinReason] = useState(null);
  const [seriesScores, setSeriesScores] = useState({});
  const [analytics, setAnalytics] = useState([]);

  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  const panic = timeLeft <= 3 && active && gameStarted && !isPaused;
  const currentLetter = mode === "random" && usedLetters.length < letters.length ? letters[usedLetters.length] : null;

  // ───────────────── HELPERS ─────────────────
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  const startRound = (finalPlayers, newSeries = false) => {
    setCategory(CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]);
    setLetters(mode === "random" ? shuffle(ALPHABET) : ALPHABET);
    setUsedLetters([]);
    setEliminated([]);
    setAnalytics([]);
    setCatSkipAvailable(true);

    const skips = {};
    finalPlayers.forEach(p => skips[p] = 1);
    setSkipsLeft(skips);

    if (newSeries) {
      const scores = {};
      finalPlayers.forEach(p => scores[p] = 0);
      setSeriesScores(scores);
    }

    setCurrentPlayer(0);
    setTimeLeft(ROUND_TIME);
    setTurnStart(null);
    setPausedAt(null);
    setIsPaused(false);
    setGameStarted(false);
    setIsCounting(false);
    setAllCleared(false);
    setActive(true);
  };

const endRound = useCallback((winner, reason) => {
    setActive(false);
    setGameStarted(false);
    setAllCleared(true);
    setLastWinner(winner);
    setWinReason(reason);
    setSeriesScores(p => ({ ...p, [winner]: (p[winner] || 0) + 1 }));
  }, []);

const moveToNextPlayer = useCallback((nextElim = eliminated) => {
    let idx = (currentPlayer + 1) % players.length;
    while (nextElim.includes(players[idx])) {
      idx = (idx + 1) % players.length;
    }
    setCurrentPlayer(idx);
    setTimeLeft(ROUND_TIME);
    if (gameStarted) setTurnStart(Date.now());
  }, [currentPlayer, eliminated, gameStarted, players]);

const togglePause = useCallback(() => {
    if (!active || !gameStarted) return;
    if (!isPaused) {
      setPausedAt(Date.now());
      setIsPaused(true);
    } else {
      const delta = Date.now() - pausedAt;
      setTurnStart(prev => prev + delta);
      setIsPaused(false);
    }
  }, [active, gameStarted, isPaused, pausedAt]);

  // ───────────────── ACTIONS ─────────────────
  const handleTurn = useCallback(letter => {
    if (!active || !gameStarted || isPaused || isCounting) return;
    if (!letter || usedLetters.includes(letter)) return;

    const elapsed = Math.floor((Date.now() - turnStart) / 1000);
    setAnalytics(a => [...a, { player: players[currentPlayer], letter, time: elapsed }]);

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);

    const updated = [...usedLetters, letter];
    setUsedLetters(updated);

    if (updated.length === 26) {
      endRound(players[currentPlayer], "all-cleared");
      return;
    }
    moveToNextPlayer();
  }, [active, gameStarted, isPaused, isCounting, usedLetters, turnStart, players, currentPlayer, endRound, moveToNextPlayer]);

  const handleSkip = useCallback(() => {
    const p = players[currentPlayer];
    if (!skipsLeft[p] || isPaused || isSkipping || !gameStarted) return;

    setSkipsLeft(s => ({ ...s, [p]: 0 }));
    setIsSkipping(true);
    setTimeout(() => {
      setIsSkipping(false);
      moveToNextPlayer();
    }, 400);
  }, [players, currentPlayer, skipsLeft, isPaused, isSkipping, gameStarted, moveToNextPlayer]);

  const handleCategorySkip = () => {
    if (!catSkipAvailable || gameStarted) return;
    setCategory(CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]);
    setCatSkipAvailable(false);
  };

  const handleTimeout = useCallback(() => {
    const out = players[currentPlayer];
    const nextElim = [...eliminated, out];
    const remaining = players.filter(p => !nextElim.includes(p));

    setAnalytics(a => [...a, { player: out, letter: null, time: ROUND_TIME }]);

    if (remaining.length === 1) {
      endRound(remaining[0], "last-standing");
    } else {
      setEliminated(nextElim);
      setActive(false);
    }
  }, [players, currentPlayer, eliminated, endRound]);

  // ───────────────── EFFECTS ─────────────────
  useEffect(() => {
    if (!active || !gameStarted || isPaused || isCounting) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      if (!turnStart) return;
      const elapsed = Math.floor((Date.now() - turnStart) / 1000);
      const remaining = Math.max(0, ROUND_TIME - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        handleTimeout();
      }
    }, 200);

    return () => clearInterval(timerRef.current);
  }, [active, gameStarted, isPaused, isCounting, turnStart, eliminated, players, handleTimeout]);

  useEffect(() => {
    const onKey = (e) => {
      if (showRules || e.target.tagName === "INPUT" || !active) return;
      const key = e.key.toUpperCase();

      if (e.code === "Space") {
        e.preventDefault();
        if (!gameStarted) return;
        mode === "random" ? handleTurn(currentLetter) : togglePause();
        return;
      }

      if (!gameStarted || isPaused) return;
      if (e.code === "Enter" && mode === "choose") handleSkip();
      if (key === "S" && mode === "random") handleSkip();
      if (mode === "choose" && ALPHABET.includes(key)) handleTurn(key);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameStarted, isPaused, active, mode, currentLetter, usedLetters, pausedAt, turnStart, showRules, handleSkip, handleTurn, togglePause]);

  // ───────────────── COUNTDOWN EFFECT ─────────────────
  useEffect(() => {
    if (isCounting) {
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            setIsCounting(false);
            setGameStarted(true);
            setTurnStart(Date.now());
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [isCounting]);

  // ───────────────── RENDER ─────────────────
  if (setup) {
    return (
      <div className="setup">
        <button className="rules-btn pretty" onClick={() => setShowRules(true)}>?</button>
        <h1 className="logo" onClick={() => window.location.reload()}>ALPHABET RUSH</h1>
        {askingCount ? (
          <div className="card scale-in">
            <h2>Number of Players</h2>
            <div className="count-grid">
              {[2,3,4].map(n => <button key={n} className="count-opt" onClick={() => { setPlayerCount(n); setAskingCount(false); }}>{n}</button>)}
              <input className="custom-count-input" type="number" placeholder="Custom" onChange={(e) => { const v = parseInt(e.target.value); if(v > 1) { setPlayerCount(v); setAskingCount(false); }}} />
            </div>
          </div>
        ) : (
          <SetupScreen count={playerCount} mode={mode} setMode={setMode} onStart={names => { setPlayers(names); setSetup(false); startRound(names, true); }} />
        )}
        {showRules && <RulesModal mode={mode} onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  return (
    <div className="app no-scroll">
      <div className="game-top-bar">
        <button className="bar-btn" onClick={() => window.location.reload()}>Quit</button>
        <div className="active-player-hero">
          <div className="player-name-big">{players[currentPlayer]}</div>
          <div className="skip-status">{skipsLeft[players[currentPlayer]] > 0 ? "✨ Skip Available" : "❌ Skip Used"}</div>
        </div>
        <button className="bar-btn help" onClick={() => setShowRules(true)}>?</button>
      </div>

      <div className="series-banner">
        {players.map(p => (
          <div key={p} className={`series-score ${eliminated.includes(p) ? 'is-eliminated' : ''}`}>
            {p}: {seriesScores[p] || 0}
          </div>
        ))}
      </div>

      <div className="category-section" style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div className="cat-pill">
            <span className="label">CATEGORY</span>
            <div className="text">{category}</div>

            {mode === "random" && gameStarted && (
            <div className="next-letter-pill">
                <span className="label">YOUR LETTER:</span>
                <span className="val">{currentLetter}</span>
            </div>
        )}
        </div>
        {!gameStarted && active && !isCounting && (
          <button className="cat-skip-btn" onClick={handleCategorySkip} disabled={!catSkipAvailable}>
            {catSkipAvailable ? "↺ Skip Category" : "No skips left"}
          </button>
        )}
      </div>

      <div className={`timer-display ${panic ? "panic" : ""}`}>
        {isCounting && <div className="countdown-overlay"><div className="countdown-text">{countdown}</div></div>}
        <svg className="timer-svg" viewBox="0 0 100 100">
          <circle className="timer-bg" cx="50" cy="50" r="45" />
          <circle className="timer-bar" cx="50" cy="50" r="45" style={{ strokeDashoffset: 283 - (283 * timeLeft) / ROUND_TIME }} />
        </svg>
        <div className="time-val">{isCounting ? "" : isPaused ? "PAUSED" : isSkipping ? "SKIPPING" : timeLeft}</div>
      </div>

      <div className="in-game-controls">
        {!gameStarted && active ? (
          <button className="start-btn" onClick={() => setIsCounting(true)}>START TIMER</button>
        ) : (
          <>
            <button className="control-btn" onClick={togglePause}>{isPaused ? "RESUME" : "PAUSE"}</button>
            <button className="control-btn" disabled={skipsLeft[players[currentPlayer]] === 0 || isPaused} onClick={handleSkip}>SKIP</button>
          </>
        )}
        {mode === "random" && gameStarted && (
          <button className={`big-done-btn ${isFlashing ? "success-flash" : ""}`} onClick={() => handleTurn(currentLetter)} disabled={isPaused}>DONE</button>
        )}
      </div>

      <div className="letter-area">
        <div className="grid">
          {ALPHABET.map(l => (
            <button key={l} className={`letter-btn ${usedLetters.includes(l) ? "used" : ""} ${mode === 'random' && currentLetter === l ? 'highlight' : ''}`}
              disabled={usedLetters.includes(l) || (mode === "random" && gameStarted) || !gameStarted} onClick={() => handleTurn(l)}>{l}</button>
          ))}
        </div>
      </div>

      {(allCleared || !active) && !setup && (
        <div className="modal-overlay">
          <div className="out-card card">
            {allCleared ? (
              <>
                <h1>{winReason === "last-standing" ? "LAST STANDING" : "CLEARED!"}</h1>
                <h2 className="player-name-big">🏆 {lastWinner}</h2>
                <Heatmap analytics={analytics} />
              </>
            ) : (
              <>
                <h1 style={{color: 'var(--danger)'}}>ELIMINATED!</h1>
                <p>Ran out of time.</p>
              </>
            )}
            <div className="end-actions">
              {!allCleared && <button className="primary-btn" onClick={() => { setActive(true); setGameStarted(false); setTimeLeft(ROUND_TIME); setTurnStart(null); }}>Continue Round</button>}
              <button className="secondary-btn" onClick={() => startRound(players, false)}>Next Round</button>
              <button className="secondary-btn" onClick={() => window.location.reload()}>Quit Game</button>
            </div>
          </div>
        </div>
      )}
      {showRules && <RulesModal mode={mode} onClose={() => setShowRules(false)} />}
    </div>
  );
}

function SetupScreen({ count, mode, setMode, onStart }) {
  const [names, setNames] = useState(Array(count).fill(""));
  return (
    <div className="card scale-in">
      <div className="mode-toggle">
        <button className={mode === "choose" ? "active" : ""} onClick={() => setMode("choose")}>Classic</button>
        <button className={mode === "random" ? "active" : ""} onClick={() => setMode("random")}>Auto</button>
      </div>
      <div className="names-scroll">
        {names.map((n, i) => (
          <div key={i} className="name-input-wrapper">
            <span className="name-num">{i + 1}</span>
            <input placeholder={`Player ${i + 1}`} value={n} onChange={e => { const next = [...names]; next[i] = e.target.value; setNames(next); }} />
          </div>
        ))}
      </div>
      <button className="start-btn" onClick={() => onStart(names.map((n, i) => n || `Player ${i + 1}`))}>START GAME</button>
    </div>
  );
}

function Heatmap({ analytics }) {
  return (
    <div className="heatmap-container">
      <h3>Letter Speed Map</h3>
      <div className="heatmap-grid">
        {ALPHABET.map((l) => {
          const data = analytics.find((a) => a.letter === l);
          const hue = data ? Math.max(0, 120 - data.time * 8) : 0;
          return (
            <div key={l} className={`heat-box ${!data ? "unplayed" : ""}`} style={data ? { backgroundColor: `hsl(${hue}, 70%, 45%)` } : {}}>
              <span>{l}</span>
              {data && <span className="heat-time">{data.time}s</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RulesModal({ onClose, mode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="out-card card" style={{maxWidth: '500px'}} onClick={e => e.stopPropagation()}>
        <h2>Shortcuts & Rules</h2>
        <div style={{textAlign: 'left', marginBottom: '20px'}}>
          <ul style={{listStyle: 'none', padding: 0}}>
            <li><kbd>Space</kbd> {mode === "random" ? "Done!" : "Pause / Resume"}</li>
            <li><kbd>Enter</kbd> {mode === "random" ? "Skip" : "N/A"}</li>
            <li><kbd>S</kbd> Skip Turn</li>
            <li><kbd>A-Z</kbd> Submit (Classic)</li>
          </ul>
        </div>
        <button className="primary-btn" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}