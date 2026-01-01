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
    // 1. Shuffle the players to randomize the sequence
    const randomizedPlayers = shuffle(finalPlayers);

    // 2. Use the randomized list for the category and state
    setCategory(CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]);
    setLetters(mode === "random" ? shuffle(ALPHABET) : ALPHABET);
    setUsedLetters([]);
    setEliminated([]);
    setAnalytics([]);
    setCatSkipAvailable(true);

    // Use the randomized list to set the players
    setPlayers(randomizedPlayers);

    const skips = {};
    randomizedPlayers.forEach(p => skips[p] = 1);
    setSkipsLeft(skips);

    if (newSeries) {
      const scores = {};
      randomizedPlayers.forEach(p => scores[p] = 0);
      setSeriesScores(scores);
    }

    setCurrentPlayer(0); // This now refers to the first person in the shuffled list
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

    // 1. Spacebar (Classic - pause / Auto - done)
    // We keep this here because togglePause handles its own state
    if (e.code === "Space") {
      e.preventDefault();
      if (!gameStarted) return;
      mode === "random" ? handleTurn(currentLetter) : togglePause();
      return;
    }

    // 2. Enter Key (Random - pause / Classic - skip)
    // MOVED ABOVE the isPaused check so it can unpause!
    if (e.code === "Enter") {
      e.preventDefault();
      if (!gameStarted) return;

      if (mode === "random") {
        togglePause(); // This will now work to BOTH pause and unpause
      } else {
        if (!isPaused) handleSkip(); // Only skip if not paused
      }
      return;
    }

    // --- Safety Gate ---
    // Anything below this requires the game to be unpaused
    if (!gameStarted || isPaused) return;

    // 3. Skip (S key)
    if (key === "S" && mode === "random") handleSkip();

    // 4. Submit alphabet (Classic Mode)
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
              {[2, 3, 4].map(n => <button key={n} className="count-opt" onClick={() => { setPlayerCount(n); setAskingCount(false); }}>{n}</button>)}
              <input className="custom-count-input" type="number" placeholder="Custom" onChange={(e) => { const v = parseInt(e.target.value); if (v > 1) { setPlayerCount(v); setAskingCount(false); } }} />
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
        <button className="bar-btn help" onClick={() => setShowRules(true)}>?</button>
      </div>

      <div className="series-banner">
        {players.map(p => (
          <div key={p} className={`series-score ${eliminated.includes(p) ? 'is-eliminated' : ''}`}>
            {p}: {seriesScores[p] || 0}
          </div>
        ))}
      </div>

      <div className="category-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
  {/* Updated Hero Section */}
  <div className="active-player-hero">
    <div className="hero-row">
      <h2 className="player-name-big">{players[currentPlayer]}</h2>
      <span className="skip-badge">
        {skipsLeft[players[currentPlayer]] > 0 ? "✨ Skip Available" : "❌ Skip Used"}
      </span>
    </div>
  </div>

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
                <h1 style={{ color: 'var(--danger)' }}>ELIMINATED!</h1>
                <p>Ran out of time.</p>
              </>
            )}
            <div className="end-actions">
              {!allCleared && <button className="primary-btn" onClick={() => { setActive(true); setGameStarted(false); setTimeLeft(ROUND_TIME); setTurnStart(null); }}>Continue Round</button>}
              <button className="secondary-btn" onClick={() => startRound(players, false)}>
                Next Round
              </button>
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
        <button className={mode === "random" ? "active" : ""} onClick={() => setMode("random")}>Random</button>
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
      <div className="rules-card card scale-in" onClick={e => e.stopPropagation()}>
        <header className="rules-header">
          <h2>Game Guide</h2>
          <button className="close-x" onClick={onClose}>&times;</button>
        </header>

        <div className="rules-grid">
          {/* Section 1: Objective & Modes */}
          <div className="rules-box">
            <h3>🎮 How to Play</h3>
            <p>Beat the <strong>15s timer</strong> by naming something in the category starting with the {mode === 'random' ? 'assigned' : 'chosen'} letter.</p>
            <div className="mode-badge"><strong>Auto Mode:</strong> Letter assigned</div>
            <div className="mode-badge"><strong>Classic Mode:</strong> Choose any letter</div>
          </div>

          {/* Section 2: Special Moves */}
          <div className="rules-box">
            <h3>✨ Power-Ups</h3>
            <div className="mini-flex">
              <span><strong>1 Player Skip</strong> per round</span><br />
              <span><strong>1 Category Swap</strong> (at start)</span>
            </div>
          </div>

          {/* Section 3: Shortcuts */}
          <div className="rules-box full-width">
            <h3>⌨️ Shortcuts</h3>
            <h4>Classic Mode</h4>
            <div className="shortcut-row">
              <div className="key-item"><kbd>{"A-Z"}</kbd> <span>Submit</span></div>
              <div className="key-item"><kbd>{"ENTER"}</kbd> <span>Skip</span></div>
              <div className="key-item"><kbd>{"SPACE"}</kbd> <span>Pause/Resume</span></div>
            </div>
            <h4>Random Mode</h4>
            <div className="shortcut-row">
              <div className="key-item"><kbd>{"SPACE"}</kbd> <span>Submit</span></div>
              <div className="key-item"><kbd>{"S"}</kbd> <span>Skip</span></div>
              <div className="key-item"><kbd>{"Enter"}</kbd> <span>Pause/Resume</span></div>
            </div>
          </div>

          {/* Section 4: Winning */}
          <div className="rules-box highlight">
            <h3>🏆 Win Condition</h3>
            <p>Be the <strong>last player standing</strong> or <strong>clear the final letter</strong> of the alphabet!</p>
          </div>
        </div>

        <button className="primary-btn finish-btn change" onClick={onClose}>Ready to Rush</button>
      </div>
    </div>
  );
}