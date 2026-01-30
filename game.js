// 激突四駆RE - メインゲームロジック
// ファミコン「激突四駆バトル」オマージュ

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;   // 1200
const H = canvas.height;  // 900

// ========================================
// 定数
// ========================================
const SCALE = 1.5;         // ドット絵拡大率（元の半分: 3→1.5）
const TOTAL_LAPS = 5;
const MAX_HP = 100;
const SPECIAL_COOLDOWN = 300;
const AI_COUNT = 5;

// FCパレット風カラー
const FC_BLACK   = "#0f0f0f";
const FC_DKGRAY  = "#303030";
const FC_WHITE   = "#fcfcfc";
const FC_RED     = "#c83028";
const FC_BLUE    = "#0058a8";
const FC_GREEN   = "#00a800";
const FC_YELLOW  = "#f8d800";
const FC_CYAN    = "#00e8d8";
const FC_ORANGE  = "#f87818";

// ボディカラー選択肢（オレンジ部分を差し替える）
const BODY_COLORS = [
  { name: "オレンジ",   hueShift: 0,   color: "#f87818" },
  { name: "レッド",     hueShift: -15, color: "#e03020" },
  { name: "ブルー",     hueShift: 200, color: "#2060e0" },
  { name: "グリーン",   hueShift: 100, color: "#20b040" },
  { name: "イエロー",   hueShift: 30,  color: "#e8c010" },
  { name: "ホワイト",   hueShift: 0,   color: "#e0e0e0" },
  { name: "パープル",   hueShift: 260, color: "#9030d0" },
  { name: "ピンク",     hueShift: 320, color: "#e05090" },
  { name: "シアン",     hueShift: 170, color: "#00c8c8" },
  { name: "ブラック",   hueShift: 0,   color: "#383838" },
];

let playerColor1 = 0;  // 1P カラー選択インデックス
let playerColor2 = 3;  // 2P カラー選択インデックス

// ========================================
// 画像読み込み & カラー変換
// ========================================
const carImagesOriginal = [];
let imagesLoaded = 0;

// 各車×各色の着色済みcanvasをキャッシュ
const coloredCarCache = {};

CAR_DATA.forEach((data) => {
  const img = new Image();
  img.src = data.img;
  img.onload = () => { imagesLoaded++; };
  carImagesOriginal.push(img);
});

// オレンジ系ピクセルを検出して別色に置換したcanvasを生成
function getColoredCar(carIndex, colorIndex) {
  const key = `${carIndex}_${colorIndex}`;
  if (coloredCarCache[key]) return coloredCarCache[key];

  const img = carImagesOriginal[carIndex];
  if (!img || !img.complete || img.naturalWidth === 0) return null;

  const offCanvas = document.createElement("canvas");
  offCanvas.width = img.naturalWidth;
  offCanvas.height = img.naturalHeight;
  const offCtx = offCanvas.getContext("2d");
  offCtx.drawImage(img, 0, 0);

  if (colorIndex !== 0) { // 0=オレンジ（オリジナル）
    const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const d = imageData.data;
    const targetColor = hexToRgb(BODY_COLORS[colorIndex].color);

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (a === 0) continue;
      // オレンジ系: R高め、G中程度、B低め
      if (r > 150 && g > 60 && g < 180 && b < 80 && r > g) {
        // 明度を保持しつつ色相を変更
        const brightness = (r + g + b) / (248 + 120 + 24); // 元オレンジの平均で正規化
        d[i]     = Math.min(255, Math.floor(targetColor.r * brightness));
        d[i + 1] = Math.min(255, Math.floor(targetColor.g * brightness));
        d[i + 2] = Math.min(255, Math.floor(targetColor.b * brightness));
      }
      // 暗いオレンジ（影の部分）
      else if (r > 100 && r < 180 && g > 40 && g < 120 && b < 60 && r > g) {
        const brightness = (r + g + b) / (140 + 80 + 20);
        d[i]     = Math.min(255, Math.floor(targetColor.r * brightness * 0.6));
        d[i + 1] = Math.min(255, Math.floor(targetColor.g * brightness * 0.6));
        d[i + 2] = Math.min(255, Math.floor(targetColor.b * brightness * 0.6));
      }
    }
    offCtx.putImageData(imageData, 0, 0);
  }

  coloredCarCache[key] = offCanvas;
  return offCanvas;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// ========================================
// ゲーム状態
// ========================================
let gameState = "title";
let gameMode = "single";
let selectedCar = 0;
let selectedCar2 = 0;
let selectedCourse = 0;
let currentGPCourse = 0;
let gpResults = [];

let coursePoints = [];
const COURSE_RESOLUTION = 20;

// ========================================
// 車オブジェクト生成
// ========================================
function createCar(dataIndex, isPlayer, playerId, colorIdx) {
  const d = CAR_DATA[dataIndex];
  return {
    dataIndex,
    isPlayer,
    playerId: playerId || 0,
    colorIndex: colorIdx != null ? colorIdx : 0,
    x: 0, y: 0,
    angle: 0,
    speed: 0,
    hp: MAX_HP,
    lap: 0,
    checkpoint: 0,
    finished: false,
    finishTime: 0,
    specialTimer: 0,
    specialActive: false,
    specialDuration: 0,
    maxSpeed:     1.5 + d.speed * 0.45,
    accelRate:    0.03 + d.accel * 0.018,
    brakeRate:    0.04 + d.brake * 0.015,
    offroadRate:  0.3 + d.offroad * 0.07,
    attackPower:  d.attack,
    durability:   d.durability,
    handleRate:   0.015 + d.handling * 0.005,
    aiTargetWP: 0,
    aiVariance: (Math.random() - 0.5) * 0.3,
  };
}

