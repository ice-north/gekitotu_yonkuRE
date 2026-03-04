// 激突四駆RE - メインゲームロジック
// ファミコン「激突四駆バトル」オマージュ

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;   // 1200
const H = canvas.height;  // 900

// ========================================
// 定数
// ========================================
const SCALE = 1.0;         // ドット絵拡大率（等倍）
const TOTAL_LAPS = 5;
const MAX_HP = 100;
const SPECIAL_COOLDOWN = 300;
const AI_COUNT = 5;
const INVINCIBLE_TIME = 120; // スタート後の無敵時間（2秒）
const COLLISION_COOLDOWN = 20; // 衝突ダメージのクールダウン（フレーム）

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

// ボディカラー選択肢（CSS filter hue-rotate方式でCORS回避）
const BODY_COLORS = [
  // 虹色順（相関色）: 赤→橙→黄→緑→薄緑→シアン→青→紫→薄紫→ピンク
  // colorはフィルター適用後の実際の見た目に近い色を設定
  { name: "レッド",       filter: "hue-rotate(-30deg) saturate(1.5)",                 color: "#d83030" },
  { name: "オレンジ",     filter: "",                                                 color: "#f87818" },
  { name: "イエロー",     filter: "hue-rotate(30deg) saturate(1.2)",                  color: "#e8b800" },
  { name: "グリーン",     filter: "hue-rotate(90deg)",                                color: "#30c048" },
  { name: "ライトグリーン", filter: "hue-rotate(120deg) saturate(0.9) brightness(1.2)", color: "#40d898" },
  { name: "シアン",       filter: "hue-rotate(150deg)",                               color: "#20b8c8" },
  { name: "ブルー",       filter: "hue-rotate(200deg) saturate(1.2)",                 color: "#3070e8" },
  { name: "パープル",     filter: "hue-rotate(260deg) saturate(1.1)",                 color: "#9040d8" },
  { name: "うすむらさき", filter: "hue-rotate(240deg) saturate(0.6) brightness(1.3)", color: "#a890f8" },
  { name: "ピンク",       filter: "hue-rotate(300deg) saturate(1.1)",                 color: "#e860a0" },
];

let playerColor1 = 0;
let playerColor2 = 3;

// ========================================
// 画像読み込み & カラー変換
// ========================================
const carImagesOriginal = [];
let imagesLoaded = 0;
const coloredCarCache = {};

CAR_DATA.forEach((data) => {
  const img = new Image();
  img.src = data.img;
  img.onload = () => { imagesLoaded++; };
  carImagesOriginal.push(img);
});

function getColoredCar(carIndex, colorIndex) {
  const key = `${carIndex}_${colorIndex}`;
  if (coloredCarCache[key]) return coloredCarCache[key];
  const img = carImagesOriginal[carIndex];
  if (!img || !img.complete || img.naturalWidth === 0) return null;
  const offCanvas = document.createElement("canvas");
  offCanvas.width = img.naturalWidth;
  offCanvas.height = img.naturalHeight;
  const offCtx = offCanvas.getContext("2d");
  const filterStr = BODY_COLORS[colorIndex].filter;
  if (filterStr) offCtx.filter = filterStr;
  offCtx.drawImage(img, 0, 0);
  offCtx.filter = "none";
  coloredCarCache[key] = offCanvas;
  return offCanvas;
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

// コース描画キャッシュ（毎フレーム描画を避ける）
let courseCache = null;

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
    vx: 0, vy: 0,       // 速度ベクトル（慣性用）
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
    invincible: INVINCIBLE_TIME,  // 無敵時間
    damageCooldown: 0,            // ダメージクールダウン
    knockbackX: 0, knockbackY: 0, // 弾かれベクトル
    spinVelocity: 0,              // スピン速度（くるくる回転用）
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
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","z","q","w","a","s","d","c"].includes(e.key)) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

let keyLock = {};
function onKeyOnce(key) {
  if (keys[key] && !keyLock[key]) { keyLock[key] = true; return true; }
  if (!keys[key]) keyLock[key] = false;
  return false;
}

// ========================================
// ゲームパッド入力
// ========================================
let gamepads = {};
let gpButtonLock = {};
let gpConfig = {
  // デフォルトボタン設定（一般的なコントローラー）
  up: { type: "axis", index: 1, dir: -1 },      // 左スティック上
  down: { type: "axis", index: 1, dir: 1 },     // 左スティック下
  left: { type: "axis", index: 0, dir: -1 },    // 左スティック左
  right: { type: "axis", index: 0, dir: 1 },    // 左スティック右
  accel: { type: "button", index: 0 },          // A/Cross
  brake: { type: "button", index: 1 },          // B/Circle
  special: { type: "button", index: 2 },        // X/Square
  start: { type: "button", index: 9 },          // Start
  select: { type: "button", index: 8 },         // Select/Back
};
let gpConfiguring = null; // 設定中のアクション名
let gpConnected = false;

window.addEventListener("gamepadconnected", (e) => {
  gamepads[e.gamepad.index] = e.gamepad;
  gpConnected = true;
});
window.addEventListener("gamepaddisconnected", (e) => {
  delete gamepads[e.gamepad.index];
  gpConnected = Object.keys(gamepads).length > 0;
});

function updateGamepads() {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < gps.length; i++) {
    if (gps[i]) gamepads[gps[i].index] = gps[i];
  }
}

function gpButton(action) {
  updateGamepads();
  const cfg = gpConfig[action];
  if (!cfg) return false;
  for (const idx in gamepads) {
    const gp = gamepads[idx];
    if (!gp) continue;
    if (cfg.type === "button") {
      if (gp.buttons[cfg.index] && gp.buttons[cfg.index].pressed) return true;
    } else if (cfg.type === "axis") {
      const val = gp.axes[cfg.index];
      if (cfg.dir < 0 && val < -0.5) return true;
      if (cfg.dir > 0 && val > 0.5) return true;
    }
  }
  return false;
}

function gpButtonOnce(action) {
  const pressed = gpButton(action);
  if (pressed && !gpButtonLock[action]) { gpButtonLock[action] = true; return true; }
  if (!pressed) gpButtonLock[action] = false;
  return false;
}

// 任意のボタン押下を検出（設定用）
function gpAnyPressed() {
  updateGamepads();
  for (const idx in gamepads) {
    const gp = gamepads[idx];
    if (!gp) continue;
    for (let i = 0; i < gp.buttons.length; i++) {
      if (gp.buttons[i].pressed) return { type: "button", index: i };
    }
    for (let i = 0; i < gp.axes.length; i++) {
      if (gp.axes[i] < -0.7) return { type: "axis", index: i, dir: -1 };
      if (gp.axes[i] > 0.7) return { type: "axis", index: i, dir: 1 };
    }
  }
  return null;
}

// ========================================
// FC風テキスト描画ユーティリティ
// ========================================
// ドットフォント: 英語=Press Start 2P, 日本語=DotGothic16
const FC_FONT_EN = "'Press Start 2P', monospace";
const FC_FONT_JP = "'DotGothic16', sans-serif";

function getFcFont(text, size) {
  // 日本語が含まれているかチェック
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  const fontFamily = hasJapanese ? FC_FONT_JP : FC_FONT_EN;
  // Press Start 2Pは小さめなのでサイズ調整
  const adjustedSize = hasJapanese ? size : Math.floor(size * 0.7);
  return `${adjustedSize}px ${fontFamily}`;
}

function fcText(text, x, y, color, size, align) {
  ctx.fillStyle = color || FC_WHITE;
  ctx.font = getFcFont(text, size || 16);
  ctx.textAlign = align || "left";
  ctx.fillText(text, x, y);
}

