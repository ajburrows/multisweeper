const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || "dev_secret_key";

const {
  createEmptyGrid,
  placeMines,
  countAdjacentMines,
  revealCellsDFS
} = require("./gameLogic");


app.use(cors());
app.use(express.json());

const USERS_FILE = "./users.json";

// Load existing users
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, "utf-8");
  return JSON.parse(data);
}

// Save users back to file
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 📝 Register endpoint
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  if (users.some(user => user.username === username)) {
    return res.status(400).json({ error: "Username already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    username,
    password: hashedPassword
  };

  users.push(newUser);
  saveUsers(users);

  res.json({ message: "User registered successfully" });
});

// 🔑 Login endpoint
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  const user = users.find(user => user.username === username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: "1h" });
  res.json({ token });
});

// ✅ Auth-protected test route
app.get("/profile", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    res.json({ message: "Welcome!", user: decoded });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});


app.post("/start-game", (req, res) => {
  const start = Date.now();

  const { rows, cols, mines, firstClickRow, firstClickCol } = req.body;

  let grid = createEmptyGrid(rows, cols);
  placeMines(grid, mines, firstClickRow, firstClickCol);
  countAdjacentMines(grid);
  grid = revealCellsDFS(grid, firstClickRow, firstClickCol);

  const end = Date.now();
  console.log(`⏱️ Grid generation took ${end - start}ms`);

  res.json({ grid });
});

app.post("/reveal", (req, res) => {
  const { grid, row, col } = req.body;

  if (!grid || grid.length === 0) {
    return res.status(400).json({ error: "Invalid grid data" });
  }

  const cell = grid[row][col];
  if (cell.revealed || cell.flagged) {
    return res.json({ grid }); // nothing to update
  }

  // Deep copy to avoid mutating client state (optional but safer)
  const copiedGrid = grid.map(row => row.map(cell => ({ ...cell })));

  const updatedGrid = revealCellsDFS(copiedGrid, row, col);
  res.json({ grid: updatedGrid });
});



app.get("/", (req, res) => {
    res.send("✅ Multisweeper backend is running!");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});