let cars = [];
let raceTimer = 0;
let countdownTimer = 0;

// ========================================
// キー入力
// ========================================
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.key] = true; e.preventDefault(); });
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

let keyLock = {};
function onKeyOnce(key) {
  if (keys[key] && !keyLock[key]) { keyLock[key] = true; return true; }
  if (!keys[key]) keyLock[key] = false;
  return false;
}

// ========================================
// FC風テキスト描画ユーティリティ
// ========================================
function fcText(text, x, y, color, size, align) {
  ctx.fillStyle = color || FC_WHITE;
  ctx.font = `bold ${size || 16}px monospace`;
  ctx.textAlign = align || "left";
  ctx.fillText(text, x, y);
}

function fcTextWithShadow(text, x, y, color, size, align) {
  ctx.fillStyle = FC_BLACK;
  ctx.font = `bold ${size || 16}px monospace`;
  ctx.textAlign = align || "left";
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color || FC_WHITE;
  ctx.fillText(text, x, y);
}

// FC風のウィンドウ枠
function fcWindow(x, y, w, h, borderColor) {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borderColor || FC_WHITE;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
}

// FC風パラメータバー
function fcParamBar(x, y, w, val, maxVal, color) {
  ctx.fillStyle = FC_DKGRAY;
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = color || FC_GREEN;
  ctx.fillRect(x, y, w * (val / maxVal), 10);
  ctx.strokeStyle = FC_WHITE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, 10);
}

// ========================================
// コース描画
// ========================================
function drawCourse(course) {
  ctx.fillStyle = course.bgColor;
  ctx.fillRect(0, 0, W, H);

  const surfaceColors = {
    road: course.roadColor,
    offroad: "#9a7d50",
    ice: "#c0dae8",
  };

  const pts = coursePoints;
  const rw = course.roadWidth;

  // コース外側ライン（壁）
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    ctx.strokeStyle = course.wallColor || "#c03030";
    ctx.lineWidth = rw + 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // コース路面
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    ctx.strokeStyle = surfaceColors[p1.surface] || course.roadColor;
    ctx.lineWidth = rw;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // 白い点線（中央分離線）
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  for (let i = 0; i <= pts.length; i++) {
    const p = pts[i % pts.length];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // スタート/ゴールライン（チェッカーフラッグ風）
  const sp = pts[0];
  const sp2 = pts[1];
  const lineAngle = Math.atan2(sp2.y - sp.y, sp2.x - sp.x) + Math.PI / 2;
  const hw = rw / 2;
  for (let s = -hw; s < hw; s += 8) {
    const row = Math.floor((s + hw) / 8);
    for (let t = -4; t < 4; t += 8) {
      const col = Math.floor((t + 4) / 8);
      ctx.fillStyle = (row + col) % 2 === 0 ? "#fff" : "#000";
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(lineAngle);
      ctx.fillRect(t, s, 8, 8);
      ctx.restore();
    }
  }

  // 路面装飾
  for (let i = 0; i < pts.length; i += 4) {
    const p = pts[i];
    if (p.surface === "offroad") {
      ctx.fillStyle = "rgba(60,40,15,0.25)";
      for (let j = 0; j < 3; j++) {
        ctx.fillRect(p.x - 3 + Math.sin(i + j * 7) * 20, p.y - 1 + Math.cos(i + j * 5) * 15, 2, 2);
      }
    } else if (p.surface === "ice") {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(p.x + Math.sin(i) * 18, p.y + Math.cos(i) * 14);
      ctx.lineTo(p.x + Math.sin(i) * 18 + 5, p.y + Math.cos(i) * 14 + 2);
      ctx.stroke();
    }
  }
}

// ========================================
// 車描画
// ========================================
function drawCar(c) {
  const coloredImg = getColoredCar(c.dataIndex, c.colorIndex);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle + Math.PI / 2);
  ctx.imageSmoothingEnabled = false;

  if (coloredImg) {
    const w = coloredImg.width * SCALE;
    const h = coloredImg.height * SCALE;
    if (c.specialActive) {
      ctx.shadowColor = FC_YELLOW;
      ctx.shadowBlur = 12;
    }
    if (c.hp <= 0) {
      ctx.globalAlpha = 0.3;
    } else if (c.hp < MAX_HP * 0.3) {
      ctx.globalAlpha = 0.5 + Math.sin(raceTimer * 0.4) * 0.5;
    }
    ctx.drawImage(coloredImg, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = c.isPlayer ? FC_RED : FC_BLUE;
    ctx.fillRect(-6, -9, 12, 18);
  }
  ctx.restore();

  // HPバー
  if (gameState === "race" || gameState === "countdown") {
    const barW = 22;
    const barH = 3;
    const hpR = c.hp / MAX_HP;
    ctx.fillStyle = FC_DKGRAY;
    ctx.fillRect(c.x - barW / 2, c.y - 16, barW, barH);
    ctx.fillStyle = hpR > 0.5 ? FC_GREEN : hpR > 0.25 ? FC_YELLOW : FC_RED;
    ctx.fillRect(c.x - barW / 2, c.y - 16, barW * hpR, barH);
  }
}

// ========================================
// 路面判定
// ========================================
function getSurfaceAt(x, y) {
  let minDist = Infinity;
  let surface = "road";
  for (let i = 0; i < coursePoints.length; i++) {
    const p = coursePoints[i];
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < minDist) { minDist = d; surface = p.surface; }
  }
  const course = COURSES[selectedCourse];
  const onRoad = minDist < (course.roadWidth / 2 + 5) ** 2;
  return { surface: onRoad ? surface : "grass", onRoad };
}