function fcTextWithShadow(text, x, y, color, size, align) {
  const font = getFcFont(text, size || 16);
  ctx.font = font;
  ctx.textAlign = align || "left";
  ctx.fillStyle = FC_BLACK;
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color || FC_WHITE;
  ctx.fillText(text, x, y);
}

function fcWindow(x, y, w, h, borderColor) {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borderColor || FC_WHITE;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
}

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
// FC風ドット絵コース描画
// ========================================
function buildCourseCache(course) {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = W;
  offCanvas.height = H;
  const oc = offCanvas.getContext("2d");

  // 背景を8x8タイルパターンで塗る（FC風）
  const bgBase = course.bgColor;
  oc.fillStyle = bgBase;
  oc.fillRect(0, 0, W, H);

  // 背景に草・土のドットパターン
  const bgR = parseInt(bgBase.slice(1, 3), 16);
  const bgG = parseInt(bgBase.slice(3, 5), 16);
  const bgB = parseInt(bgBase.slice(5, 7), 16);
  for (let ty = 0; ty < H; ty += 8) {
    for (let tx = 0; tx < W; tx += 8) {
      const hash = ((tx * 73 + ty * 137) >>> 0) % 16;
      if (hash < 3) {
        const dr = hash === 0 ? 12 : -8;
        oc.fillStyle = `rgb(${Math.max(0, Math.min(255, bgR + dr))},${Math.max(0, Math.min(255, bgG + dr))},${Math.max(0, Math.min(255, bgB + dr))})`;
        oc.fillRect(tx, ty, 4, 4);
      }
    }
  }

  const pts = coursePoints;
  const rw = course.roadWidth;
  const surfaceColors = { road: course.roadColor, offroad: "#9a7d50", ice: "#c0dae8" };

  // コース壁（赤/茶の外側ライン）
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    oc.strokeStyle = course.wallColor || "#c03030";
    oc.lineWidth = rw + 12;
    oc.lineCap = "round";
    oc.beginPath(); oc.moveTo(p1.x, p1.y); oc.lineTo(p2.x, p2.y); oc.stroke();
  }

  // コース壁の内側に黒い線（溝）
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    oc.strokeStyle = "#181818";
    oc.lineWidth = rw + 4;
    oc.lineCap = "round";
    oc.beginPath(); oc.moveTo(p1.x, p1.y); oc.lineTo(p2.x, p2.y); oc.stroke();
  }

  // コース路面
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    oc.strokeStyle = surfaceColors[p1.surface] || course.roadColor;
    oc.lineWidth = rw;
    oc.lineCap = "round";
    oc.beginPath(); oc.moveTo(p1.x, p1.y); oc.lineTo(p2.x, p2.y); oc.stroke();
  }

  // 路面にFCドットパターンを重ねる
  for (let i = 0; i < pts.length; i += 2) {
    const p = pts[i];
    const hw = rw / 2 - 4;
    const ang = (i < pts.length - 1) ? Math.atan2(pts[i + 1].y - p.y, pts[i + 1].x - p.x) : 0;
    const perpX = -Math.sin(ang), perpY = Math.cos(ang);

    if (p.surface === "road") {
      // 路面の細かいアスファルト模様
      const hash = ((Math.floor(p.x) * 31 + Math.floor(p.y) * 17) >>> 0) % 8;
      if (hash < 2) {
        oc.fillStyle = "rgba(0,0,0,0.08)";
        oc.fillRect(Math.floor(p.x / 4) * 4, Math.floor(p.y / 4) * 4, 4, 4);
      }
    } else if (p.surface === "offroad") {
      // ダート模様（散らばる小石）
      for (let j = 0; j < 2; j++) {
        const ox = Math.sin(i * 7 + j * 13) * hw * 0.6;
        const oy = Math.cos(i * 11 + j * 7) * hw * 0.4;
        oc.fillStyle = "rgba(60,40,15,0.3)";
        oc.fillRect(Math.floor((p.x + perpX * ox) / 4) * 4, Math.floor((p.y + perpY * oy) / 4) * 4, 4, 4);
      }
    } else if (p.surface === "ice") {
      // 氷の光沢ドット
      const hash = ((Math.floor(p.x) * 53 + Math.floor(p.y) * 29) >>> 0) % 12;
      if (hash < 2) {
        oc.fillStyle = "rgba(255,255,255,0.25)";
        oc.fillRect(Math.floor(p.x / 4) * 4, Math.floor(p.y / 4) * 4, 4, 4);
      }
    }
  }

  // 白い点線（中央ライン）→ FC風に4pxドット列
  oc.fillStyle = "rgba(255,255,255,0.25)";
  for (let i = 0; i < pts.length; i += 3) {
    const seg = Math.floor(i / 3);
    if (seg % 2 === 0) {
      const p = pts[i];
      oc.fillRect(Math.floor(p.x / 4) * 4 - 2, Math.floor(p.y / 4) * 4 - 2, 4, 4);
    }
  }

  // スタート/ゴールライン（チェッカーフラッグ）
  const sp = pts[0], sp2 = pts[1];
  const lineAngle = Math.atan2(sp2.y - sp.y, sp2.x - sp.x) + Math.PI / 2;
  const half = rw / 2;
  for (let s = -half; s < half; s += 8) {
    const row = Math.floor((s + half) / 8);
    for (let t = -6; t < 6; t += 8) {
      const col = Math.floor((t + 6) / 8);
      oc.fillStyle = (row + col) % 2 === 0 ? "#fcfcfc" : "#0f0f0f";
      oc.save();
      oc.translate(sp.x, sp.y);
      oc.rotate(lineAngle);
      oc.fillRect(t, s, 8, 8);
      oc.restore();
    }
  }

  courseCache = offCanvas;
}

function drawCourse() {
  if (courseCache) {
    ctx.drawImage(courseCache, 0, 0);
  }
}

// ========================================
// 車描画（2コマスプライトシート対応）
// ========================================
function getCarFrame(c) {
  // 速度が低い場合はフレーム0固定
  const spd = Math.abs(c.speed);
  if (spd < 0.1) return 0;
  // 速度が速いほどアニメーション間隔が短い（2〜12フレーム）
  const animInterval = Math.max(2, Math.floor(12 - spd * 2));
  return Math.floor(raceTimer / animInterval) % 2;
}

function drawCar(c) {
  if (c.hp <= 0 && c.invincible <= -60) return; // 破壊後しばらくで消える
  const coloredImg = getColoredCar(c.dataIndex, c.colorIndex);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle + Math.PI / 2);
  ctx.imageSmoothingEnabled = false;

  if (coloredImg) {
    // スプライトシート: 横2コマ
    const frameW = coloredImg.width / 2;
    const frameH = coloredImg.height;
    const frame = getCarFrame(c);
    const sx = frame * frameW;
    const dw = frameW * SCALE;
    const dh = frameH * SCALE;

    if (c.specialActive) {
      ctx.shadowColor = FC_YELLOW;
      ctx.shadowBlur = 10;
    }
    // 無敵中は点滅
    if (c.invincible > 0) {
      ctx.globalAlpha = Math.floor(c.invincible / 4) % 2 === 0 ? 1.0 : 0.3;
    } else if (c.hp <= 0) {
      ctx.globalAlpha = 0.25;
    } else if (c.hp < MAX_HP * 0.3) {
      ctx.globalAlpha = 0.5 + Math.sin(raceTimer * 0.4) * 0.5;
    }
    ctx.drawImage(coloredImg, sx, 0, frameW, frameH, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.fillStyle = c.isPlayer ? FC_RED : FC_BLUE;
    ctx.fillRect(-5, -7, 10, 14);
  }
  ctx.restore();

  // HPバー
  if (gameState === "race" || gameState === "countdown") {
    if (c.hp > 0) {
      const barW = 18;
      const barH = 2;
      const hpR = c.hp / MAX_HP;
      ctx.fillStyle = FC_DKGRAY;
      ctx.fillRect(c.x - barW / 2, c.y - 12, barW, barH);
      ctx.fillStyle = hpR > 0.5 ? FC_GREEN : hpR > 0.25 ? FC_YELLOW : FC_RED;
      ctx.fillRect(c.x - barW / 2, c.y - 12, barW * hpR, barH);
    }
  }
}

