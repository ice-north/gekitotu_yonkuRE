// 激突四駆RE - トップダウンレースゲーム

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// --- 車の画像読み込み ---
const carImage = new Image();
carImage.src = "car.png"; // 車のPNG画像（差し替え可能）
let imageLoaded = false;
carImage.onload = () => { imageLoaded = true; };

// --- 車の状態 ---
const car = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  width: 40,
  height: 60,
  angle: -Math.PI / 2, // 上向きスタート
  speed: 0,
  maxSpeed: 5,
  acceleration: 0.15,
  braking: 0.1,
  friction: 0.03,
  turnSpeed: 0.04,
};

// --- キー入力管理 ---
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.key] = true; });
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

// --- 更新処理 ---
function update() {
  // アクセル / ブレーキ
  if (keys["ArrowUp"] || keys["w"]) {
    car.speed = Math.min(car.speed + car.acceleration, car.maxSpeed);
  } else if (keys["ArrowDown"] || keys["s"]) {
    car.speed = Math.max(car.speed - car.braking, -car.maxSpeed * 0.4);
  } else {
    // 摩擦で減速
    if (car.speed > 0) car.speed = Math.max(car.speed - car.friction, 0);
    if (car.speed < 0) car.speed = Math.min(car.speed + car.friction, 0);
  }

  // ステアリング（速度に応じて曲がる）
  if (Math.abs(car.speed) > 0.1) {
    const turnFactor = car.speed > 0 ? 1 : -1;
    if (keys["ArrowLeft"] || keys["a"]) {
      car.angle -= car.turnSpeed * turnFactor;
    }
    if (keys["ArrowRight"] || keys["d"]) {
      car.angle += car.turnSpeed * turnFactor;
    }
  }

  // 位置更新
  car.x += Math.cos(car.angle) * car.speed;
  car.y += Math.sin(car.angle) * car.speed;

  // 画面端で折り返し
  if (car.x < 0) car.x = canvas.width;
  if (car.x > canvas.width) car.x = 0;
  if (car.y < 0) car.y = canvas.height;
  if (car.y > canvas.height) car.y = 0;
}

// --- 描画処理 ---
function draw() {
  // 背景（コースっぽい緑地）
  ctx.fillStyle = "#3a7d3a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 簡易コース（灰色の道路）
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 80;
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, 300, 200, 0, 0, Math.PI * 2);
  ctx.stroke();

  // コース中央線
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, 300, 200, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 車を描画
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle + Math.PI / 2); // PNGは上向き前提なので補正

  if (imageLoaded) {
    ctx.drawImage(
      carImage,
      -car.width / 2,
      -car.height / 2,
      car.width,
      car.height
    );
  } else {
    // PNG未読み込み時のフォールバック描画
    ctx.fillStyle = "#e33";
    ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
    // フロント部分（前方を示す）
    ctx.fillStyle = "#ff0";
    ctx.fillRect(-car.width / 4, -car.height / 2, car.width / 2, 8);
  }

  ctx.restore();

  // 操作説明
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(10, 10, 220, 70);
  ctx.fillStyle = "#fff";
  ctx.font = "14px monospace";
  ctx.fillText("↑/W: アクセル", 20, 30);
  ctx.fillText("↓/S: ブレーキ/バック", 20, 48);
  ctx.fillText("←→/A,D: ステアリング", 20, 66);
}

// --- ゲームループ ---
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