// ========================================
// プレイヤー車更新
// ========================================
function updatePlayerCar(c, upKey, downKey, leftKey, rightKey, specialKey) {
  if (c.finished || c.hp <= 0) return;

  const surf = getSurfaceAt(c.x, c.y);
  let frictionMul = 1, turnMul = 1;
  if (surf.surface === "grass")   { frictionMul = 0.4; turnMul = 0.6; }
  else if (surf.surface === "offroad") { frictionMul = 0.5 + c.offroadRate * 0.5; turnMul = 0.8; }
  else if (surf.surface === "ice")     { frictionMul = 1.05; turnMul = 0.35; }

  if (keys[upKey]) {
    c.speed = Math.min(c.speed + c.accelRate * frictionMul, c.maxSpeed * frictionMul);
  } else if (keys[downKey]) {
    c.speed = Math.max(c.speed - c.brakeRate, -c.maxSpeed * 0.3);
  } else {
    if (c.speed > 0) c.speed = Math.max(c.speed - 0.02, 0);
    if (c.speed < 0) c.speed = Math.min(c.speed + 0.02, 0);
  }

  if (Math.abs(c.speed) > 0.05) {
    const dir = c.speed > 0 ? 1 : -1;
    if (keys[leftKey]) c.angle -= c.handleRate * turnMul * dir;
    if (keys[rightKey]) c.angle += c.handleRate * turnMul * dir;
  }

  if (c.specialTimer > 0) c.specialTimer--;
  if (keys[specialKey] && c.specialTimer <= 0 && !c.specialActive) {
    c.specialActive = true;
    c.specialDuration = 90;
    c.specialTimer = SPECIAL_COOLDOWN;
  }
  if (c.specialActive) {
    c.specialDuration--;
    c.speed = Math.min(c.speed + 0.1, c.maxSpeed * 1.5);
    if (c.specialDuration <= 0) c.specialActive = false;
  }

  c.x += Math.cos(c.angle) * c.speed;
  c.y += Math.sin(c.angle) * c.speed;

  if (c.x < 10) { c.x = 10; c.speed *= -0.3; }
  if (c.x > W - 10) { c.x = W - 10; c.speed *= -0.3; }
  if (c.y < 10) { c.y = 10; c.speed *= -0.3; }
  if (c.y > H - 10) { c.y = H - 10; c.speed *= -0.3; }

  updateCheckpoint(c);
}

// ========================================
// AI車更新
// ========================================
function updateAICar(c) {
  if (c.finished || c.hp <= 0) return;

  const surf = getSurfaceAt(c.x, c.y);
  let frictionMul = 1, turnMul = 1;
  if (surf.surface === "grass") { frictionMul = 0.4; turnMul = 0.6; }
  else if (surf.surface === "offroad") { frictionMul = 0.5 + c.offroadRate * 0.5; turnMul = 0.8; }
  else if (surf.surface === "ice") { frictionMul = 1.05; turnMul = 0.35; }

  const target = coursePoints[c.aiTargetWP];
  const dx = target.x - c.x, dy = target.y - c.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const targetAngle = Math.atan2(dy, dx);
  if (dist < 40) c.aiTargetWP = (c.aiTargetWP + 1) % coursePoints.length;

  let angleDiff = targetAngle - c.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const turnRate = c.handleRate * turnMul * (0.8 + c.aiVariance);
  if (angleDiff > 0.05) c.angle += Math.min(turnRate, angleDiff);
  else if (angleDiff < -0.05) c.angle += Math.max(-turnRate, angleDiff);

  const speedFactor = 1 - Math.min(Math.abs(angleDiff) * 0.5, 0.5);
  const targetSpeed = c.maxSpeed * frictionMul * speedFactor * (0.85 + c.aiVariance * 0.3);
  if (c.speed < targetSpeed) c.speed = Math.min(c.speed + c.accelRate * frictionMul * 0.9, targetSpeed);
  else c.speed = Math.max(c.speed - c.brakeRate * 0.5, targetSpeed * 0.7);

  c.x += Math.cos(c.angle) * c.speed;
  c.y += Math.sin(c.angle) * c.speed;
  c.x = Math.max(10, Math.min(W - 10, c.x));
  c.y = Math.max(10, Math.min(H - 10, c.y));

  updateCheckpoint(c);
}