// ========================================
// 路面判定
// ========================================
function getSurfaceAt(x, y) {
  let minDist = Infinity;
  let surface = "road";
  for (let i = 0; i < coursePoints.length; i += 2) {
    const p = coursePoints[i];
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < minDist) { minDist = d; surface = p.surface; }
  }
  const course = COURSES[selectedCourse];
  const onRoad = minDist < (course.roadWidth / 2 + 5) ** 2;
  return { surface: onRoad ? surface : "grass", onRoad };
}

// ========================================
// 慣性付き車移動の共通処理
// ========================================
function applyCarPhysics(c) {
  // スピン適用（くるくる回転）
  if (Math.abs(c.spinVelocity) > 0.001) {
    c.angle += c.spinVelocity;
    c.spinVelocity *= 0.92; // スピン減衰
    if (Math.abs(c.spinVelocity) < 0.005) c.spinVelocity = 0;
  }

  // 慣性: vx/vyをangleとspeedから更新（徐々に追従）
  const targetVx = Math.cos(c.angle) * c.speed;
  const targetVy = Math.sin(c.angle) * c.speed;
  const surf = getSurfaceAt(c.x, c.y);

  // 慣性の強さ（氷は慣性大、通常は小）
  let inertia = 0.15; // 通常路面
  if (surf.surface === "ice") inertia = 0.05;    // 氷はなかなか曲がらない
  else if (surf.surface === "offroad") inertia = 0.10;
  else if (surf.surface === "grass") inertia = 0.08;

  c.vx += (targetVx - c.vx) * inertia;
  c.vy += (targetVy - c.vy) * inertia;

  // ノックバック適用
  c.vx += c.knockbackX;
  c.vy += c.knockbackY;
  c.knockbackX *= 0.85;
  c.knockbackY *= 0.85;
  if (Math.abs(c.knockbackX) < 0.01) c.knockbackX = 0;
  if (Math.abs(c.knockbackY) < 0.01) c.knockbackY = 0;

  c.x += c.vx;
  c.y += c.vy;

  // 画面端バウンド
  if (c.x < 10) { c.x = 10; c.vx = Math.abs(c.vx) * 0.5; c.knockbackX = 1; c.spinVelocity += 0.1; }
  if (c.x > W - 10) { c.x = W - 10; c.vx = -Math.abs(c.vx) * 0.5; c.knockbackX = -1; c.spinVelocity -= 0.1; }
  if (c.y < 10) { c.y = 10; c.vy = Math.abs(c.vy) * 0.5; c.knockbackY = 1; c.spinVelocity += 0.1; }
  if (c.y > H - 10) { c.y = H - 10; c.vy = -Math.abs(c.vy) * 0.5; c.knockbackY = -1; c.spinVelocity -= 0.1; }

  // タイマー更新
  if (c.invincible > 0) c.invincible--;
  if (c.damageCooldown > 0) c.damageCooldown--;
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
  else if (surf.surface === "ice")     { frictionMul = 1.05; turnMul = 0.4; }

  // 1Pはゲームパッド入力も受け付ける
  const useGamepad = c.playerId === 0;
  const accelInput = keys[upKey] || (useGamepad && gpButton("accel"));
  const brakeInput = keys[downKey] || (useGamepad && gpButton("brake"));
  const leftInput = keys[leftKey] || (useGamepad && gpButton("left"));
  const rightInput = keys[rightKey] || (useGamepad && gpButton("right"));
  const specialInput = keys[specialKey] || (useGamepad && gpButton("special"));

  if (accelInput) {
    c.speed = Math.min(c.speed + c.accelRate * frictionMul, c.maxSpeed * frictionMul);
  } else if (brakeInput) {
    c.speed = Math.max(c.speed - c.brakeRate, -c.maxSpeed * 0.3);
  } else {
    if (c.speed > 0) c.speed = Math.max(c.speed - 0.02, 0);
    if (c.speed < 0) c.speed = Math.min(c.speed + 0.02, 0);
  }

  if (Math.abs(c.speed) > 0.05) {
    const dir = c.speed > 0 ? 1 : -1;
    if (leftInput) c.angle -= c.handleRate * turnMul * dir;
    if (rightInput) c.angle += c.handleRate * turnMul * dir;
  }

  // スペシャル
  if (c.specialTimer > 0) c.specialTimer--;
  if (specialInput && c.specialTimer <= 0 && !c.specialActive) {
    c.specialActive = true;
    c.specialDuration = 90;
    c.specialTimer = SPECIAL_COOLDOWN;
  }
  if (c.specialActive) {
    c.specialDuration--;
    c.speed = Math.min(c.speed + 0.1, c.maxSpeed * 1.5);
    if (c.specialDuration <= 0) c.specialActive = false;
  }

  applyCarPhysics(c);
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
  else if (surf.surface === "ice") { frictionMul = 1.05; turnMul = 0.4; }

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

  applyCarPhysics(c);
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
// 衝突判定（FC激突四駆バトル風）
// ========================================
function checkCollisions() {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.hp <= 0 || b.hp <= 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = 30;
      if (dist < minDist && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        const overlap = minDist - dist;

        // 押し出し
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        // 衝突角度を計算（各車から見た相手の方向）
        const collisionAngle = Math.atan2(dy, dx);

        // aから見たbの相対角度
        let relAngleA = collisionAngle - a.angle;
        while (relAngleA > Math.PI) relAngleA -= Math.PI * 2;
        while (relAngleA < -Math.PI) relAngleA += Math.PI * 2;

        // bから見たaの相対角度
        let relAngleB = (collisionAngle + Math.PI) - b.angle;
        while (relAngleB > Math.PI) relAngleB -= Math.PI * 2;
        while (relAngleB < -Math.PI) relAngleB += Math.PI * 2;

        // 衝突タイプ判定
        const aHitFront = Math.abs(relAngleA) < Math.PI / 4;        // aの前方でぶつかった
        const aHitSide = Math.abs(relAngleA) >= Math.PI / 4 && Math.abs(relAngleA) < Math.PI * 3 / 4;
        const aHitRear = Math.abs(relAngleA) >= Math.PI * 3 / 4;    // aの後方でぶつかった

        const bHitFront = Math.abs(relAngleB) < Math.PI / 4;
        const bHitSide = Math.abs(relAngleB) >= Math.PI / 4 && Math.abs(relAngleB) < Math.PI * 3 / 4;
        const bHitRear = Math.abs(relAngleB) >= Math.PI * 3 / 4;

        // 速度差で攻撃側/被害側を判定
        const aIsAttacker = aHitFront && (bHitSide || bHitRear);
        const bIsAttacker = bHitFront && (aHitSide || aHitRear);
        const isSideCollision = aHitSide && bHitSide;

        const totalSpeed = Math.abs(a.speed) + Math.abs(b.speed) + 0.5;

        if (isSideCollision) {
          // 横衝突: 両者ハンドルが反作用
          const steerForce = totalSpeed * 0.04;
          if (relAngleA > 0) {
            a.spinVelocity -= steerForce;
            b.spinVelocity += steerForce;
          } else {
            a.spinVelocity += steerForce;
            b.spinVelocity -= steerForce;
          }
          // 軽いノックバック（半分に調整）
          const knockForce = totalSpeed * 0.15;
          a.knockbackX -= nx * knockForce;
          a.knockbackY -= ny * knockForce;
          b.knockbackX += nx * knockForce;
          b.knockbackY += ny * knockForce;
          // 両者少し減速
          a.speed *= 0.8;
          b.speed *= 0.8;
        } else if (aIsAttacker) {
          // aが攻撃側: aは50%減速、bはスピン+吹き飛び（半分に調整）
          a.speed *= 0.5;
          const knockForce = totalSpeed * 0.4;
          b.knockbackX += nx * knockForce;
          b.knockbackY += ny * knockForce;
          // bをくるくる回転
          const spinDir = relAngleB > 0 ? 1 : -1;
          b.spinVelocity += spinDir * (0.15 + Math.abs(a.speed) * 0.05);
          b.speed *= 0.3;
        } else if (bIsAttacker) {
          // bが攻撃側: bは50%減速、aはスピン+吹き飛び（半分に調整）
          b.speed *= 0.5;
          const knockForce = totalSpeed * 0.4;
          a.knockbackX -= nx * knockForce;
          a.knockbackY -= ny * knockForce;
          // aをくるくる回転
          const spinDir = relAngleA > 0 ? 1 : -1;
          a.spinVelocity += spinDir * (0.15 + Math.abs(b.speed) * 0.05);
          a.speed *= 0.3;
        } else {
          // 正面衝突など: 両者弾かれる（半分に調整）
          const knockForce = totalSpeed * 0.25;
          a.knockbackX -= nx * knockForce;
          a.knockbackY -= ny * knockForce;
          b.knockbackX += nx * knockForce;
          b.knockbackY += ny * knockForce;
          a.speed *= 0.4;
          b.speed *= 0.4;
        }

        // ダメージ（無敵・クールダウン考慮）
        if (a.invincible <= 0 && a.damageCooldown <= 0 && !aHitFront) {
          applyCollisionDamage(a, b, aIsAttacker, bIsAttacker);
        }
        if (b.invincible <= 0 && b.damageCooldown <= 0 && !bHitFront) {
          applyCollisionDamage(b, a, bIsAttacker, aIsAttacker);
        }
      }
    }
  }
}

