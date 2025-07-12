// If you haven't installed expo-linear-gradient, run: npx expo install expo-linear-gradient
import { LinearGradient } from 'expo-linear-gradient';
import { default as React, useState } from "react";
import { Dimensions, FlatList, Modal, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import {
  createEmptyGrid,
  Grid,
  revealCellsDFS
} from "./multisweeper";
const API_BASE_URL = "https://multisweeper-dpeu.onrender.com";


const DIFFICULTIES = [
  { label: "Easy (10x8, 10 mines)", value: "easy", rows: 10, cols: 8, mines: 10 },
  { label: "Medium (15x12, 25 mines)", value: "medium", rows: 15, cols: 12, mines: 25 },
  { label: "Hard (24x18, 50 mines)", value: "hard", rows: 24, cols: 18, mines: 50 },
];

// Dynamic container size based on difficulty
const getContainerSize = (difficulty: string, gridWidth: number, gridHeight: number) => {
  const margin = 40; // Small margin around the grid
  if (difficulty === "easy") {
    return {
      width: gridWidth + margin,
      height: gridHeight + margin,
    };
  } else {
    // Medium and Hard keep the current large container size
    return {
      width: Dimensions.get('window').width * 0.9,
      height: Dimensions.get('window').height * 0.6,
    };
  }
};

// Color map for adjacent mine numbers
const adjColors: { [key: number]: string } = {
  1: "#1976d2",
  2: "#388e3c",
  3: "#fbc02d",
  4: "#d32f2f",
  5: "#7b1fa2",
  6: "#0097a7",
  7: "#5d4037",
  8: "#455a64",
};

// Memoized Cell component
const Cell = React.memo(({
  cell,
  onPress,
  onLongPress,
  delayLongPress,
  cellStyle,
  rowIdx,
  colIdx
}: {
  cell: any,
  onPress: () => void,
  onLongPress: () => void,
  delayLongPress: number,
  cellStyle: any[],
  rowIdx: number,
  colIdx: number
}) => {
  return (
    <TouchableOpacity
      key={colIdx}
      style={cellStyle}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={cell.revealed && cell.adjacentMines === 0}
      activeOpacity={0.7}
    >
      {cell.flagged && !cell.revealed ? (
        <Text style={styles.flag}>🚩</Text>
      ) : cell.revealed ? (
        cell.hasMine ? (
          <Text style={styles.mine}>💣</Text>
        ) : cell.adjacentMines > 0 ? (
          <Text style={[styles.cellText, { color: adjColors[cell.adjacentMines] || "#333" }]}>{cell.adjacentMines}</Text>
        ) : null
      ) : null}
    </TouchableOpacity>
  );
});

export default function Index() {
  // Reanimated pan values
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const prevPanX = useSharedValue(0);
  const prevPanY = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value }
    ]
  }))
  // Cell size and margin must match styles.cell
  const CELL_SIZE = 36;
  const CELL_MARGIN = 2;
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [victoryVisible, setVictoryVisible] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [difficulty, setDifficulty] = useState("easy");
  const [flagCount, setFlagCount] = useState(0);
  const difficultyObj = DIFFICULTIES.find(d => d.value === difficulty) || DIFFICULTIES[0];
  const { rows, cols, mines } = difficultyObj;
  const gridWidth = (cols) * (CELL_SIZE + CELL_MARGIN);
  const gridHeight = (rows) * (CELL_SIZE + CELL_MARGIN);
  const containerSize = getContainerSize(difficulty, gridWidth, gridHeight);

  const animatedGridStyle = useAnimatedStyle(() => ({
    width: gridWidth + (difficulty === "easy" ? CELL_SIZE-CELL_MARGIN : difficulty === "medium" ? CELL_SIZE+(2*CELL_MARGIN) : (CELL_SIZE*1.4)+(1*CELL_MARGIN)),
    height: gridHeight + (difficulty === "easy" ? CELL_SIZE : difficulty === "medium" ? CELL_SIZE * 1.25 : CELL_SIZE * 1.75),
    position: 'absolute',
    left: 0,
    top: 0,
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
    ],
  }));

  const panGesture = Gesture.Pan()
  .minDistance(0)
  .onStart(() => {
    prevPanX.value = panX.value;
    prevPanY.value = panY.value;
  })
  .onUpdate(e => {
    panX.value = e.translationX + prevPanX.value;
    panY.value = e.translationY + prevPanY.value;
  });

  // Center the grid in the container on mount and when grid/container size changes
  React.useEffect(() => {
    const offsetX = (containerSize.width - gridWidth) / 2 - CELL_SIZE/2;
    const offsetY = (containerSize.height - gridHeight) / 2 - CELL_SIZE/2;
    panX.value = offsetX;
    panY.value = offsetY;
  }, [gridWidth, gridHeight, containerSize.width, containerSize.height]);
  const [grid, setGrid] = useState(() => createEmptyGrid(rows, cols));
  const [minesPlaced, setMinesPlaced] = useState(false);

  // Reset grid when difficulty changes
  React.useEffect(() => {
    setGrid(createEmptyGrid(rows, cols));
    setMinesPlaced(false);
  }, [difficulty]);

  // Update flag count when difficulty changes
  React.useEffect(() => {
    setFlagCount(mines);
  }, [difficulty]);

  // Timer effect
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive) {
      interval = setInterval(() => {
        setGameTime(prev => prev + 0.1);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive]);

  const formatTime = (seconds: number, precision: number = 1) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const secsFormatted = secs.toFixed(precision);
    return `${mins}:${secsFormatted.padStart(2 + precision, '0')}`;
  };

  const handleSettingsPress = () => {
    setSettingsVisible(true);
  };

  const handleSettingsClose = () => {
    setSettingsVisible(false);
  };

  const handleDifficultySelect = (value: string) => {
    setDifficulty(value);
    setSettingsVisible(false);
    setGameTime(0);
    setTimerActive(false);
  };

  const checkWin = (grid: Grid) => {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        const cell = grid[row][col];
        // If a cell doesn't have a mine and isn't revealed, the game isn't won yet
        if (!cell.hasMine && !cell.revealed) {
          return false;
        }
      }
    }
    return true;
  };

  const handleVictoryClose = () => {
    setVictoryVisible(false);
  };

  const handleCellPress = async (row: number, col: number) => {
    let newGrid: Grid = grid;
    const cell = newGrid[row][col];
    if (cell.revealed && cell.adjacentMines > 0) {
      // Chording: If clicking a revealed numbered tile, check for auto-reveal
      const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1], [1, 0], [1, 1],
      ];
      let flaggedCount = 0;
      let unrevealedUnflagged: [number, number][] = [];
      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (
          nr >= 0 && nr < newGrid.length &&
          nc >= 0 && nc < newGrid[0].length
        ) {
          const neighbor = newGrid[nr][nc];
          if (!neighbor.revealed && neighbor.flagged) flaggedCount++;
          if (!neighbor.revealed && !neighbor.flagged) unrevealedUnflagged.push([nr, nc]);
        }
      }
      if (flaggedCount === cell.adjacentMines) {
        let revealedAny = false;
        let bombRevealed = false;
        for (const [nr, nc] of unrevealedUnflagged) {
          if (!newGrid[nr][nc].revealed && !newGrid[nr][nc].flagged) {
            revealedAny = true;
            if (newGrid[nr][nc].hasMine) {
              bombRevealed = true;
              newGrid[nr][nc].revealed = true;
            } else if (newGrid[nr][nc].adjacentMines === 0) {
              newGrid = revealCellsDFS(newGrid, nr, nc);
            } else {
              newGrid[nr][nc].revealed = true;
            }
          }
        }
        if (revealedAny) {
          if (bombRevealed) {
            // Reveal all bombs (game over)
            for (let r = 0; r < newGrid.length; r++) {
              for (let c = 0; c < newGrid[0].length; c++) {
                if (newGrid[r][c].hasMine) newGrid[r][c].revealed = true;
              }
            }
            setTimerActive(false);
          }
          setGrid(newGrid);
          if (!bombRevealed && checkWin(newGrid)) {
            setTimerActive(false);
            setVictoryVisible(true);
          }
        }
      }
      return;
    }
    if (!cell.revealed && cell.flagged) return; // Don't reveal flagged cells
    if (!minesPlaced) {
      // Deep copy for first reveal (since mines are placed and grid is mutated)
      newGrid = grid.map((rowArr, r) =>
        rowArr.map((cell, c) => ({ ...cell }))
      );
//
    const response = await fetch(`${API_BASE_URL}/start-game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows,
        cols,
        mines,
        firstClickRow: row,
        firstClickCol: col,
      }),
    });

    const result = await response.json();
    setGrid(result.grid);
    setMinesPlaced(true);
    setTimerActive(true);


//

    } else {
      if (!cell.revealed) {
        // Only copy the row and cell that change
        const newRow = [...newGrid[row]];
        let changed = false;
        if (cell.hasMine) {
          // Reveal all mines (game over logic placeholder)
          newGrid = newGrid.map((rowArr) =>
            rowArr.map((cell) =>
              cell.hasMine ? { ...cell, revealed: true } : cell
            )
          );
          setGrid(newGrid);
        } else if (cell.adjacentMines === 0) {
          // For DFS, still need to copy the grid
          newGrid = grid.map((rowArr, r) =>
            rowArr.map((cell, c) => ({ ...cell }))
          );
//
        try {
          const response = await fetch(`${API_BASE_URL}/reveal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grid,
              row,
              col,
            }),
          });

          const result = await response.json();
          setGrid(result.grid);
        } catch (err) {
          console.error("Reveal error:", err);
        }