// ========================================
// チェックポイント・ラップ
// ========================================
function updateCheckpoint(c) {
  const totalCP = coursePoints.length;
  const checkInterval = Math.floor(totalCP / 8);
  const nextCP = (c.checkpoint + 1) % 8;
  const nextCPIndex = nextCP * checkInterval;
  if (nextCPIndex < totalCP) {
    const cp = coursePoints[nextCPIndex];
    const dx = cp.x - c.x, dy = cp.y - c.y;
    if (dx * dx + dy * dy < 60 * 60) {
      c.checkpoint = nextCP;
      if (nextCP === 0) {
        c.lap++;
        if (c.lap >= TOTAL_LAPS) { c.finished = true; c.finishTime = raceTimer; }
      }
    }
  }
}

// ========================================
// 衝突判定
// ========================================
function checkCollisions() {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.hp <= 0 || b.hp <= 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = 16;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist, ny = dy / dist;
        a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
        applyCollisionDamage(a, b, nx, ny);
        applyCollisionDamage(b, a, -nx, -ny);
        a.speed *= 0.6; b.speed *= 0.6;
      }
    }
  }
}

function applyCollisionDamage(victim, attacker, nx, ny) {
  const hitAngle = Math.atan2(ny, nx);
  let relAngle = hitAngle - victim.angle;
  while (relAngle > Math.PI) relAngle -= Math.PI * 2;
  while (relAngle < -Math.PI) relAngle += Math.PI * 2;
  if (Math.abs(relAngle) < Math.PI / 4) return;
  const dmg = Math.max(1, attacker.attackPower - victim.durability * 0.3);
  const specialBonus = attacker.specialActive ? 2.5 : 1;
  victim.hp = Math.max(0, victim.hp - dmg * specialBonus);
}

// ========================================
// レース初期化
// ========================================
function initRace() {
  const course = COURSES[selectedCourse];
  coursePoints = getCoursePoints(course, COURSE_RESOLUTION);
  cars = [];
  // カラーキャッシュクリア
  Object.keys(coloredCarCache).forEach(k => delete coloredCarCache[k]);

  const startPt = coursePoints[0], nextPt = coursePoints[1];
  const startAngle = Math.atan2(nextPt.y - startPt.y, nextPt.x - startPt.x);
  const perpAngle = startAngle + Math.PI / 2;

  const p1 = createCar(selectedCar, true, 0, playerColor1);
  p1.x = startPt.x - Math.cos(startAngle) * 30;
  p1.y = startPt.y - Math.sin(startAngle) * 30;
  p1.angle = startAngle;
  cars.push(p1);

  if (gameMode === "multi") {
    const p2 = createCar(selectedCar2, true, 1, playerColor2);
    p2.x = startPt.x - Math.cos(startAngle) * 30 + Math.cos(perpAngle) * 25;
    p2.y = startPt.y - Math.sin(startAngle) * 30 + Math.sin(perpAngle) * 25;
    p2.angle = startAngle;
    cars.push(p2);
  }

  const usedIndices = [selectedCar];
  if (gameMode === "multi") usedIndices.push(selectedCar2);
  for (let i = 0; i < AI_COUNT; i++) {
    let aiIndex;
    do { aiIndex = Math.floor(Math.random() * CAR_DATA.length); } while (usedIndices.includes(aiIndex));
    usedIndices.push(aiIndex);
    const aiColor = Math.floor(Math.random() * BODY_COLORS.length);
    const ai = createCar(aiIndex, false, -1, aiColor);
    const row = Math.floor((i + (gameMode === "multi" ? 2 : 1)) / 3);
    const col = (i + (gameMode === "multi" ? 2 : 1)) % 3;
    ai.x = startPt.x - Math.cos(startAngle) * (50 + row * 35) + Math.cos(perpAngle) * (col - 1) * 25;
    ai.y = startPt.y - Math.sin(startAngle) * (50 + row * 35) + Math.sin(perpAngle) * (col - 1) * 25;
    ai.angle = startAngle;
    ai.aiTargetWP = 2;
    cars.push(ai);
  }

  raceTimer = 0;
  countdownTimer = 180;
  gameState = "countdown";
}

// ========================================
// レース更新
// ========================================
function updateRace() {
  raceTimer++;
  updatePlayerCar(cars[0], "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "z");
  if (gameMode === "multi" && cars.length > 1 && cars[1].isPlayer) {
    updatePlayerCar(cars[1], "w", "s", "a", "d", "q");
  }
  for (const c of cars) { if (!c.isPlayer) updateAICar(c); }
  checkCollisions();

  const playersFinished = cars.filter(c => c.isPlayer).every(c => c.finished || c.hp <= 0);
  if (playersFinished) {
    if (!cars._resultDelay) cars._resultDelay = 60;
    cars._resultDelay--;
    if (cars._resultDelay <= 0) { cars._resultDelay = undefined; gameState = "result"; }
  }
}

function getRankings() {
  return [...cars].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.hp <= 0 && b.hp > 0) return 1;
    if (a.hp > 0 && b.hp <= 0) return -1;
    if (a.lap !== b.lap) return b.lap - a.lap;
    return b.checkpoint - a.checkpoint;
  });
}