function applyCollisionDamage(victim, attacker, victimWasAttacker, attackerWasAttacker) {
  // 前方からの衝突はダメージ無し（呼び出し側でチェック済み）
  // 攻撃側だった場合はダメージ軽減
  const attackMul = victimWasAttacker ? 0.3 : 1.0;
  const dmg = Math.max(0.3, attacker.attackPower * 0.4 - victim.durability * 0.15) * attackMul;
  const specialBonus = attacker.specialActive ? 2.5 : 1;
  victim.hp = Math.max(0, victim.hp - dmg * specialBonus);
  victim.damageCooldown = COLLISION_COOLDOWN;
}

// ========================================
// レース初期化
// ========================================
function initRace() {
  const course = COURSES[selectedCourse];
  coursePoints = getCoursePoints(course, COURSE_RESOLUTION);
  cars = [];
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
    p2.x = startPt.x - Math.cos(startAngle) * 30 + Math.cos(perpAngle) * 30;
    p2.y = startPt.y - Math.sin(startAngle) * 30 + Math.sin(perpAngle) * 30;
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
    // スタート間隔を広げる
    ai.x = startPt.x - Math.cos(startAngle) * (60 + row * 45) + Math.cos(perpAngle) * (col - 1) * 30;
    ai.y = startPt.y - Math.sin(startAngle) * (60 + row * 45) + Math.sin(perpAngle) * (col - 1) * 30;
    ai.angle = startAngle;
    ai.aiTargetWP = 2;
    cars.push(ai);
  }

  // コースキャッシュを構築
  buildCourseCache(course);

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
// タイトル画面
// ========================================
let titleMenuIdx = 0;
function drawTitle() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = FC_RED; ctx.lineWidth = 4;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.strokeStyle = FC_YELLOW; ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  fcTextWithShadow("激 突 四 駆", W / 2, 250, FC_YELLOW, 64, "center");
  fcTextWithShadow("R  E", W / 2, 330, FC_RED, 72, "center");
  fcText("GEKITOTSU YONKU RE", W / 2, 400, FC_CYAN, 18, "center");

  // メニュー
  const menuItems = ["START", "CONFIG"];
  menuItems.forEach((item, i) => {
    const y = 500 + i * 50;
    const selected = i === titleMenuIdx;
    const cursor = selected ? "▶ " : "  ";
    const color = selected ? FC_YELLOW : "#606060";
    if (selected && Math.floor(raceTimer / 15) % 2 === 0) {
      fcText(cursor + item, W / 2 - 60, y, color, 22);
    } else {
      fcText(cursor + item, W / 2 - 60, y, selected ? FC_WHITE : "#505050", 22);
    }
  });

  // ゲームパッド接続状態
  if (gpConnected) {
    fcText("🎮", W / 2 + 100, 510, FC_GREEN, 14, "center");
  }

  if (imagesLoaded > 0) {
    const t = raceTimer * 0.5;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 8; i++) {
      const idx = Math.floor((t / 80 + i) % CAR_DATA.length);
      const img = carImagesOriginal[idx];
      if (img && img.complete && img.naturalWidth > 0) {
        const px = ((t + i * 150) % (W + 100)) - 50;
        // スプライトシート: フレーム0のみ描画
        const frameW = img.naturalWidth / 2;
        ctx.drawImage(img, 0, 0, frameW, img.naturalHeight, px, 660, frameW, img.naturalHeight);
      }
    }
    ctx.imageSmoothingEnabled = true;
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
// マシン選択（モダンFC風レイアウト）
// ========================================
let selectingPlayer = 0;
let colorSelectMode = false;
let carSelectAnim = 0;
let lastSelectedCar = -1;
let paramAnimProgress = 0;

