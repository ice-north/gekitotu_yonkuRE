// 激突四駆RE - メインゲームロジック

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ========================================
// 定数
// ========================================
const SCALE = 3;           // ドット絵の拡大率
const TOTAL_LAPS = 5;
const MAX_HP = 100;
const SPECIAL_COOLDOWN = 300; // スペシャルのクールダウン(フレーム)
const AI_COUNT = 5;        // AI車の数

// ========================================
// 画像読み込み
// ========================================
const carImages = [];
let imagesLoaded = 0;
CAR_DATA.forEach((data) => {
  const img = new Image();
  img.src = data.img;
  img.onload = () => { imagesLoaded++; };
  carImages.push(img);
});

// ========================================
// ゲーム状態
// ========================================
let gameState = "title";   // title, modeSelect, carSelect, courseSelect, countdown, race, result, grandprixResult
let gameMode = "single";   // single, multi
let selectedCar = 0;
let selectedCar2 = 0;      // 2P用
let selectedCourse = 0;
let currentGPCourse = 0;   // グランプリの現在のコース
let gpResults = [];         // グランプリの各レース結果

// コースの補間ポイント（レース開始時に生成）
let coursePoints = [];
const COURSE_RESOLUTION = 20;

// ========================================
// 車オブジェクト生成
// ========================================
function createCar(dataIndex, isPlayer, playerId) {
  const d = CAR_DATA[dataIndex];
  return {
    dataIndex,
    isPlayer,
    playerId: playerId || 0,  // 0=1P, 1=2P
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
    // パラメータから実値を計算
    maxSpeed:     1.5 + d.speed * 0.45,
    accelRate:    0.03 + d.accel * 0.018,
    brakeRate:    0.04 + d.brake * 0.015,
    offroadRate:  0.3 + d.offroad * 0.07,   // オフロードでの速度維持率
    attackPower:  d.attack,
    durability:   d.durability,
    handleRate:   0.015 + d.handling * 0.005,
    // AI用
    aiTargetWP: 0,
    aiVariance: (Math.random() - 0.5) * 0.3, // 個体差
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

// ========================================
// コース描画
// ========================================
function drawCourse(course) {
  // 背景
  ctx.fillStyle = course.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 路面タイプごとの色
  const surfaceColors = {
    road: course.roadColor,
    offroad: "#a08050",
    ice: "#c8e0f0",
  };

  // コースを描画（セグメントごとに路面色を変える）
  const pts = coursePoints;
  const w = course.roadWidth;

  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    ctx.strokeStyle = surfaceColors[p1.surface] || course.roadColor;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // コース境界線
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  for (let i = 0; i <= pts.length; i++) {
    const p = pts[i % pts.length];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // スタート/ゴールライン
  const sp = pts[0];
  const sp2 = pts[1];
  const lineAngle = Math.atan2(sp2.y - sp.y, sp2.x - sp.x) + Math.PI / 2;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sp.x + Math.cos(lineAngle) * w / 2, sp.y + Math.sin(lineAngle) * w / 2);
  ctx.lineTo(sp.x - Math.cos(lineAngle) * w / 2, sp.y - Math.sin(lineAngle) * w / 2);
  ctx.stroke();

  // 路面テクスチャの装飾
  drawSurfaceDecoration(course);
}

function drawSurfaceDecoration(course) {
  // オフロードの小石や氷の模様を簡易描画
  const pts = coursePoints;
  for (let i = 0; i < pts.length; i += 5) {
    const p = pts[i];
    if (p.surface === "offroad") {
      ctx.fillStyle = "rgba(80,60,30,0.3)";
      ctx.fillRect(p.x - 2 + Math.sin(i) * 10, p.y - 1 + Math.cos(i) * 8, 3, 2);
    } else if (p.surface === "ice") {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(i * 3) * 15, p.y + Math.cos(i * 2) * 12, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ========================================
// 車描画
// ========================================
function drawCar(c) {
  const img = carImages[c.dataIndex];
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle + Math.PI / 2);
  ctx.imageSmoothingEnabled = false;

  if (img && img.complete && img.naturalWidth > 0) {
    const w = img.naturalWidth * SCALE;
    const h = img.naturalHeight * SCALE;
    // スペシャル発動中は光る
    if (c.specialActive) {
      ctx.shadowColor = "#ff0";
      ctx.shadowBlur = 15;
    }
    // ダメージで赤くフラッシュ
    if (c.hp < MAX_HP * 0.3) {
      ctx.globalAlpha = 0.6 + Math.sin(raceTimer * 0.3) * 0.4;
    }
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = c.isPlayer ? "#e33" : "#33e";
    ctx.fillRect(-12, -18, 24, 36);
  }

  ctx.restore();

  // HPバー（レース中）
  if (gameState === "race") {
    const barW = 30;
    const barH = 4;
    const hpRatio = c.hp / MAX_HP;
    ctx.fillStyle = "#300";
    ctx.fillRect(c.x - barW / 2, c.y - 25, barW, barH);
    ctx.fillStyle = hpRatio > 0.5 ? "#0c0" : hpRatio > 0.25 ? "#cc0" : "#c00";
    ctx.fillRect(c.x - barW / 2, c.y - 25, barW * hpRatio, barH);
  }
}

// ========================================
// 路面の効果を取得
// ========================================
function getSurfaceAt(x, y) {
  let minDist = Infinity;
  let surface = "road";
  for (let i = 0; i < coursePoints.length; i++) {
    const p = coursePoints[i];
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < minDist) {
      minDist = d;
      surface = p.surface;
    }
  }
  const course = COURSES[selectedCourse];
  const onRoad = minDist < (course.roadWidth / 2 + 5) ** 2;
  return { surface: onRoad ? surface : "grass", onRoad };
}

// ========================================
// 車の更新（プレイヤー）
// ========================================
function updatePlayerCar(c, upKey, downKey, leftKey, rightKey, specialKey) {
  if (c.finished || c.hp <= 0) return;

  const surf = getSurfaceAt(c.x, c.y);
  let frictionMul = 1;
  let turnMul = 1;

  // 路面効果
  if (surf.surface === "grass") {
    frictionMul = 0.4;
    turnMul = 0.6;
  } else if (surf.surface === "offroad") {
    frictionMul = 0.5 + c.offroadRate * 0.5;
    turnMul = 0.8;
  } else if (surf.surface === "ice") {
    frictionMul = 1.05; // 氷は減速しにくいが…
    turnMul = 0.35;     // 曲がりにくい
  }

  // アクセル
  if (keys[upKey]) {
    c.speed = Math.min(c.speed + c.accelRate * frictionMul, c.maxSpeed * frictionMul);
  } else if (keys[downKey]) {
    c.speed = Math.max(c.speed - c.brakeRate, -c.maxSpeed * 0.3);
  } else {
    if (c.speed > 0) c.speed = Math.max(c.speed - 0.02, 0);
    if (c.speed < 0) c.speed = Math.min(c.speed + 0.02, 0);
  }

  // ステアリング
  if (Math.abs(c.speed) > 0.05) {
    const dir = c.speed > 0 ? 1 : -1;
    if (keys[leftKey]) c.angle -= c.handleRate * turnMul * dir;
    if (keys[rightKey]) c.angle += c.handleRate * turnMul * dir;
  }

  // スペシャル
  if (c.specialTimer > 0) c.specialTimer--;
  if (keys[specialKey] && c.specialTimer <= 0 && !c.specialActive) {
    c.specialActive = true;
    c.specialDuration = 90; // 1.5秒
    c.specialTimer = SPECIAL_COOLDOWN;
  }
  if (c.specialActive) {
    c.specialDuration--;
    c.speed = Math.min(c.speed + 0.1, c.maxSpeed * 1.5);
    if (c.specialDuration <= 0) c.specialActive = false;
  }

  // 位置更新
  c.x += Math.cos(c.angle) * c.speed;
  c.y += Math.sin(c.angle) * c.speed;

  // 画面端バウンド
  if (c.x < 10) { c.x = 10; c.speed *= -0.3; }
  if (c.x > canvas.width - 10) { c.x = canvas.width - 10; c.speed *= -0.3; }
  if (c.y < 10) { c.y = 10; c.speed *= -0.3; }
  if (c.y > canvas.height - 10) { c.y = canvas.height - 10; c.speed *= -0.3; }

  updateCheckpoint(c);
}

// ========================================
// AI車の更新
// ========================================
function updateAICar(c) {
  if (c.finished || c.hp <= 0) return;

  const surf = getSurfaceAt(c.x, c.y);
  let frictionMul = 1;
  let turnMul = 1;

  if (surf.surface === "grass") { frictionMul = 0.4; turnMul = 0.6; }
  else if (surf.surface === "offroad") { frictionMul = 0.5 + c.offroadRate * 0.5; turnMul = 0.8; }
  else if (surf.surface === "ice") { frictionMul = 1.05; turnMul = 0.35; }

  // ターゲットウェイポイントに向かう
  const target = coursePoints[c.aiTargetWP];
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const targetAngle = Math.atan2(dy, dx);

  // 目標に近づいたら次のウェイポイントへ
  if (dist < 40) {
    c.aiTargetWP = (c.aiTargetWP + 1) % coursePoints.length;
  }

  // 角度差を計算して操舵
  let angleDiff = targetAngle - c.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const turnRate = c.handleRate * turnMul * (0.8 + c.aiVariance);
  if (angleDiff > 0.05) c.angle += Math.min(turnRate, angleDiff);
  else if (angleDiff < -0.05) c.angle += Math.max(-turnRate, angleDiff);

  // 速度制御（カーブではやや減速）
  const speedFactor = 1 - Math.min(Math.abs(angleDiff) * 0.5, 0.5);
  const targetSpeed = c.maxSpeed * frictionMul * speedFactor * (0.85 + c.aiVariance * 0.3);
  if (c.speed < targetSpeed) {
    c.speed = Math.min(c.speed + c.accelRate * frictionMul * 0.9, targetSpeed);
  } else {
    c.speed = Math.max(c.speed - c.brakeRate * 0.5, targetSpeed * 0.7);
  }

  // 位置更新
  c.x += Math.cos(c.angle) * c.speed;
  c.y += Math.sin(c.angle) * c.speed;

  // 画面端
  c.x = Math.max(10, Math.min(canvas.width - 10, c.x));
  c.y = Math.max(10, Math.min(canvas.height - 10, c.y));

  updateCheckpoint(c);
}

// ========================================
// チェックポイント・ラップ管理
// ========================================
function updateCheckpoint(c) {
  const totalCP = coursePoints.length;
  const checkInterval = Math.floor(totalCP / 8); // 8つのチェックポイント
  const nextCP = (c.checkpoint + 1) % 8;
  const nextCPIndex = nextCP * checkInterval;

  if (nextCPIndex < totalCP) {
    const cp = coursePoints[nextCPIndex];
    const dx = cp.x - c.x;
    const dy = cp.y - c.y;
    if (dx * dx + dy * dy < 50 * 50) {
      c.checkpoint = nextCP;
      if (nextCP === 0) {
        c.lap++;
        if (c.lap >= TOTAL_LAPS) {
          c.finished = true;
          c.finishTime = raceTimer;
        }
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
      const a = cars[i];
      const b = cars[j];
      if (a.hp <= 0 || b.hp <= 0) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = 20; // 衝突距離

      if (dist < minDist && dist > 0) {
        // 押し出し
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        // ダメージ判定: 前方からの衝突はダメージなし、側面・後方はダメージあり
        applyCollisionDamage(a, b, nx, ny);
        applyCollisionDamage(b, a, -nx, -ny);

        // 速度交換
        const relSpeed = Math.abs(a.speed - b.speed);
        a.speed *= 0.6;
        b.speed *= 0.6;
      }
    }
  }
}

function applyCollisionDamage(victim, attacker, nx, ny) {
  // victimから見た衝突方向の角度
  const hitAngle = Math.atan2(ny, nx);
  let relAngle = hitAngle - victim.angle;
  while (relAngle > Math.PI) relAngle -= Math.PI * 2;
  while (relAngle < -Math.PI) relAngle += Math.PI * 2;

  // 前方（±45度）からの衝突はダメージ無し
  if (Math.abs(relAngle) < Math.PI / 4) return;

  // ダメージ計算: 攻撃力 vs 耐久力
  const dmg = Math.max(1, attacker.attackPower - victim.durability * 0.3);
  const specialBonus = attacker.specialActive ? 2.5 : 1;
  victim.hp -= dmg * specialBonus;
  if (victim.hp < 0) victim.hp = 0;
}

// ========================================
// レースの初期化
// ========================================
function initRace() {
  const course = COURSES[selectedCourse];
  coursePoints = getCoursePoints(course, COURSE_RESOLUTION);
  cars = [];

  // スタート位置の計算
  const startPt = coursePoints[0];
  const nextPt = coursePoints[1];
  const startAngle = Math.atan2(nextPt.y - startPt.y, nextPt.x - startPt.x);
  const perpAngle = startAngle + Math.PI / 2;

  // 1P
  const p1 = createCar(selectedCar, true, 0);
  p1.x = startPt.x - Math.cos(startAngle) * 30;
  p1.y = startPt.y - Math.sin(startAngle) * 30;
  p1.angle = startAngle;
  cars.push(p1);

  // 2P（マルチの場合）
  if (gameMode === "multi") {
    const p2 = createCar(selectedCar2, true, 1);
    p2.x = startPt.x - Math.cos(startAngle) * 30 + Math.cos(perpAngle) * 25;
    p2.y = startPt.y - Math.sin(startAngle) * 30 + Math.sin(perpAngle) * 25;
    p2.angle = startAngle;
    cars.push(p2);
  }

  // AI車
  const usedIndices = [selectedCar];
  if (gameMode === "multi") usedIndices.push(selectedCar2);

  for (let i = 0; i < AI_COUNT; i++) {
    let aiIndex;
    do {
      aiIndex = Math.floor(Math.random() * CAR_DATA.length);
    } while (usedIndices.includes(aiIndex));
    usedIndices.push(aiIndex);

    const ai = createCar(aiIndex, false, -1);
    const row = Math.floor((i + (gameMode === "multi" ? 2 : 1)) / 3);
    const col = (i + (gameMode === "multi" ? 2 : 1)) % 3;
    ai.x = startPt.x - Math.cos(startAngle) * (50 + row * 35) + Math.cos(perpAngle) * (col - 1) * 25;
    ai.y = startPt.y - Math.sin(startAngle) * (50 + row * 35) + Math.sin(perpAngle) * (col - 1) * 25;
    ai.angle = startAngle;
    // AIの初期ウェイポイントを設定
    ai.aiTargetWP = 2;
    cars.push(ai);
  }

  raceTimer = 0;
  countdownTimer = 180; // 3秒カウントダウン
  gameState = "countdown";
}

// ========================================
// レース更新
// ========================================
function updateRace() {
  raceTimer++;

  // 1P操作
  updatePlayerCar(cars[0], "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "z");

  // 2P操作
  if (gameMode === "multi" && cars.length > 1 && cars[1].isPlayer) {
    updatePlayerCar(cars[1], "w", "s", "a", "d", "q");
  }

  // AI
  for (const c of cars) {
    if (!c.isPlayer) updateAICar(c);
  }

  // 衝突
  checkCollisions();

  // 全車ゴールチェック
  const allFinished = cars.every(c => c.finished || c.hp <= 0);
  if (allFinished || cars.filter(c => c.isPlayer).every(c => c.finished || c.hp <= 0)) {
    // 少し待ってからリザルトへ
    if (!cars._resultDelay) cars._resultDelay = 60;
    cars._resultDelay--;
    if (cars._resultDelay <= 0) {
      cars._resultDelay = undefined;
      gameState = "result";
    }
  }
}

// ========================================
// 順位計算
// ========================================
function getRankings() {
  return [...cars].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.hp <= 0 && b.hp > 0) return 1;
    if (a.hp > 0 && b.hp <= 0) return -1;
    // ラップとチェックポイントで比較
    if (a.lap !== b.lap) return b.lap - a.lap;
    return b.checkpoint - a.checkpoint;
  });
}

// ========================================
// 描画: タイトル画面
// ========================================
function drawTitle() {
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 背景装飾
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(255,200,0,${0.03 + Math.sin(raceTimer * 0.02 + i) * 0.02})`;
    ctx.fillRect(Math.sin(i * 1.7) * 300 + 400, Math.cos(i * 2.3) * 200 + 300, 60, 3);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff0";
  ctx.font = "bold 42px monospace";
  ctx.fillText("激突四駆RE", canvas.width / 2, 180);

  ctx.fillStyle = "#fff";
  ctx.font = "16px monospace";
  ctx.fillText("GEKITOTSU YONKU RE", canvas.width / 2, 220);

  ctx.fillStyle = "#aaa";
  ctx.font = "18px monospace";
  ctx.fillText("Press ENTER to Start", canvas.width / 2, 350);

  // ミニ四駆のサムネイルアニメーション
  const t = raceTimer * 0.01;
  for (let i = 0; i < 6; i++) {
    const idx = (Math.floor(t) + i) % CAR_DATA.length;
    const img = carImages[idx];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      const px = 130 + i * 110;
      ctx.drawImage(img, px, 420, img.naturalWidth * 2, img.naturalHeight * 2);
      ctx.imageSmoothingEnabled = true;
    }
  }

  ctx.textAlign = "start";
  raceTimer++;
}

// ========================================
// 描画: モード選択
// ========================================
let modeSelectIdx = 0;
function drawModeSelect() {
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px monospace";
  ctx.fillText("モード選択", canvas.width / 2, 120);

  const modes = [
    { label: "1人用グランプリ", desc: "6コースを連続で走るグランプリモード" },
    { label: "1人用フリーレース", desc: "好きなコースで1レース" },
    { label: "2人対戦", desc: "2人で対戦！（1P:矢印+Z  2P:WASD+Q）" },
  ];

  modes.forEach((m, i) => {
    const y = 220 + i * 90;
    if (i === modeSelectIdx) {
      ctx.fillStyle = "rgba(255,200,0,0.15)";
      ctx.fillRect(200, y - 25, 400, 65);
      ctx.fillStyle = "#ff0";
    } else {
      ctx.fillStyle = "#888";
    }
    ctx.font = "bold 20px monospace";
    ctx.fillText(m.label, canvas.width / 2, y);
    ctx.font = "13px monospace";
    ctx.fillStyle = i === modeSelectIdx ? "#ccc" : "#555";
    ctx.fillText(m.desc, canvas.width / 2, y + 25);
  });

  ctx.textAlign = "start";
}

// ========================================
// 描画: マシン選択
// ========================================
let selectingPlayer = 0; // 0=1P, 1=2P
function drawCarSelect() {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  const sel = selectingPlayer === 0 ? selectedCar : selectedCar2;
  const playerLabel = gameMode === "multi" ? `${selectingPlayer + 1}P マシン選択` : "マシン選択";

  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px monospace";
  ctx.fillText(playerLabel, canvas.width / 2, 40);

  // 選択中の車
  const img = carImages[sel];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    const dw = img.naturalWidth * 5;
    const dh = img.naturalHeight * 5;
    ctx.drawImage(img, canvas.width / 2 - dw / 2, 60, dw, dh);
    ctx.imageSmoothingEnabled = true;
  }

  // 車名
  ctx.fillStyle = "#ff0";
  ctx.font = "bold 16px monospace";
  ctx.fillText(CAR_DATA[sel].name, canvas.width / 2, 200);

  // パラメータバー
  const params = [
    { label: "スピード", val: CAR_DATA[sel].speed },
    { label: "加速",     val: CAR_DATA[sel].accel },
    { label: "ブレーキ", val: CAR_DATA[sel].brake },
    { label: "オフロード", val: CAR_DATA[sel].offroad },
    { label: "攻撃力",   val: CAR_DATA[sel].attack },
    { label: "耐久力",   val: CAR_DATA[sel].durability },
    { label: "ハンドル", val: CAR_DATA[sel].handling },
  ];

  ctx.textAlign = "right";
  params.forEach((p, i) => {
    const y = 230 + i * 22;
    ctx.fillStyle = "#aaa";
    ctx.font = "13px monospace";
    ctx.fillText(p.label, 340, y);
    // バー背景
    ctx.fillStyle = "#333";
    ctx.fillRect(350, y - 10, 120, 12);
    // バー
    ctx.fillStyle = p.val >= 8 ? "#f80" : p.val >= 5 ? "#0a0" : "#08a";
    ctx.fillRect(350, y - 10, 12 * p.val, 12);
  });

  // サムネイル一覧
  ctx.textAlign = "center";
  const thumbScale = 2;
  const cols = 13;
  const spacing = 28;
  const startX = canvas.width / 2 - (cols * spacing) / 2;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx >= CAR_DATA.length) break;
      const tx = startX + col * spacing + 6;
      const ty = 420 + row * 38;
      if (idx === sel) {
        ctx.strokeStyle = "#ff0";
        ctx.lineWidth = 2;
        ctx.strokeRect(tx - 3, ty - 3, 22, 28);
      }
      const tImg = carImages[idx];
      if (tImg && tImg.complete && tImg.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tImg, tx, ty, tImg.naturalWidth * thumbScale, tImg.naturalHeight * thumbScale);
        ctx.imageSmoothingEnabled = true;
      }
    }
  }

  ctx.fillStyle = "#888";
  ctx.font = "13px monospace";
  ctx.fillText("←→: 選択  Enter: 決定  ESC: 戻る", canvas.width / 2, 550);
  ctx.fillText(`${sel + 1} / ${CAR_DATA.length}`, canvas.width / 2, 570);
  ctx.textAlign = "start";
}

// ========================================
// 描画: コース選択
// ========================================
function drawCourseSelect() {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px monospace";
  ctx.fillText("コース選択", canvas.width / 2, 50);

  // コースプレビュー
  const course = COURSES[selectedCourse];
  const previewPts = getCoursePoints(course, 10);

  // ミニマップ描画
  ctx.save();
  ctx.translate(canvas.width / 2 - 150, 80);
  ctx.scale(0.5, 0.5);
  ctx.fillStyle = course.bgColor;
  ctx.fillRect(0, 0, 600, 450);
  const surfColors = { road: course.roadColor, offroad: "#a08050", ice: "#c8e0f0" };
  for (let i = 0; i < previewPts.length; i++) {
    const p1 = previewPts[i];
    const p2 = previewPts[(i + 1) % previewPts.length];
    ctx.strokeStyle = surfColors[p1.surface] || course.roadColor;
    ctx.lineWidth = course.roadWidth * 0.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.restore();

  // コース名と説明
  ctx.fillStyle = "#ff0";
  ctx.font = "bold 20px monospace";
  ctx.fillText(course.name, canvas.width / 2, 340);
  ctx.fillStyle = "#aaa";
  ctx.font = "14px monospace";
  ctx.fillText(course.description, canvas.width / 2, 365);
  ctx.fillText(`${TOTAL_LAPS}周`, canvas.width / 2, 390);

  // コース一覧
  ctx.fillStyle = "#666";
  ctx.font = "14px monospace";
  COURSES.forEach((c, i) => {
    const x = 80 + i * 110;
    const y = 450;
    if (i === selectedCourse) {
      ctx.fillStyle = "#ff0";
      ctx.strokeStyle = "#ff0";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 5, y - 15, 100, 30);
    } else {
      ctx.fillStyle = "#666";
    }
    ctx.fillText(`${i + 1}. ${c.name.slice(0, 6)}`, x, y);
  });

  ctx.fillStyle = "#888";
  ctx.font = "13px monospace";
  ctx.fillText("←→: 選択  Enter: 決定  ESC: 戻る", canvas.width / 2, 540);
  ctx.textAlign = "start";
}

// ========================================
// 描画: カウントダウン
// ========================================
function drawCountdown() {
  const course = COURSES[selectedCourse];
  drawCourse(course);
  cars.forEach(c => drawCar(c));

  const sec = Math.ceil(countdownTimer / 60);
  ctx.textAlign = "center";
  ctx.fillStyle = sec > 0 ? "#fff" : "#ff0";
  ctx.font = "bold 72px monospace";
  ctx.fillText(sec > 0 ? sec : "GO!", canvas.width / 2, canvas.height / 2 + 20);
  ctx.textAlign = "start";
}

// ========================================
// 描画: レース中UI
// ========================================
function drawRaceUI() {
  const course = COURSES[selectedCourse];
  drawCourse(course);

  // 車を順位順に（下位から描画して上位が上に）
  const rankings = getRankings();
  for (let i = rankings.length - 1; i >= 0; i--) {
    drawCar(rankings[i]);
  }

  // HUD
  const p1 = cars[0];
  const rank = rankings.indexOf(p1) + 1;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(5, 5, 180, 90);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px monospace";
  ctx.fillText(`LAP: ${Math.min(p1.lap + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`, 15, 22);
  ctx.fillText(`順位: ${rank}/${cars.length}`, 15, 40);
  ctx.fillStyle = p1.hp > MAX_HP * 0.5 ? "#0f0" : p1.hp > MAX_HP * 0.25 ? "#ff0" : "#f00";
  ctx.fillText(`HP: ${Math.ceil(p1.hp)}`, 15, 58);

  // スペシャルゲージ
  ctx.fillStyle = "#333";
  ctx.fillRect(15, 68, 100, 10);
  const spReady = p1.specialTimer <= 0;
  const spRatio = spReady ? 1 : 1 - p1.specialTimer / SPECIAL_COOLDOWN;
  ctx.fillStyle = spReady ? "#0ff" : "#066";
  ctx.fillRect(15, 68, 100 * spRatio, 10);
  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.fillText(spReady ? "SP: READY! [Z]" : "SP: charging...", 15, 88);

  // 2P HUD
  if (gameMode === "multi" && cars.length > 1 && cars[1].isPlayer) {
    const p2 = cars[1];
    const rank2 = rankings.indexOf(p2) + 1;
    const hx = canvas.width - 185;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(hx, 5, 180, 90);
    ctx.fillStyle = "#0af";
    ctx.font = "bold 14px monospace";
    ctx.fillText("2P", hx + 10, 22);
    ctx.fillStyle = "#fff";
    ctx.fillText(`LAP: ${Math.min(p2.lap + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`, hx + 35, 22);
    ctx.fillText(`順位: ${rank2}/${cars.length}`, hx + 10, 40);
    ctx.fillStyle = p2.hp > MAX_HP * 0.5 ? "#0f0" : p2.hp > MAX_HP * 0.25 ? "#ff0" : "#f00";
    ctx.fillText(`HP: ${Math.ceil(p2.hp)}`, hx + 10, 58);
    const sp2Ready = p2.specialTimer <= 0;
    const sp2Ratio = sp2Ready ? 1 : 1 - p2.specialTimer / SPECIAL_COOLDOWN;
    ctx.fillStyle = "#333";
    ctx.fillRect(hx + 10, 68, 100, 10);
    ctx.fillStyle = sp2Ready ? "#0ff" : "#066";
    ctx.fillRect(hx + 10, 68, 100 * sp2Ratio, 10);
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText(sp2Ready ? "SP: READY! [Q]" : "SP: charging...", hx + 10, 88);
  }

  // ミニマップ
  drawMinimap();
}

// ========================================
// ミニマップ
// ========================================
function drawMinimap() {
  const mx = canvas.width - 130;
  const my = canvas.height - 110;
  const mw = 120;
  const mh = 100;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(mx, my, mw, mh);

  // コースライン
  const scaleX = mw / canvas.width;
  const scaleY = mh / canvas.height;
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.beginPath();
  coursePoints.forEach((p, i) => {
    const px = mx + p.x * scaleX;
    const py = my + p.y * scaleY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.stroke();

  // 車の位置
  cars.forEach(c => {
    ctx.fillStyle = c.isPlayer ? (c.playerId === 0 ? "#f00" : "#0af") : "#ff0";
    ctx.fillRect(mx + c.x * scaleX - 2, my + c.y * scaleY - 2, 4, 4);
  });
}

// ========================================
// 描画: リザルト
// ========================================
function drawResult() {
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff0";
  ctx.font = "bold 30px monospace";
  ctx.fillText("RESULT", canvas.width / 2, 60);

  const rankings = getRankings();
  rankings.forEach((c, i) => {
    const y = 110 + i * 45;
    const img = carImages[c.dataIndex];

    // 順位色
    if (i === 0) ctx.fillStyle = "#ffd700";
    else if (i === 1) ctx.fillStyle = "#c0c0c0";
    else if (i === 2) ctx.fillStyle = "#cd7f32";
    else ctx.fillStyle = "#888";

    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${i + 1}位`, 120, y);

    // 車画像
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 180, y - 14, img.naturalWidth * 2, img.naturalHeight * 2);
      ctx.imageSmoothingEnabled = true;
    }

    ctx.fillText(CAR_DATA[c.dataIndex].name, 220, y);

    ctx.textAlign = "right";
    if (c.finished) {
      const time = (c.finishTime / 60).toFixed(1);
      ctx.fillText(`${time}s`, 650, y);
    } else if (c.hp <= 0) {
      ctx.fillStyle = "#f00";
      ctx.fillText("DESTROYED", 650, y);
    } else {
      ctx.fillText(`LAP ${c.lap}`, 650, y);
    }

    if (c.isPlayer) {
      ctx.fillStyle = c.playerId === 0 ? "#f44" : "#4af";
      ctx.fillText(c.playerId === 0 ? "1P" : "2P", 100, y);
    }
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#aaa";
  ctx.font = "14px monospace";
  ctx.fillText("Enter: 次へ  ESC: タイトルへ", canvas.width / 2, 560);
  ctx.textAlign = "start";
}

// ========================================
// 描画: グランプリ総合結果
// ========================================
function drawGrandPrixResult() {
  ctx.fillStyle = "rgba(0,0,10,0.95)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff0";
  ctx.font = "bold 28px monospace";
  ctx.fillText("グランプリ総合結果", canvas.width / 2, 50);

  // 各レースの順位からポイント計算
  const pointTable = [10, 7, 5, 4, 3, 2, 1];
  const totals = {};

  gpResults.forEach((raceRanking, raceIdx) => {
    raceRanking.forEach((c, rank) => {
      const key = c.dataIndex;
      if (!totals[key]) totals[key] = { dataIndex: c.dataIndex, points: 0, isPlayer: c.isPlayer, playerId: c.playerId };
      totals[key].points += pointTable[rank] || 1;
    });
  });

  const sorted = Object.values(totals).sort((a, b) => b.points - a.points);

  ctx.textAlign = "left";
  sorted.slice(0, 8).forEach((entry, i) => {
    const y = 100 + i * 42;
    if (i === 0) ctx.fillStyle = "#ffd700";
    else if (i === 1) ctx.fillStyle = "#c0c0c0";
    else if (i === 2) ctx.fillStyle = "#cd7f32";
    else ctx.fillStyle = "#888";

    ctx.font = "bold 18px monospace";
    ctx.fillText(`${i + 1}位`, 120, y);

    const img = carImages[entry.dataIndex];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 180, y - 14, img.naturalWidth * 2, img.naturalHeight * 2);
      ctx.imageSmoothingEnabled = true;
    }

    ctx.fillText(CAR_DATA[entry.dataIndex].name, 220, y);
    ctx.textAlign = "right";
    ctx.fillText(`${entry.points}pts`, 650, y);
    if (entry.isPlayer) {
      ctx.fillStyle = "#f44";
      ctx.fillText("1P", 100, y);
    }
    ctx.textAlign = "left";
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#aaa";
  ctx.font = "14px monospace";
  ctx.fillText("Enter: タイトルへ", canvas.width / 2, 560);
  ctx.textAlign = "start";
}

// ========================================
// 入力処理
// ========================================
let keyLock = {};
function onKeyOnce(key) {
  if (keys[key] && !keyLock[key]) {
    keyLock[key] = true;
    return true;
  }
  if (!keys[key]) keyLock[key] = false;
  return false;
}

function handleInput() {
  switch (gameState) {
    case "title":
      if (onKeyOnce("Enter")) {
        gameState = "modeSelect";
        modeSelectIdx = 0;
        raceTimer = 0;
      }
      break;

    case "modeSelect":
      if (onKeyOnce("ArrowUp")) modeSelectIdx = (modeSelectIdx - 1 + 3) % 3;
      if (onKeyOnce("ArrowDown")) modeSelectIdx = (modeSelectIdx + 1) % 3;
      if (onKeyOnce("Enter")) {
        if (modeSelectIdx === 0) { gameMode = "single"; gpResults = []; currentGPCourse = 0; }
        else if (modeSelectIdx === 1) { gameMode = "single"; }
        else { gameMode = "multi"; }
        selectingPlayer = 0;
        gameState = "carSelect";
      }
      if (onKeyOnce("Escape")) gameState = "title";
      break;

    case "carSelect": {
      const isSel2P = selectingPlayer === 1;
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
            // グランプリ: コース選択なし、自動で進む
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
          // グランプリモード
          gpResults.push(getRankings());
          currentGPCourse++;
          if (currentGPCourse >= COURSES.length) {
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
    case "title":       drawTitle(); break;
    case "modeSelect":  drawModeSelect(); break;
    case "carSelect":   drawCarSelect(); break;
    case "courseSelect": drawCourseSelect(); break;
    case "countdown":   drawCountdown(); break;
    case "race":        updateRace(); drawRaceUI(); break;
    case "result":      drawResult(); break;
    case "grandprixResult": drawGrandPrixResult(); break;
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