// ========================================
// タイトル画面（FC風）
// ========================================
function drawTitle() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  // 装飾ライン
  ctx.strokeStyle = FC_RED;
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.strokeStyle = FC_YELLOW;
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // タイトルロゴ
  fcTextWithShadow("激 突 四 駆", W / 2, 250, FC_YELLOW, 64, "center");
  fcTextWithShadow("R  E", W / 2, 330, FC_RED, 72, "center");

  // サブタイトル
  fcText("GEKITOTSU YONKU RE", W / 2, 400, FC_CYAN, 18, "center");

  // 点滅テキスト
  if (Math.floor(raceTimer / 30) % 2 === 0) {
    fcText("- PRESS ENTER -", W / 2, 520, FC_WHITE, 22, "center");
  }

  // 下部にマシンスクロール
  const t = raceTimer * 0.5;
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor((t / 60 + i) % CAR_DATA.length);
    const img = getColoredCar(idx, i % BODY_COLORS.length);
    if (img) {
      ctx.imageSmoothingEnabled = false;
      const px = ((t + i * 120) % (W + 100)) - 50;
      ctx.drawImage(img, px, 660, img.width * 2, img.height * 2);
      ctx.imageSmoothingEnabled = true;
    }
  }

  fcText("© GEKITOTSU YONKU RE", W / 2, H - 50, FC_DKGRAY, 12, "center");
  raceTimer++;
}

// ========================================
// モード選択
// ========================================
let modeSelectIdx = 0;
function drawModeSelect() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  fcWindow(200, 80, W - 400, 100, FC_CYAN);
  fcTextWithShadow("モード セレクト", W / 2, 140, FC_CYAN, 32, "center");

  const modes = [
    { label: "グランプリ",     desc: "6コースを勝ち抜け！" },
    { label: "フリーレース",   desc: "好きなコースで1レース" },
    { label: "2Pたいせん",     desc: "ふたりでバトル！" },
  ];

  modes.forEach((m, i) => {
    const y = 260 + i * 110;
    fcWindow(250, y - 30, W - 500, 85, i === modeSelectIdx ? FC_YELLOW : FC_DKGRAY);
    const cursor = i === modeSelectIdx ? "▶ " : "  ";
    fcText(cursor + m.label, 290, y + 10, i === modeSelectIdx ? FC_YELLOW : "#606060", 24);
    fcText(m.desc, 310, y + 38, i === modeSelectIdx ? FC_WHITE : "#404040", 14);
  });

  fcText("↑↓:えらぶ  Enter:けってい  ESC:もどる", W / 2, H - 60, FC_DKGRAY, 14, "center");
}

// ========================================
// マシン選択
// ========================================
let selectingPlayer = 0;
let colorSelectMode = false;

function drawCarSelect() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  const sel = selectingPlayer === 0 ? selectedCar : selectedCar2;
  const colIdx = selectingPlayer === 0 ? playerColor1 : playerColor2;
  const plabel = gameMode === "multi" ? `${selectingPlayer + 1}P` : "";

  // ヘッダー
  fcWindow(100, 20, W - 200, 50, FC_CYAN);
  fcTextWithShadow(`${plabel} マシン セレクト`, W / 2, 55, FC_CYAN, 26, "center");

  // 選択中の車を大きく表示
  const img = getColoredCar(sel, colIdx);
  if (img) {
    ctx.imageSmoothingEnabled = false;
    const dw = img.width * 6;
    const dh = img.height * 6;
    ctx.drawImage(img, W / 2 - dw / 2, 90, dw, dh);
    ctx.imageSmoothingEnabled = true;
  }

  // 車名
  fcTextWithShadow(CAR_DATA[sel].name, W / 2, 250, FC_YELLOW, 20, "center");

  // カラー表示
  const cc = BODY_COLORS[colIdx];
  ctx.fillStyle = cc.color;
  ctx.fillRect(W / 2 - 70, 262, 20, 14);
  fcText(`COLOR: ${cc.name}`, W / 2 - 45, 274, colorSelectMode ? FC_YELLOW : FC_WHITE, 13);
  if (colorSelectMode) {
    fcText("← → でカラー変更  Enter:もどる", W / 2, 296, FC_CYAN, 12, "center");
  } else {
    fcText("C: カラー変更", W / 2 + 80, 274, FC_DKGRAY, 12);
  }

  // パラメータ（FC風）
  fcWindow(280, 310, W - 560, 200, FC_WHITE);
  const params = [
    { label: "スピード",   val: CAR_DATA[sel].speed,      col: FC_RED },
    { label: "かそく",     val: CAR_DATA[sel].accel,      col: FC_ORANGE },
    { label: "ブレーキ",   val: CAR_DATA[sel].brake,      col: FC_BLUE },
    { label: "オフロード", val: CAR_DATA[sel].offroad,    col: FC_GREEN },
    { label: "こうげき",   val: CAR_DATA[sel].attack,     col: FC_RED },
    { label: "たいきゅう", val: CAR_DATA[sel].durability, col: FC_CYAN },
    { label: "ハンドル",   val: CAR_DATA[sel].handling,   col: FC_YELLOW },
  ];

  params.forEach((p, i) => {
    const y = 335 + i * 24;
    fcText(p.label, 310, y, FC_WHITE, 14);
    fcParamBar(440, y - 10, 140, p.val, 10, p.col);
    fcText(`${p.val}`, 590, y, FC_WHITE, 13);
  });

  // サムネイル一覧
  const cols = 13;
  const spacing = 34;
  const startX = W / 2 - (cols * spacing) / 2;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx >= CAR_DATA.length) break;
      const tx = startX + col * spacing + 4;
      const ty = 540 + row * 44;
      if (idx === sel) {
        ctx.strokeStyle = FC_YELLOW;
        ctx.lineWidth = 2;
        ctx.strokeRect(tx - 3, ty - 3, 26, 32);
      }
      const tImg = getColoredCar(idx, idx === sel ? colIdx : 0);
      if (tImg) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tImg, tx, ty, tImg.width * 2, tImg.height * 2);
        ctx.imageSmoothingEnabled = true;
      }
    }
  }

  fcText(`${sel + 1} / ${CAR_DATA.length}`, W / 2, 650, FC_DKGRAY, 14, "center");
  fcText("←→:えらぶ  C:カラー  Enter:けってい  ESC:もどる", W / 2, H - 40, FC_DKGRAY, 13, "center");
}