function drawCarSelect() {
  carSelectAnim++;

  // マシン変更時にパラメーターアニメーションをリセット
  const currentSel = selectingPlayer === 0 ? selectedCar : selectedCar2;
  if (currentSel !== lastSelectedCar) {
    lastSelectedCar = currentSel;
    paramAnimProgress = 0;
  }
  // アニメーション進行（30フレームで完了）
  if (paramAnimProgress < 30) paramAnimProgress++;
  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(0, 0, W, H);

  // スキャンライン効果（モダンFC風）
  ctx.fillStyle = "rgba(0,0,0,0.03)";
  for (let sy = 0; sy < H; sy += 3) {
    ctx.fillRect(0, sy, W, 1);
  }

  const sel = selectingPlayer === 0 ? selectedCar : selectedCar2;
  const colIdx = selectingPlayer === 0 ? playerColor1 : playerColor2;
  const plabel = gameMode === "multi" ? `${selectingPlayer + 1}P` : "";

  // ===== ヘッダー =====
  // グラデーション風のヘッダーバー
  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, "#1a1a2e");
  headerGrad.addColorStop(0.5, "#16213e");
  headerGrad.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, 60);

  ctx.strokeStyle = FC_CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.lineTo(W, 60);
  ctx.stroke();

  if (plabel) {
    // プレイヤー表示（2P対戦時）
    ctx.fillStyle = selectingPlayer === 0 ? FC_RED : FC_BLUE;
    ctx.fillRect(30, 15, 60, 30);
    fcText(plabel, 60, 38, FC_WHITE, 18, "center");
  }

  fcTextWithShadow("MACHINE SELECT", W / 2, 42, FC_CYAN, 28, "center");
  fcText(`No.${String(sel + 1).padStart(2, "0")}`, W - 80, 38, FC_YELLOW, 16, "center");

  // ===== 中央エリア: 左=マシン表示、右=パラメータ =====
  const centerY = 80;
  const centerH = 430;

  // 左側: マシン表示エリア
  const leftX = 40;
  const leftW = 520;

  // 背景パネル（角丸風）
  ctx.fillStyle = "#12121f";
  ctx.fillRect(leftX, centerY, leftW, centerH);
  ctx.strokeStyle = "#2a2a4a";
  ctx.lineWidth = 2;
  ctx.strokeRect(leftX, centerY, leftW, centerH);

  // マシン名（大きく）
  const carName = CAR_DATA[sel].name;
  fcTextWithShadow(carName, leftX + leftW / 2, centerY + 45, FC_YELLOW, 22, "center");

  // マシン画像表示エリア（グリッド背景付き）
  const imgAreaX = leftX + 60;
  const imgAreaY = centerY + 70;
  const imgAreaW = 400;
  const imgAreaH = 280;

  // グリッド背景
  ctx.fillStyle = "#606060";
  ctx.fillRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH);

  // ドットグリッドパターン
  ctx.fillStyle = "#707070";
  for (let gx = imgAreaX; gx < imgAreaX + imgAreaW; gx += 16) {
    for (let gy = imgAreaY; gy < imgAreaY + imgAreaH; gy += 16) {
      ctx.fillRect(gx, gy, 1, 1);
    }
  }

  // 選択中のマシン（大きく表示 + アニメーション）
  const img = getColoredCar(sel, colIdx);
  if (img) {
    ctx.imageSmoothingEnabled = false;
    const frameW = img.width / 2;
    const frameH = img.height;
    const scale = 4;
    const dw = frameW * scale;
    const dh = frameH * scale;

    // フレームアニメーション
    const animFrame = Math.floor(carSelectAnim / 8) % 2;
    const sx = animFrame * frameW;

    // 影
    ctx.globalAlpha = 0.3;
    ctx.drawImage(img, sx, 0, frameW, frameH,
      imgAreaX + imgAreaW / 2 - dw / 2 + 8, imgAreaY + imgAreaH / 2 - dh / 2 + 8, dw, dh);
    ctx.globalAlpha = 1.0;

    // 本体
    ctx.drawImage(img, sx, 0, frameW, frameH,
      imgAreaX + imgAreaW / 2 - dw / 2, imgAreaY + imgAreaH / 2 - dh / 2, dw, dh);
    ctx.imageSmoothingEnabled = true;
  }

  // 枠線
  ctx.strokeStyle = FC_CYAN;
  ctx.lineWidth = 2;
  ctx.strokeRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH);

  // カラー選択
  const colorY = centerY + 370;
  fcText("BODY COLOR", leftX + leftW / 2, colorY, colorSelectMode ? FC_YELLOW : "#606080", 12, "center");

  const colorBoxW = 28;
  const colorStartX = leftX + leftW / 2 - (BODY_COLORS.length * colorBoxW) / 2;
  BODY_COLORS.forEach((bc, i) => {
    const bx = colorStartX + i * colorBoxW;
    const by = colorY + 10;
    ctx.fillStyle = bc.color;
    ctx.fillRect(bx + 2, by, colorBoxW - 4, 20);
    if (i === colIdx) {
      ctx.strokeStyle = FC_YELLOW;
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by - 2, colorBoxW, 24);
      // 選択中カラー名
      fcText(bc.name, leftX + leftW / 2, colorY + 50, FC_YELLOW, 14, "center");
    }
  });

  if (colorSelectMode) {
    fcText("◀ ▶ でへんこう  Enter:かくてい", leftX + leftW / 2, colorY + 75, FC_CYAN, 11, "center");
  } else {
    fcText("C: カラーへんこう", leftX + leftW / 2, colorY + 75, "#404060", 10, "center");
  }

  // ===== 右側: パラメータ =====
  const rightX = 580;
  const rightW = 580;

  ctx.fillStyle = "#12121f";
  ctx.fillRect(rightX, centerY, rightW, centerH);
  ctx.strokeStyle = "#2a2a4a";
  ctx.lineWidth = 2;
  ctx.strokeRect(rightX, centerY, rightW, centerH);

  fcText("PARAMETERS", rightX + rightW / 2, centerY + 30, FC_WHITE, 14, "center");

  // パラメータバー（大きめに見やすく）
  const params = [
    { label: "SPEED",    labelJp: "スピード",   val: CAR_DATA[sel].speed,      col: "#ff4060", icon: "▶" },
    { label: "ACCEL",    labelJp: "かそく",     val: CAR_DATA[sel].accel,      col: "#ff8040", icon: "⬆" },
    { label: "BRAKE",    labelJp: "ブレーキ",   val: CAR_DATA[sel].brake,      col: "#4080ff", icon: "■" },
    { label: "OFFROAD",  labelJp: "オフロード", val: CAR_DATA[sel].offroad,    col: "#40c040", icon: "◆" },
    { label: "ATTACK",   labelJp: "こうげき",   val: CAR_DATA[sel].attack,     col: "#ff6080", icon: "★" },
    { label: "ARMOR",    labelJp: "たいきゅう", val: CAR_DATA[sel].durability, col: "#40c0c0", icon: "●" },
    { label: "HANDLING", labelJp: "ハンドル",   val: CAR_DATA[sel].handling,   col: "#c0c040", icon: "◎" },
  ];

  const paramStartY = centerY + 55;
  const paramHeight = 58;
  const barX = rightX + 180;
  const barW = 300;

  params.forEach((p, i) => {
    const y = paramStartY + i * paramHeight;

    // アニメーション: 各バーに遅延をつけて順番に伸びる
    const animDelay = i * 3; // 各バー3フレームずつ遅延
    const animT = Math.max(0, Math.min(1, (paramAnimProgress - animDelay) / 15));
    // イージング（ease-out）
    const easeT = 1 - Math.pow(1 - animT, 3);

    // アイコンと日本語ラベル（フェードイン）
    ctx.globalAlpha = easeT;
    fcText(p.icon, rightX + 25, y + 18, p.col, 16);
    fcText(p.labelJp, rightX + 50, y + 18, "#808090", 13);
    fcText(p.label, rightX + 50, y + 35, "#404050", 9);
    ctx.globalAlpha = 1.0;

    // バー背景
    ctx.fillStyle = "#1a1a2a";
    ctx.fillRect(barX, y + 8, barW, 22);

    // バー本体（アニメーション付きグラデーション）
    const targetFillW = barW * (p.val / 10);
    const fillW = targetFillW * easeT;
    if (fillW > 0) {
      const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      barGrad.addColorStop(0, p.col);
      barGrad.addColorStop(1, p.col + "80");
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, y + 8, fillW, 22);

      // 伸びる先端にハイライト効果
      if (easeT < 1) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(barX + fillW - 4, y + 8, 4, 22);
      }
    }

    // バーセグメント（10段階）
    ctx.strokeStyle = "#0a0a12";
    ctx.lineWidth = 2;
    for (let s = 1; s < 10; s++) {
      const sx = barX + (barW / 10) * s;
      ctx.beginPath();
      ctx.moveTo(sx, y + 8);
      ctx.lineTo(sx, y + 30);
      ctx.stroke();
    }

    // 枠
    ctx.strokeStyle = "#3a3a5a";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, y + 8, barW, 22);

    // 数値（カウントアップアニメーション）
    const displayVal = Math.round(p.val * easeT);
    fcText(`${displayVal}`, barX + barW + 20, y + 25, p.col, 18);
  });

  // 総合評価（オプション）
  const totalStats = params.reduce((sum, p) => sum + p.val, 0);
  const avgRating = (totalStats / params.length).toFixed(1);
  fcText("TOTAL RATING", rightX + rightW / 2, centerY + paramHeight * 7 + 70, "#606080", 10, "center");
  fcText(avgRating, rightX + rightW / 2, centerY + paramHeight * 7 + 95, FC_YELLOW, 24, "center");

  // ===== 下部: マシン一覧（2行×13列） =====
  const listY = 520;
  const listH = 200;

  // 背景
  ctx.fillStyle = "#101018";
  ctx.fillRect(0, listY, W, listH);
  ctx.strokeStyle = FC_CYAN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, listY);
  ctx.lineTo(W, listY);
  ctx.stroke();

  const thumbCols = 13;
  const thumbW = 78;
  const thumbH = 90;
  const thumbStartX = (W - thumbCols * thumbW) / 2;
  const thumbStartY = listY + 10;

  for (let i = 0; i < CAR_DATA.length; i++) {
    const row = Math.floor(i / thumbCols);
    const col = i % thumbCols;
    const tx = thumbStartX + col * thumbW + thumbW / 2;
    const ty = thumbStartY + row * thumbH;

    const isSelected = i === sel;

    // サムネイル画像（先にサイズを決定してカーソルに使う）
    const tImg = getColoredCar(i, isSelected ? colIdx : 0);
    if (tImg) {
      const tFrameW = tImg.width / 2;
      const tScale = 1.5;
      const tdw = tFrameW * tScale;
      const tdh = tImg.height * tScale;

      // 選択枠（画像サイズに合わせる）
      if (isSelected) {
        const pad = 4;
        const glowAlpha = 0.3 + Math.sin(carSelectAnim * 0.1) * 0.2;
        ctx.fillStyle = `rgba(248, 216, 0, ${glowAlpha})`;
        ctx.fillRect(tx - tdw / 2 - pad, ty - pad, tdw + pad * 2, tdh + pad * 2);
        ctx.strokeStyle = FC_YELLOW;
        ctx.lineWidth = 2;
        ctx.strokeRect(tx - tdw / 2 - pad, ty - pad, tdw + pad * 2, tdh + pad * 2);
      }

      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = isSelected ? 1.0 : 0.6;
      ctx.drawImage(tImg, 0, 0, tFrameW, tImg.height,
        tx - tdw / 2, ty, tdw, tdh);
      ctx.globalAlpha = 1.0;
      ctx.imageSmoothingEnabled = true;
    }
  }

  // ===== フッター: 操作説明 =====
  const footerY = H - 35;
  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(0, footerY - 5, W, 40);

  const controls = colorSelectMode
    ? "◀▶:カラー  Enter:かくてい  ESC:キャンセル"
    : "◀▶:マシン  ▲▼:れつ  C:カラー  Enter:けってい  ESC:もどる";
  fcText(controls, W / 2, footerY + 12, "#808090", 12, "center");
}