//


        } else {
          newRow[col] = { ...cell, revealed: true };
          newGrid = [...newGrid];
          newGrid[row] = newRow;
          setGrid(newGrid);
        }
      }
    }
    // Check for win after revealing cells
    if (checkWin(newGrid)) {
      setTimerActive(false); // Stop timer when game is won
      setVictoryVisible(true);
    }
  };

  const handleCellLongPress = (row: number, col: number) => {
    const cell = grid[row][col];
    if (!cell.revealed) {
      // Only copy the row and cell that change
      const newRow = [...grid[row]];
      newRow[col] = { ...cell, flagged: !cell.flagged };
      const newGrid = [...grid];
      newGrid[row] = newRow;
      setFlagCount(prev => !cell.flagged ? prev - 1 : prev + 1);
      setGrid(newGrid);
    }
  };

  const handleReset = () => {
    setGrid(createEmptyGrid(rows, cols));
    setMinesPlaced(false);
    setFlagCount(mines);
    setGameTime(0);
    setTimerActive(false);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <PaperProvider>
    <LinearGradient colors={["#43cea2", "#185a9d"]} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Multisweeper</Text>
        <TouchableOpacity style={[styles.settingsButton, { position: 'absolute', right: 20 }]} onPress={handleSettingsPress}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.infoBar}>
        <Text style={styles.timerText}>⏱️ {formatTime(gameTime)}</Text>
        <Text style={styles.flagCounter}>🚩 {flagCount}</Text>
      </View>
      <View style={[styles.gridPanContainer, { width: containerSize.width, height: containerSize.height }]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.grid, animatedGridStyle]}>
            <FlatList
              scrollEnabled={false}
              data={grid}
              keyExtractor={(_, rowIdx) => rowIdx.toString()}
              renderItem={({ item: rowArr, index: rowIdx }) => (
                <FlatList
                  data={rowArr}
                  keyExtractor={(_, colIdx) => colIdx.toString()}
                  horizontal
                  renderItem={({ item: cell, index: colIdx }) => {
                    let cellStyle: StyleProp<ViewStyle>[] = [styles.cell];
                    if (cell.revealed) cellStyle.push(styles.revealedCell);
                    if (cell.hasMine && cell.revealed) cellStyle.push(styles.mineCell);

                    return (
                      <Cell
                        cell={cell}
                        onPress={() => handleCellPress(rowIdx, colIdx)}
                        onLongPress={() => handleCellLongPress(rowIdx, colIdx)}
                        delayLongPress={250}
                        cellStyle={cellStyle}
                        rowIdx={rowIdx}
                        colIdx={colIdx}
                      />
                    );
                  }}
                  scrollEnabled={false}
                  contentContainerStyle={styles.row}
                  getItemLayout={(_, index) => ({
                    length: CELL_SIZE + CELL_MARGIN,
                    offset: (CELL_SIZE + CELL_MARGIN) * index,
                    index,
                  })}
                />
              )}
              extraData={grid}
              getItemLayout={(_, index) => ({
                length: CELL_SIZE + CELL_MARGIN,
                offset: (CELL_SIZE + CELL_MARGIN) * index,
                index,
              })}
              showsVerticalScrollIndicator={false}
              bounces={false}
            />
          </Animated.View>
        </GestureDetector>
      </View>
      <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetText}>Reset</Text>
      </TouchableOpacity>
      <Modal
        visible={settingsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSettingsClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Text style={styles.modalSubtitle}>Select Difficulty:</Text>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity
                key={d.value}
                style={[
                  styles.difficultyOption,
                  d.value === difficulty && styles.selectedDifficulty
                ]}
                onPress={() => handleDifficultySelect(d.value)}
              >
                <Text style={[
                  styles.difficultyText,
                  d.value === difficulty && styles.selectedDifficultyText
                ]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeButton} onPress={handleSettingsClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={victoryVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleVictoryClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.victoryTitle}>Victory!</Text>
            <Text style={styles.victoryText}>Congratulations! You've cleared all the safe cells in {formatTime(gameTime, 2)}!</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleVictoryClose}>
              <Text style={styles.closeButtonText}>Continue Playing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
    </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // backgroundColor replaced by gradient
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
    position: 'relative',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1,
    textShadowColor: "#0006",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
    flex: 1,
    textAlign: 'center',
  },
  flagCounter: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    textShadowColor: "#0006",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  settingsButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  pickerContainer: {
    width: 260,
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "#ffffff44",
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pickerLabel: {
    color: "#185a9d",
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 4,
  },
  menuButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 0,
    marginBottom: 0,
    minWidth: 180,
    elevation: 2,
  },
  grid: {
    backgroundColor: "#ffffff33",
    padding: 8,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    width: 36,
    height: 36,
    backgroundColor: "#43cea2",
    margin: 2,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    elevation: 2,
  },
  revealedCell: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#43cea2",
  },
  mineCell: {
    backgroundColor: "#ff5252",
    borderColor: "#b71c1c",
  },
  cellText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textShadowColor: "#0002",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mine: {
    fontSize: 26,
    color: "#fff",
    textShadowColor: "#000a",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  flag: {
    fontSize: 24,
    color: "#ffb300",
    textShadowColor: "#000a",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
    textAlign: "center",
  },
  resetButton: {
    marginTop: 32,
    backgroundColor: "#1976d2",
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  resetText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 1,
    textShadowColor: "#0006",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  gridPanContainer: {
    // width and height are set dynamically in the component
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  difficultyOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: '#f5f5f5',
  },
  selectedDifficulty: {
    backgroundColor: '#1976d2',
  },
  difficultyText: {
    fontSize: 16,
    color: '#333',
  },
  selectedDifficultyText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  victoryTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4caf50',
    marginBottom: 16,
    textAlign: 'center',
  },
  victoryText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  timerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    textShadowColor: "#0006",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
});
