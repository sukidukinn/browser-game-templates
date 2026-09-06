(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');
  const highEl = document.getElementById('high');
  const messageEl = document.getElementById('message');
  const restartBtn = document.getElementById('restart');

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;

  const COLORS = {
    I: '#44d7ff', J: '#4e6cff', L: '#ff9a3d', O: '#f1df4d',
    S: '#57d66b', T: '#b56cff', Z: '#ff5b63'
  };

  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]]
  };

  let board, active, bag, score, lines, level, dropMs, lastDrop, gameOver, animationId;
  let high = Number(localStorage.getItem('tetrisHigh') || 0);
  highEl.textContent = high;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function shuffledBag() {
    const a = Object.keys(SHAPES);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function nextType() {
    if (!bag.length) bag = shuffledBag();
    return bag.pop();
  }

  function spawn() {
    const type = nextType();
    const matrix = SHAPES[type].map(row => row.slice());
    active = { type, matrix, x: Math.floor((COLS - matrix[0].length) / 2), y: -1 };
    if (collides(active, 0, 1)) endGame();
  }

  function collides(piece, dx = 0, dy = 0, matrix = piece.matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const bx = piece.x + x + dx;
        const by = piece.y + y + dy;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  function merge() {
    active.matrix.forEach((row, y) => row.forEach((v, x) => {
      const by = active.y + y;
      if (v && by >= 0) board[by][active.x + x] = active.type;
    }));
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropMs = Math.max(90, 700 - (level - 1) * 55);
      updateHud();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function move(dx) {
    if (!gameOver && !collides(active, dx, 0)) active.x += dx;
  }

  function softDrop(fromInput = false) {
    if (gameOver) return;
    if (!collides(active, 0, 1)) {
      active.y++;
      if (fromInput) score += 1;
    } else {
      lockPiece();
    }
    updateHud();
  }

  function hardDrop() {
    if (gameOver) return;
    let cells = 0;
    while (!collides(active, 0, 1)) { active.y++; cells++; }
    score += cells * 2;
    updateHud();
    lockPiece();
  }

  function rotateMatrix(matrix) {
    return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
  }

  function rotate() {
    if (gameOver || active.type === 'O') return;
    const rotated = rotateMatrix(active.matrix);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(active, kick, 0, rotated)) {
        active.x += kick;
        active.matrix = rotated;
        return;
      }
    }
  }

  function updateHud() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
    if (score > high) {
      high = score;
      localStorage.setItem('tetrisHigh', String(high));
      highEl.textContent = high;
    }
  }

  function endGame() {
    gameOver = true;
    messageEl.textContent = 'GAME OVER - Rでリスタート';
    updateHud();
  }

  function reset() {
    cancelAnimationFrame(animationId);
    board = emptyBoard();
    bag = [];
    score = 0;
    lines = 0;
    level = 1;
    dropMs = 700;
    lastDrop = performance.now();
    gameOver = false;
    messageEl.textContent = '';
    spawn();
    updateHud();
    animationId = requestAnimationFrame(loop);
  }

  function drawCell(x, y, type, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#16181d';
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x*BLOCK,0); ctx.lineTo(x*BLOCK,ROWS*BLOCK); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*BLOCK); ctx.lineTo(COLS*BLOCK,y*BLOCK); ctx.stroke(); }
    board.forEach((row, y) => row.forEach((type, x) => type && drawCell(x, y, type)));
    if (active) active.matrix.forEach((row, y) => row.forEach((v, x) => {
      const by = active.y + y;
      if (v && by >= 0) drawCell(active.x + x, by, active.type);
    }));
  }

  function loop(now) {
    if (!gameOver && now - lastDrop >= dropMs) {
      softDrop(false);
      lastDrop = now;
    }
    draw();
    animationId = requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', e => {
    const handled = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyR'].includes(e.code);
    if (handled) e.preventDefault();
    if (e.code === 'ArrowLeft') move(-1);
    if (e.code === 'ArrowRight') move(1);
    if (e.code === 'ArrowDown') softDrop(true);
    if (e.code === 'ArrowUp') rotate();
    if (e.code === 'Space') hardDrop();
    if (e.code === 'KeyR') reset();
  });

  restartBtn.addEventListener('click', reset);
  reset();
})();