// ========================================
// コース選択
// ========================================
function drawCourseSelect() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  fcWindow(200, 20, W - 400, 50, FC_CYAN);
  fcTextWithShadow("コース セレクト", W / 2, 55, FC_CYAN, 26, "center");

  const course = COURSES[selectedCourse];
  const previewPts = getCoursePoints(course, 10);

  ctx.save();
  ctx.translate(W / 2 - 200, 90);
  ctx.scale(0.45, 0.45);
  ctx.fillStyle = course.bgColor;
  ctx.fillRect(0, 0, W, H);
  const surfColors = { road: course.roadColor, offroad: "#9a7d50", ice: "#c0dae8" };
  for (let i = 0; i < previewPts.length; i++) {
    const p1 = previewPts[i], p2 = previewPts[(i + 1) % previewPts.length];
    ctx.strokeStyle = course.wallColor;
    ctx.lineWidth = course.roadWidth + 6;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.strokeStyle = surfColors[p1.surface] || course.roadColor;
    ctx.lineWidth = course.roadWidth;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  ctx.restore();

  fcWindow(200, 510, W - 400, 100, FC_YELLOW);
  fcTextWithShadow(course.name, W / 2, 545, FC_YELLOW, 28, "center");
  fcText(course.description, W / 2, 575, FC_WHITE, 15, "center");
  fcText(`${TOTAL_LAPS} しゅう`, W / 2, 595, FC_CYAN, 14, "center");

  COURSES.forEach((c, i) => {
    const x = 110 + i * 165, y = 660;
    if (i === selectedCourse) {
      ctx.fillStyle = FC_YELLOW;
      ctx.fillRect(x - 4, y - 14, 150, 24);
      ctx.fillStyle = FC_BLACK;
    } else {
      ctx.fillStyle = "#505050";
    }
    ctx.font = "bold 13px monospace"; ctx.textAlign = "left";
    ctx.fillText(`${i + 1}. ${c.name}`, x, y);
  });

  fcText("←→:えらぶ  Enter:スタート  ESC:もどる", W / 2, H - 40, FC_DKGRAY, 13, "center");
  ctx.textAlign = "start";
}

// ========================================
// カウントダウン
// ========================================
function drawCountdown() {
  drawCourse();
  cars.forEach(c => drawCar(c));
  const sec = Math.ceil(countdownTimer / 60);
  ctx.textAlign = "center";
  fcTextWithShadow(sec > 0 ? String(sec) : "GO!!", W / 2, H / 2 + 20, sec > 0 ? FC_WHITE : FC_YELLOW, 80, "center");
  ctx.textAlign = "start";
}

// ========================================
// レースUI
// ========================================
function drawRaceUI() {
  drawCourse();

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

  drawMinimap();
}

