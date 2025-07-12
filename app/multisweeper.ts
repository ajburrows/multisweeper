// Minesweeper game logic for a 5x5 grid

export type Cell = {
  hasMine: boolean;
  adjacentMines: number;
  revealed: boolean;
  flagged: boolean;
};

export type Grid = Cell[][];

export function createEmptyGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      hasMine: false,
      adjacentMines: 0,
      revealed: false,
      flagged: false,
    }))
  );
}

export function placeMines(
  grid: Grid,
  mineCount: number,
  excludeRow: number,
  excludeCol: number
): void {
  const numRows = grid.length;
  const numCols = grid[0].length;
  // Build forbidden set: clicked cell and all adjacent cells
  const forbidden = new Set<string>();
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 0], [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];
  for (const [dr, dc] of directions) {
    const r = excludeRow + dr;
    const c = excludeCol + dc;
    if (r >= 0 && r < numRows && c >= 0 && c < numCols) {
      forbidden.add(`${r},${c}`);
    }
  }
  let placed = 0;
  while (placed < mineCount) {
    const row = Math.floor(Math.random() * numRows);
    const col = Math.floor(Math.random() * numCols);
    if (
      !forbidden.has(`${row},${col}`) &&
      !grid[row][col].hasMine
    ) {
      grid[row][col].hasMine = true;
      placed++;
    }
  }
}

export function countAdjacentMines(grid: Grid): void {
  const numRows = grid.length;
  const numCols = grid[0].length;
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      if (grid[row][col].hasMine) {
        grid[row][col].adjacentMines = -1;
        continue;
      }
      let count = 0;
      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (
          nr >= 0 && nr < numRows &&
          nc >= 0 && nc < numCols &&
          grid[nr][nc].hasMine
        ) {
          count++;
        }
      }
      grid[row][col].adjacentMines = count;
    }
  }
}

export function revealCellsDFS(grid: Grid, row: number, col: number): Grid {
  const numRows = grid.length;
  const numCols = grid[0].length;
  const stack: [number, number][] = [[row, col]];
  const visited = Array.from({ length: numRows }, () => Array(numCols).fill(false));
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    if (
      r < 0 || r >= numRows ||
      c < 0 || c >= numCols ||
      visited[r][c] ||
      grid[r][c].revealed
    ) {
      continue;
    }
    grid[r][c].revealed = true;
    visited[r][c] = true;
    if (grid[r][c].adjacentMines === 0 && !grid[r][c].hasMine) {
      for (const [dr, dc] of directions) {
        stack.push([r + dr, c + dc]);
      }
    }
  }
  return grid;
} 