// ========================================
// コース選択
// ========================================
function drawCourseSelect() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  fcWindow(200, 20, W - 400, 50, FC_CYAN);
  fcTextWithShadow("コース セレクト", W / 2, 55, FC_CYAN, 26, "center");

  // プレビュー
  const course = COURSES[selectedCourse];
  const previewPts = getCoursePoints(course, 10);

  ctx.save();
  ctx.translate(W / 2 - 200, 90);
  ctx.scale(0.45, 0.45);
  ctx.fillStyle = course.bgColor;
  ctx.fillRect(0, 0, W, H);
  const surfColors = { road: course.roadColor, offroad: "#9a7d50", ice: "#c0dae8" };
  for (let i = 0; i < previewPts.length; i++) {
    const p1 = previewPts[i];
    const p2 = previewPts[(i + 1) % previewPts.length];
    ctx.strokeStyle = course.wallColor;
    ctx.lineWidth = course.roadWidth + 6;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.strokeStyle = surfColors[p1.surface] || course.roadColor;
    ctx.lineWidth = course.roadWidth;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  ctx.restore();

  // コース情報
  fcWindow(200, 510, W - 400, 100, FC_YELLOW);
  fcTextWithShadow(course.name, W / 2, 545, FC_YELLOW, 28, "center");
  fcText(course.description, W / 2, 575, FC_WHITE, 15, "center");
  fcText(`${TOTAL_LAPS} しゅう`, W / 2, 595, FC_CYAN, 14, "center");

  // コース一覧（下部）
  COURSES.forEach((c, i) => {
    const x = 110 + i * 165;
    const y = 660;
    if (i === selectedCourse) {
      ctx.fillStyle = FC_YELLOW;
      ctx.fillRect(x - 4, y - 14, 150, 24);
      ctx.fillStyle = FC_BLACK;
    } else {
      ctx.fillStyle = "#505050";
    }
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${i + 1}. ${c.name}`, x, y);
  });

  fcText("←→:えらぶ  Enter:スタート  ESC:もどる", W / 2, H - 40, FC_DKGRAY, 13, "center");
  ctx.textAlign = "start";
}

// ========================================
// カウントダウン
// ========================================
function drawCountdown() {
  drawCourse(COURSES[selectedCourse]);
  cars.forEach(c => drawCar(c));

  const sec = Math.ceil(countdownTimer / 60);
  ctx.textAlign = "center";
  if (sec > 0) {
    fcTextWithShadow(String(sec), W / 2, H / 2 + 20, FC_WHITE, 80, "center");
  } else {
    fcTextWithShadow("GO!!", W / 2, H / 2 + 20, FC_YELLOW, 80, "center");
  }
  ctx.textAlign = "start";
}

// ========================================
// レースUI
// ========================================
function drawRaceUI() {
  drawCourse(COURSES[selectedCourse]);

  const rankings = getRankings();
  for (let i = rankings.length - 1; i >= 0; i--) drawCar(rankings[i]);

  // 1P HUD
  const p1 = cars[0];
  const rank = rankings.indexOf(p1) + 1;
  fcWindow(5, 5, 200, 85, FC_RED);
  fcText("1P", 15, 25, FC_RED, 14);
  fcText(`LAP ${Math.min(p1.lap + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`, 55, 25, FC_WHITE, 14);
  fcText(`${rank}/${cars.length}`, 160, 25, FC_YELLOW, 16);

  fcText("HP", 15, 48, FC_WHITE, 12);
  fcParamBar(40, 38, 120, p1.hp, MAX_HP, p1.hp > 50 ? FC_GREEN : p1.hp > 25 ? FC_YELLOW : FC_RED);

  fcText("SP", 15, 70, FC_WHITE, 12);
  const spReady = p1.specialTimer <= 0;
  fcParamBar(40, 60, 120, spReady ? SPECIAL_COOLDOWN : SPECIAL_COOLDOWN - p1.specialTimer, SPECIAL_COOLDOWN, spReady ? FC_CYAN : FC_BLUE);
  if (spReady) fcText("[Z]", 168, 70, FC_CYAN, 11);

  fcText(`TIME: ${(raceTimer / 60).toFixed(1)}`, 15, 83, FC_WHITE, 11);

  // 2P HUD
  if (gameMode === "multi" && cars.length > 1 && cars[1].isPlayer) {
    const p2 = cars[1];
    const rank2 = rankings.indexOf(p2) + 1;
    const hx = W - 205;
    fcWindow(hx, 5, 200, 85, FC_BLUE);
    fcText("2P", hx + 10, 25, FC_BLUE, 14);
    fcText(`LAP ${Math.min(p2.lap + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`, hx + 50, 25, FC_WHITE, 14);
    fcText(`${rank2}/${cars.length}`, hx + 155, 25, FC_YELLOW, 16);
    fcText("HP", hx + 10, 48, FC_WHITE, 12);
    fcParamBar(hx + 35, 38, 120, p2.hp, MAX_HP, p2.hp > 50 ? FC_GREEN : p2.hp > 25 ? FC_YELLOW : FC_RED);
    fcText("SP", hx + 10, 70, FC_WHITE, 12);
    const sp2Ready = p2.specialTimer <= 0;
    fcParamBar(hx + 35, 60, 120, sp2Ready ? SPECIAL_COOLDOWN : SPECIAL_COOLDOWN - p2.specialTimer, SPECIAL_COOLDOWN, sp2Ready ? FC_CYAN : FC_BLUE);
    if (sp2Ready) fcText("[Q]", hx + 163, 70, FC_CYAN, 11);
  }

  // ミニマップ
  drawMinimap();

  // ラップ表示（ラップ変化時にフラッシュ）
  if (p1.lap > 0 && raceTimer % 120 < 60 && p1.lap < TOTAL_LAPS) {
    // nothing extra
  }
}

function drawMinimap() {
  const mx = W - 155, my = H - 130, mw = 145, mh = 120;
  fcWindow(mx, my, mw, mh, FC_WHITE);
  const scaleX = (mw - 10) / W, scaleY = (mh - 10) / H;

  ctx.strokeStyle = "#404040";
  ctx.lineWidth = 2;
  ctx.beginPath();
  coursePoints.forEach((p, i) => {
    const px = mx + 5 + p.x * scaleX, py = my + 5 + p.y * scaleY;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.stroke();

  cars.forEach(c => {
    ctx.fillStyle = c.isPlayer ? (c.playerId === 0 ? FC_RED : FC_BLUE) : FC_YELLOW;
    const px = mx + 5 + c.x * scaleX, py = my + 5 + c.y * scaleY;
    ctx.fillRect(px - 2, py - 2, 4, 4);
  });
}

// ========================================
// リザルト
// ========================================
function drawResult() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  fcWindow(100, 30, W - 200, 60, FC_YELLOW);
  fcTextWithShadow("R E S U L T", W / 2, 70, FC_YELLOW, 36, "center");

  const rankings = getRankings();
  fcWindow(100, 110, W - 200, rankings.length * 55 + 20, FC_WHITE);

  rankings.forEach((c, i) => {
    const y = 145 + i * 55;

    // 順位色
    const col = i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "#606060";

    // プレイヤーマーク
    if (c.isPlayer) {
      fcText(c.playerId === 0 ? "1P" : "2P", 130, y, c.playerId === 0 ? FC_RED : FC_BLUE, 16);
    }

    fcText(`${i + 1}`, 180, y, col, 22);

    // 車画像
    const img = getColoredCar(c.dataIndex, c.colorIndex);
    if (img) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 210, y - 16, img.width * 2.5, img.height * 2.5);
      ctx.imageSmoothingEnabled = true;
    }

    fcText(CAR_DATA[c.dataIndex].name, 270, y, col, 16);

    ctx.textAlign = "right";
    if (c.finished) {
      fcText(`${(c.finishTime / 60).toFixed(1)}s`, W - 150, y, col, 16, "right");
    } else if (c.hp <= 0) {
      fcText("DESTROYED", W - 150, y, FC_RED, 16, "right");
    } else {
      fcText(`LAP ${c.lap}`, W - 150, y, "#505050", 16, "right");
    }
    ctx.textAlign = "start";
  });

  const courseName = COURSES[selectedCourse].name;
  fcText(courseName, W / 2, H - 90, FC_CYAN, 16, "center");
  fcText("Enter:つぎへ  ESC:タイトルへ", W / 2, H - 50, FC_DKGRAY, 14, "center");
}

// ========================================
// グランプリ総合結果
// ========================================
function drawGrandPrixResult() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  fcWindow(150, 30, W - 300, 60, FC_YELLOW);
  fcTextWithShadow("グランプリ そうごう けっか", W / 2, 70, FC_YELLOW, 28, "center");

  const pointTable = [10, 7, 5, 4, 3, 2, 1];
  const totals = {};
  gpResults.forEach((raceRanking) => {
    raceRanking.forEach((c, rank) => {
      const key = c.dataIndex;
      if (!totals[key]) totals[key] = { dataIndex: c.dataIndex, points: 0, isPlayer: c.isPlayer, playerId: c.playerId, colorIndex: c.colorIndex };
      totals[key].points += pointTable[rank] || 1;
    });
  });
  const sorted = Object.values(totals).sort((a, b) => b.points - a.points);

  fcWindow(150, 110, W - 300, Math.min(sorted.length, 8) * 55 + 20, FC_WHITE);

  sorted.slice(0, 8).forEach((entry, i) => {
    const y = 148 + i * 55;
    const col = i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "#606060";

    if (entry.isPlayer) {
      fcText("1P", 180, y, FC_RED, 16);
    }

    fcText(`${i + 1}`, 220, y, col, 22);

    const img = getColoredCar(entry.dataIndex, entry.colorIndex || 0);
    if (img) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 260, y - 16, img.width * 2.5, img.height * 2.5);
      ctx.imageSmoothingEnabled = true;
    }

    fcText(CAR_DATA[entry.dataIndex].name, 320, y, col, 16);
    fcText(`${entry.points}pts`, W - 200, y, col, 18, "right");
    ctx.textAlign = "start";
  });

  // チャンピオン演出
  if (sorted.length > 0 && sorted[0].isPlayer) {
    if (Math.floor(raceTimer / 15) % 2 === 0) {
      fcTextWithShadow("★ CHAMPION! ★", W / 2, H - 100, FC_YELLOW, 32, "center");
    }
  }

  fcText("Enter:タイトルへ", W / 2, H - 40, FC_DKGRAY, 14, "center");
  raceTimer++;
}

// ========================================
// 入力処理
// ========================================
function handleInput() {
  switch (gameState) {
    case "title":
      if (onKeyOnce("Enter")) { gameState = "modeSelect"; modeSelectIdx = 0; raceTimer = 0; }
      break;

    case "modeSelect":
      if (onKeyOnce("ArrowUp")) modeSelectIdx = (modeSelectIdx - 1 + 3) % 3;
      if (onKeyOnce("ArrowDown")) modeSelectIdx = (modeSelectIdx + 1) % 3;
      if (onKeyOnce("Enter")) {
        if (modeSelectIdx === 0) { gameMode = "single"; gpResults = []; currentGPCourse = 0; }
        else if (modeSelectIdx === 1) { gameMode = "single"; }
        else { gameMode = "multi"; }
        selectingPlayer = 0;
        colorSelectMode = false;
        gameState = "carSelect";
      }
      if (onKeyOnce("Escape")) gameState = "title";
      break;

    case "carSelect": {
      const isSel2P = selectingPlayer === 1;

      // カラー選択モード
      if (colorSelectMode) {
        if (onKeyOnce("ArrowRight")) {
          if (isSel2P) playerColor2 = (playerColor2 + 1) % BODY_COLORS.length;
          else playerColor1 = (playerColor1 + 1) % BODY_COLORS.length;
        }
        if (onKeyOnce("ArrowLeft")) {
          if (isSel2P) playerColor2 = (playerColor2 - 1 + BODY_COLORS.length) % BODY_COLORS.length;
          else playerColor1 = (playerColor1 - 1 + BODY_COLORS.length) % BODY_COLORS.length;
        }
        if (onKeyOnce("Enter") || onKeyOnce("c") || onKeyOnce("C")) {
          colorSelectMode = false;
        }
        break;
      }

      if (onKeyOnce("c") || onKeyOnce("C")) {
        colorSelectMode = true;
        break;
      }

      if (onKeyOnce("ArrowRight")) {
        if (isSel2P) selectedCar2 = (selectedCar2 + 1) % CAR_DATA.length;
        else selectedCar = (selectedCar + 1) % CAR_DATA.length;
      }
      if (onKeyOnce("ArrowLeft")) {
        if (isSel2P) selectedCar2 = (selectedCar2 - 1 + CAR_DATA.length) % CAR_DATA.length;
        else selectedCar = (selectedCar - 1 + CAR_DATA.length) % CAR_DATA.length;
      }
      if (onKeyOnce("Enter")) {
        if (gameMode === "multi" && selectingPlayer === 0) {
          selectingPlayer = 1;
        } else {
          if (modeSelectIdx === 0) {
            selectedCourse = currentGPCourse;
            initRace();
          } else {
            gameState = "courseSelect";
          }
        }
      }
      if (onKeyOnce("Escape")) {
        if (selectingPlayer === 1) selectingPlayer = 0;
        else gameState = "modeSelect";
      }
      break;
    }

    case "courseSelect":
      if (onKeyOnce("ArrowRight")) selectedCourse = (selectedCourse + 1) % COURSES.length;
      if (onKeyOnce("ArrowLeft")) selectedCourse = (selectedCourse - 1 + COURSES.length) % COURSES.length;
      if (onKeyOnce("Enter")) initRace();
      if (onKeyOnce("Escape")) gameState = "carSelect";
      break;

    case "countdown":
      countdownTimer--;
      if (countdownTimer <= 0) gameState = "race";
      break;

    case "race":
      if (onKeyOnce("Escape")) gameState = "result";
      break;

    case "result":
      if (onKeyOnce("Enter")) {
        if (modeSelectIdx === 0) {
          gpResults.push(getRankings());
          currentGPCourse++;
          if (currentGPCourse >= COURSES.length) {
            raceTimer = 0;
            gameState = "grandprixResult";
          } else {
            selectedCourse = currentGPCourse;
            initRace();
          }
        } else {
          gameState = "title";
        }
      }
      if (onKeyOnce("Escape")) gameState = "title";
      break;

    case "grandprixResult":
      if (onKeyOnce("Enter") || onKeyOnce("Escape")) gameState = "title";
      break;
  }
}

// ========================================
// メインループ
// ========================================
function gameLoop() {
  handleInput();
  switch (gameState) {
    case "title":           drawTitle(); break;
    case "modeSelect":      drawModeSelect(); break;
    case "carSelect":       drawCarSelect(); break;
    case "courseSelect":    drawCourseSelect(); break;
    case "countdown":       drawCountdown(); break;
    case "race":            updateRace(); drawRaceUI(); break;
    case "result":          drawResult(); break;
    case "grandprixResult": drawGrandPrixResult(); break;
  }
  requestAnimationFrame(gameLoop);
}

gameLoop();