function drawMinimap() {
  const mx = W - 155, my = H - 130, mw = 145, mh = 120;
  fcWindow(mx, my, mw, mh, FC_WHITE);
  const scaleX = (mw - 10) / W, scaleY = (mh - 10) / H;
  ctx.strokeStyle = "#404040"; ctx.lineWidth = 2;
  ctx.beginPath();
  coursePoints.forEach((p, i) => {
    const px = mx + 5 + p.x * scaleX, py = my + 5 + p.y * scaleY;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath(); ctx.stroke();
  cars.forEach(c => {
    ctx.fillStyle = c.isPlayer ? (c.playerId === 0 ? FC_RED : FC_BLUE) : FC_YELLOW;
    ctx.fillRect(mx + 5 + c.x * scaleX - 2, my + 5 + c.y * scaleY - 2, 4, 4);
  });
}

// ========================================
// リザルト（レイアウト改善版）
// ========================================
function drawResult() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  // タイトル
  fcWindow(200, 20, W - 400, 55, FC_YELLOW);
  fcTextWithShadow("RESULT", W / 2, 58, FC_YELLOW, 28, "center");

  // コース名
  fcText(COURSES[selectedCourse].name, W / 2, 95, FC_CYAN, 14, "center");

  const rankings = getRankings();
  const rowHeight = 85;
  const startY = 120;

  // 順位ごとのカード表示
  rankings.forEach((c, i) => {
    const y = startY + i * rowHeight;
    const isTop3 = i < 3;
    const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"];
    const borderColor = isTop3 ? medalColors[i] : FC_DKGRAY;
    const bgColor = isTop3 ? (i === 0 ? "#2a2810" : i === 1 ? "#202025" : "#201815") : "#101010";

    // カード背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(100, y, W - 200, rowHeight - 8);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isTop3 ? 3 : 1;
    ctx.strokeRect(100, y, W - 200, rowHeight - 8);

    // 順位（大きく表示）
    const rankX = 150;
    if (isTop3) {
      // メダル風の円
      ctx.beginPath();
      ctx.arc(rankX, y + 38, 25, 0, Math.PI * 2);
      ctx.fillStyle = borderColor;
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = getFcFont(`${i + 1}`, 24);
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}`, rankX, y + 46);
    } else {
      fcText(`${i + 1}`, rankX, y + 45, "#606060", 20, "center");
    }

    // プレイヤー表示
    if (c.isPlayer) {
      const plabel = c.playerId === 0 ? "1P" : "2P";
      const pcolor = c.playerId === 0 ? FC_RED : FC_BLUE;
      ctx.fillStyle = pcolor;
      ctx.fillRect(190, y + 10, 40, 20);
      fcText(plabel, 210, y + 26, FC_WHITE, 12, "center");
    }

    // マシン画像（大きく表示）
    const img = getColoredCar(c.dataIndex, c.colorIndex);
    if (img) {
      ctx.imageSmoothingEnabled = false;
      const frameW = img.width / 2;
      const scale = 2.5;
      ctx.drawImage(img, 0, 0, frameW, img.height, 250, y + 8, frameW * scale, img.height * scale);
      ctx.imageSmoothingEnabled = true;
    }

    // マシン名
    const nameColor = isTop3 ? borderColor : "#808080";
    fcText(CAR_DATA[c.dataIndex].name, 330, y + 30, nameColor, 14);

    // ステータス（HPバー）
    const hpRatio = Math.max(0, c.hp / MAX_HP);
    const hpBarW = 100;
    ctx.fillStyle = "#303030";
    ctx.fillRect(330, y + 45, hpBarW, 8);
    ctx.fillStyle = hpRatio > 0.5 ? FC_GREEN : hpRatio > 0.25 ? FC_YELLOW : FC_RED;
    ctx.fillRect(330, y + 45, hpBarW * hpRatio, 8);
    fcText("HP", 310, y + 53, "#606060", 9);

    // タイム/状態
    ctx.textAlign = "right";
    if (c.finished) {
      fcText(`${(c.finishTime / 60).toFixed(2)}`, W - 200, y + 35, isTop3 ? borderColor : FC_WHITE, 20, "right");
      fcText("SEC", W - 130, y + 35, "#606060", 10, "right");
    } else if (c.hp <= 0) {
      fcText("DESTROYED", W - 130, y + 35, FC_RED, 14, "right");
    } else {
      fcText(`LAP ${c.lap + 1}`, W - 130, y + 35, "#505050", 14, "right");
    }

    // ラップ数
    fcText(`${c.lap}/${TOTAL_LAPS} LAP`, W - 130, y + 55, "#404040", 10, "right");
    ctx.textAlign = "start";
  });

  // 操作説明
  fcWindow(200, H - 70, W - 400, 50, FC_DKGRAY);
  fcText("Enter: つぎへ   ESC: タイトル", W / 2, H - 38, FC_WHITE, 12, "center");
}

// ========================================
// グランプリ総合結果（レイアウト改善版）
// ========================================
function drawGrandPrixResult() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  fcWindow(200, 20, W - 400, 55, FC_YELLOW);
  fcTextWithShadow("GRAND PRIX RESULT", W / 2, 58, FC_YELLOW, 22, "center");

  const pointTable = [10, 7, 5, 4, 3, 2, 1];
  const totals = {};
  gpResults.forEach(raceRanking => {
    raceRanking.forEach((c, rank) => {
      const key = c.dataIndex;
      if (!totals[key]) totals[key] = { dataIndex: c.dataIndex, points: 0, isPlayer: c.isPlayer, playerId: c.playerId, colorIndex: c.colorIndex };
      totals[key].points += pointTable[rank] || 1;
    });
  });
  const sorted = Object.values(totals).sort((a, b) => b.points - a.points);

  const rowHeight = 75;
  const startY = 95;

  sorted.slice(0, 8).forEach((entry, i) => {
    const y = startY + i * rowHeight;
    const isTop3 = i < 3;
    const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"];
    const borderColor = isTop3 ? medalColors[i] : FC_DKGRAY;

    // カード
    ctx.fillStyle = isTop3 ? "#151520" : "#0a0a10";
    ctx.fillRect(150, y, W - 300, rowHeight - 8);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isTop3 ? 3 : 1;
    ctx.strokeRect(150, y, W - 300, rowHeight - 8);

    // 順位
    if (isTop3) {
      ctx.beginPath();
      ctx.arc(200, y + 33, 22, 0, Math.PI * 2);
      ctx.fillStyle = borderColor;
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = getFcFont(`${i + 1}`, 22);
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}`, 200, y + 40);
    } else {
      fcText(`${i + 1}`, 200, y + 40, "#606060", 18, "center");
    }

    // プレイヤー表示
    if (entry.isPlayer) {
      ctx.fillStyle = FC_RED;
      ctx.fillRect(235, y + 12, 35, 18);
      fcText("1P", 252, y + 26, FC_WHITE, 10, "center");
    }

    // マシン画像
    const img = getColoredCar(entry.dataIndex, entry.colorIndex || 0);
    if (img) {
      ctx.imageSmoothingEnabled = false;
      const frameW = img.width / 2;
      ctx.drawImage(img, 0, 0, frameW, img.height, 285, y + 8, frameW * 2, img.height * 2);
      ctx.imageSmoothingEnabled = true;
    }

    // マシン名
    fcText(CAR_DATA[entry.dataIndex].name, 355, y + 35, isTop3 ? borderColor : "#707070", 13);

    // ポイント
    fcText(`${entry.points}`, W - 250, y + 40, isTop3 ? borderColor : FC_WHITE, 24, "right");
    fcText("pts", W - 180, y + 40, "#606060", 12, "right");
    ctx.textAlign = "start";
  });

  // チャンピオン演出
  if (sorted.length > 0 && sorted[0].isPlayer) {
    if (Math.floor(raceTimer / 15) % 2 === 0) {
      fcTextWithShadow("CHAMPION!", W / 2, H - 80, FC_YELLOW, 36, "center");
    }
  }

  fcWindow(300, H - 55, W - 600, 40, FC_DKGRAY);
  fcText("Enter: タイトルへ", W / 2, H - 28, FC_WHITE, 12, "center");
  raceTimer++;
}

// ========================================
// コントローラー設定画面
// ========================================
let configSelectIdx = 0;
const configActions = ["up", "down", "left", "right", "accel", "brake", "special", "start"];
const configLabels = {
  up: "うえ", down: "した", left: "ひだり", right: "みぎ",
  accel: "アクセル", brake: "ブレーキ", special: "スペシャル", start: "スタート"
};

