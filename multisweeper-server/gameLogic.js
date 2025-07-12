function createEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      hasMine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
    }))
  );
}

function placeMines(grid, mineCount, safeRow, safeCol) {
  const rows = grid.length;
  const cols = grid[0].length;
  const positions = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Don't place a mine on the first clicked cell
      if (!(r === safeRow && c === safeCol)) {
        positions.push([r, c]);
      }
    }
  }

  // Shuffle and take the first N
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  const selected = positions.slice(0, mineCount);
  for (const [r, c] of selected) {
    grid[r][c].hasMine = true;
  }
}

function countAdjacentMines(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1],  [1, 0], [1, 1],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].hasMine) continue;

      let count = 0;
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (
          nr >= 0 && nr < rows &&
          nc >= 0 && nc < cols &&
          grid[nr][nc].hasMine
        ) {
          count++;
        }
      }
      grid[r][c].adjacentMines = count;
    }
  }
}

function revealCellsDFS(grid, row, col) {
  const rows = grid.length;
  const cols = grid[0].length;
  const stack = [[row, col]];
  const visited = new Set();

  const isSafe = (r, c) =>
    r >= 0 && r < rows &&
    c >= 0 && c < cols &&
    !grid[r][c].revealed &&
    !visited.has(`${r},${c}`);

  while (stack.length) {
    const [r, c] = stack.pop();
    const key = `${r},${c}`;
    if (!isSafe(r, c)) continue;

    grid[r][c].revealed = true;
    visited.add(key);

    if (grid[r][c].adjacentMines === 0 && !grid[r][c].hasMine) {
      for (const [dr, dc] of [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],          [0, 1],
        [1, -1], [1, 0], [1, 1],
      ]) {
        stack.push([r + dr, c + dc]);
      }
    }
  }

  return grid;
}

module.exports = {
  createEmptyGrid,
  placeMines,
  countAdjacentMines,
  revealCellsDFS,
};