function drawControllerConfig() {
  ctx.fillStyle = FC_BLACK;
  ctx.fillRect(0, 0, W, H);

  fcWindow(200, 30, W - 400, 55, FC_CYAN);
  fcTextWithShadow("コントローラー せってい", W / 2, 68, FC_CYAN, 22, "center");

  // 接続状態
  const statusColor = gpConnected ? FC_GREEN : FC_RED;
  const statusText = gpConnected ? "コントローラー: せつぞくちゅう" : "コントローラー: みけんしゅつ";
  fcText(statusText, W / 2, 110, statusColor, 14, "center");

  // ボタン設定一覧
  fcWindow(200, 130, W - 400, 450, FC_WHITE);

  configActions.forEach((action, i) => {
    const y = 170 + i * 50;
    const isSelected = i === configSelectIdx;
    const isConfiguring = gpConfiguring === action;

    // 選択枠
    if (isSelected) {
      ctx.fillStyle = "rgba(248,216,0,0.15)";
      ctx.fillRect(210, y - 18, W - 420, 45);
      ctx.strokeStyle = FC_YELLOW;
      ctx.lineWidth = 2;
      ctx.strokeRect(210, y - 18, W - 420, 45);
    }

    // アクション名
    fcText(configLabels[action], 250, y + 5, isSelected ? FC_YELLOW : FC_WHITE, 16);

    // 現在の設定
    const cfg = gpConfig[action];
    let bindText = "みせってい";
    if (cfg) {
      if (cfg.type === "button") bindText = `ボタン ${cfg.index}`;
      else if (cfg.type === "axis") bindText = `スティック ${cfg.index} ${cfg.dir < 0 ? "-" : "+"}`;
    }

    if (isConfiguring) {
      // 設定中は点滅
      if (Math.floor(raceTimer / 10) % 2 === 0) {
        fcText("ボタンを おしてください...", W - 280, y + 5, FC_CYAN, 12, "right");
      }
    } else {
      fcText(bindText, W - 280, y + 5, isSelected ? FC_CYAN : "#808080", 12, "right");
    }
  });

  // 操作説明
  fcWindow(200, 600, W - 400, 80, FC_DKGRAY);
  fcText("▲▼: せんたく   Enter: わりあて   Delete: クリア", W / 2, 635, FC_WHITE, 11, "center");
  fcText("ESC: もどる", W / 2, 660, FC_WHITE, 11, "center");

  raceTimer++;
}

// ========================================
// 入力処理
// ========================================
// キーボードまたはゲームパッドの入力を統一的に処理
function inputUp() { return onKeyOnce("ArrowUp") || gpButtonOnce("up"); }
function inputDown() { return onKeyOnce("ArrowDown") || gpButtonOnce("down"); }
function inputLeft() { return onKeyOnce("ArrowLeft") || gpButtonOnce("left"); }
function inputRight() { return onKeyOnce("ArrowRight") || gpButtonOnce("right"); }
function inputConfirm() { return onKeyOnce("Enter") || gpButtonOnce("accel") || gpButtonOnce("start"); }
function inputCancel() { return onKeyOnce("Escape") || gpButtonOnce("brake") || gpButtonOnce("select"); }

function handleInput() {
  switch (gameState) {
    case "title":
      if (inputUp()) titleMenuIdx = (titleMenuIdx - 1 + 2) % 2;
      if (inputDown()) titleMenuIdx = (titleMenuIdx + 1) % 2;
      if (inputConfirm()) {
        if (titleMenuIdx === 0) {
          gameState = "modeSelect"; modeSelectIdx = 0; raceTimer = 0;
        } else {
          gameState = "config"; configSelectIdx = 0; gpConfiguring = null; raceTimer = 0;
        }
      }
      break;

    case "config":
      if (gpConfiguring) {
        // ボタン割り当て中
        const pressed = gpAnyPressed();
        if (pressed) {
          gpConfig[gpConfiguring] = pressed;
          gpConfiguring = null;
        }
        if (onKeyOnce("Escape")) gpConfiguring = null;
      } else {
        if (inputUp()) configSelectIdx = (configSelectIdx - 1 + configActions.length) % configActions.length;
        if (inputDown()) configSelectIdx = (configSelectIdx + 1) % configActions.length;
        if (inputConfirm()) {
          // 割り当てモード開始
          gpConfiguring = configActions[configSelectIdx];
        }
        if (onKeyOnce("Delete") || onKeyOnce("Backspace")) {
          // 設定クリア
          gpConfig[configActions[configSelectIdx]] = null;
        }
        if (inputCancel()) { gameState = "title"; titleMenuIdx = 0; }
      }
      break;

    case "modeSelect":
      if (inputUp()) modeSelectIdx = (modeSelectIdx - 1 + 3) % 3;
      if (inputDown()) modeSelectIdx = (modeSelectIdx + 1) % 3;
      if (inputConfirm()) {
        if (modeSelectIdx === 0) { gameMode = "single"; gpResults = []; currentGPCourse = 0; }
        else if (modeSelectIdx === 1) { gameMode = "single"; }
        else { gameMode = "multi"; }
        selectingPlayer = 0;
        colorSelectMode = false;
        gameState = "carSelect";
      }
      if (inputCancel()) gameState = "title";
      break;

    case "carSelect": {
      const isSel2P = selectingPlayer === 1;
      const thumbCols = 13; // 2行13列のレイアウト

      if (colorSelectMode) {
        // カラー選択モード
        if (inputRight()) {
          if (isSel2P) playerColor2 = (playerColor2 + 1) % BODY_COLORS.length;
          else playerColor1 = (playerColor1 + 1) % BODY_COLORS.length;
        }
        if (inputLeft()) {
          if (isSel2P) playerColor2 = (playerColor2 - 1 + BODY_COLORS.length) % BODY_COLORS.length;
          else playerColor1 = (playerColor1 - 1 + BODY_COLORS.length) % BODY_COLORS.length;
        }
        if (inputConfirm() || onKeyOnce("c") || onKeyOnce("C") || gpButtonOnce("special")) colorSelectMode = false;
        break;
      }

      // マシン選択モード
      if (onKeyOnce("c") || onKeyOnce("C") || gpButtonOnce("special")) { colorSelectMode = true; break; }

      // 左右移動（1台ずつ）
      if (inputRight()) {
        if (isSel2P) selectedCar2 = (selectedCar2 + 1) % CAR_DATA.length;
        else selectedCar = (selectedCar + 1) % CAR_DATA.length;
      }
      if (inputLeft()) {
        if (isSel2P) selectedCar2 = (selectedCar2 - 1 + CAR_DATA.length) % CAR_DATA.length;
        else selectedCar = (selectedCar - 1 + CAR_DATA.length) % CAR_DATA.length;
      }

      // 上下移動（行移動: 13台ジャンプ）
      if (inputDown()) {
        if (isSel2P) {
          selectedCar2 = (selectedCar2 + thumbCols) % CAR_DATA.length;
        } else {
          selectedCar = (selectedCar + thumbCols) % CAR_DATA.length;
        }
      }
      if (inputUp()) {
        if (isSel2P) {
          selectedCar2 = (selectedCar2 - thumbCols + CAR_DATA.length) % CAR_DATA.length;
        } else {
          selectedCar = (selectedCar - thumbCols + CAR_DATA.length) % CAR_DATA.length;
        }
      }

      if (inputConfirm()) {
        if (gameMode === "multi" && selectingPlayer === 0) selectingPlayer = 1;
        else {
          if (modeSelectIdx === 0) { selectedCourse = currentGPCourse; initRace(); }
          else gameState = "courseSelect";
        }
      }
      if (inputCancel()) {
        if (selectingPlayer === 1) selectingPlayer = 0;
        else gameState = "modeSelect";
      }
      break;
    }

    case "courseSelect":
      if (inputRight()) selectedCourse = (selectedCourse + 1) % COURSES.length;
      if (inputLeft()) selectedCourse = (selectedCourse - 1 + COURSES.length) % COURSES.length;
      if (inputConfirm()) initRace();
      if (inputCancel()) gameState = "carSelect";
      break;

    case "countdown":
      countdownTimer--;
      if (countdownTimer <= 0) gameState = "race";
      break;

    case "race":
      if (inputCancel()) gameState = "result";
      break;

    case "result":
      if (inputConfirm()) {
        if (modeSelectIdx === 0) {
          gpResults.push(getRankings());
          currentGPCourse++;
          if (currentGPCourse >= COURSES.length) { raceTimer = 0; gameState = "grandprixResult"; }
          else { selectedCourse = currentGPCourse; initRace(); }
        } else gameState = "title";
      }
      if (inputCancel()) gameState = "title";
      break;

    case "grandprixResult":
      if (inputConfirm() || inputCancel()) gameState = "title";
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
    case "config":          drawControllerConfig(); break;
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
