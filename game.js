// 激突四駆RE - トップダウンレースゲーム

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// --- 車リスト ---
const carList = [
  "cars/01_BATLE BOOMERANG.png",
  "cars/02_BATTLE FOX.png",
  "cars/03_BATTLE FALCON.png",
  "cars/04_BATTLE SUPER SABRE.png",
  "cars/05_BATTLE THUNDER SHOT.png",
  "cars/06_BATTLE SUPER DRAGON.png",
  "cars/07_BATTLE FIRE DRAGON.png",
  "cars/08_BATTLE THUNDER DRAGON.png",
  "cars/09_BATTLE EMPEROR.png",
  "cars/10_BATTLE BURNING SUN.png",
  "cars/11_BATTLE SHOOTING STAR.png",
  "cars/12_BATTLE CANNON BALL.png",
  "cars/13_BATTLE DANCING DALL.png",
  "cars/14_BATTLE DRAGON SP1.png",
  "cars/15_BATTLE DRAGON SP2.png",
  "cars/16_BATTLE DRAGON SP3.png",
  "cars/17_BATTLE THUNDER SP.png",
  "cars/18_BATTLE AVANTE SP.png",
  "cars/19_BATTLE HOT SHOT.png",
  "cars/20_BATTLE HORNET.png",
  "cars/21_BATTLE BIG WIG.png",
  "cars/22_BATTLE GRASS HOPPER II.png",
  "cars/23_BATTLE RISING BIRD.png",
  "cars/24_BATTLE VANQUISH.png",
  "cars/25_BATTLE SAINT DRAGON.png",
  "cars/26_BATTLE SCORCHER.png",
];

// --- 画像読み込み ---
const carImages = [];
let imagesLoaded = 0;
let selectedCar = 0;
let gameState = "select"; // "select" or "race"

carList.forEach((src, i) => {
  const img = new Image();
  img.src = src;
  img.onload = () => { imagesLoaded++; };
  carImages.push(img);
});

// --- 車の状態 ---
const car = {
  x: 400,
  y: 420,
  scale: 3, // ドット絵を3倍に拡大
  angle: -Math.PI / 2,
  speed: 0,
  maxSpeed: 5,
  acceleration: 0.15,
  braking: 0.1,
  friction: 0.03,
  turnSpeed: 0.04,
};

// --- キー入力管理 ---
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;

  if (gameState === "select") {
    if (e.key === "ArrowRight" || e.key === "d") {
      selectedCar = (selectedCar + 1) % carList.length;
    }
    if (e.key === "ArrowLeft" || e.key === "a") {
      selectedCar = (selectedCar - 1 + carList.length) % carList.length;
    }
    if (e.key === "Enter" || e.key === " ") {
      gameState = "race";
      car.x = 400;
      car.y = 420;
      car.angle = -Math.PI / 2;
      car.speed = 0;
    }
  }
});
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

// --- 車名を取得 ---
function getCarName(index) {
  const filename = carList[index].split("/")[1].replace(".png", "");
  return filename.replace(/^\d+_/, "");
}

// --- 選択画面描画 ---
function drawSelectScreen() {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.fillText("激突四駆RE - マシン選択", canvas.width / 2, 60);

  ctx.font = "14px monospace";
  ctx.fillStyle = "#aaa";
  ctx.fillText("←→: 選択  Enter/Space: 決定", canvas.width / 2, 90);

  // 選択中の車を大きく表示
  const img = carImages[selectedCar];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    const dispW = img.naturalWidth * 6;
    const dispH = img.naturalHeight * 6;
    ctx.drawImage(img, canvas.width / 2 - dispW / 2, 150, dispW, dispH);
    ctx.imageSmoothingEnabled = true;
  }

  // 車名
  ctx.fillStyle = "#ff0";
  ctx.font = "bold 18px monospace";
  ctx.fillText(getCarName(selectedCar), canvas.width / 2, 330);
  ctx.fillStyle = "#888";
  ctx.font = "14px monospace";
  ctx.fillText(`${selectedCar + 1} / ${carList.length}`, canvas.width / 2, 355);

  // サムネイル一覧
  const thumbScale = 2;
  const thumbSpacing = 30;
  const startX = canvas.width / 2 - (Math.min(carList.length, 13) * thumbSpacing) / 2;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 13; col++) {
      const i = row * 13 + col;
      if (i >= carList.length) break;
      const tImg = carImages[i];
      const tx = startX + col * thumbSpacing;
      const ty = 400 + row * 40;
      if (i === selectedCar) {
        ctx.strokeStyle = "#ff0";
        ctx.lineWidth = 2;
        ctx.strokeRect(tx - 2, ty - 2, 24, 28);
      }
      if (tImg && tImg.complete && tImg.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tImg, tx, ty, tImg.naturalWidth * thumbScale, tImg.naturalHeight * thumbScale);
        ctx.imageSmoothingEnabled = true;
      }
    }
  }

  ctx.textAlign = "start";
}

// --- 更新処理 ---
function update() {
  if (gameState !== "race") return;

  if (keys["ArrowUp"] || keys["w"]) {
    car.speed = Math.min(car.speed + car.acceleration, car.maxSpeed);
  } else if (keys["ArrowDown"] || keys["s"]) {
    car.speed = Math.max(car.speed - car.braking, -car.maxSpeed * 0.4);
  } else {
    if (car.speed > 0) car.speed = Math.max(car.speed - car.friction, 0);
    if (car.speed < 0) car.speed = Math.min(car.speed + car.friction, 0);
  }

  if (Math.abs(car.speed) > 0.1) {
    const turnFactor = car.speed > 0 ? 1 : -1;
    if (keys["ArrowLeft"] || keys["a"]) {
      car.angle -= car.turnSpeed * turnFactor;
    }
    if (keys["ArrowRight"] || keys["d"]) {
      car.angle += car.turnSpeed * turnFactor;
    }
  }

  car.x += Math.cos(car.angle) * car.speed;
  car.y += Math.sin(car.angle) * car.speed;

  if (car.x < 0) car.x = canvas.width;
  if (car.x > canvas.width) car.x = 0;
  if (car.y < 0) car.y = canvas.height;
  if (car.y > canvas.height) car.y = 0;
}

// --- レース画面描画 ---
function drawRace() {
  // 背景
  ctx.fillStyle = "#3a7d3a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // コース
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 80;
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, 300, 200, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 中央線
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, 300, 200, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 車を描画
  const img = carImages[selectedCar];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle + Math.PI / 2);
  ctx.imageSmoothingEnabled = false;

  if (img && img.complete && img.naturalWidth > 0) {
    const w = img.naturalWidth * car.scale;
    const h = img.naturalHeight * car.scale;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = "#e33";
    ctx.fillRect(-15, -20, 30, 40);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.restore();

  // UI
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(10, 10, 240, 50);
  ctx.fillStyle = "#fff";
  ctx.font = "14px monospace";
  ctx.fillText("↑↓: 加減速  ←→: 操舵  ESC: 選択へ", 20, 30);
  ctx.fillStyle = "#ff0";
  ctx.fillText(getCarName(selectedCar), 20, 48);
}

// ESCで選択画面に戻る
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && gameState === "race") {
    gameState = "select";
    car.speed = 0;
  }
});

// --- ゲームループ ---
function gameLoop() {
  update();
  if (gameState === "select") {
    drawSelectScreen();
  } else {
    drawRace();
  }
  requestAnimationFrame(gameLoop);
}

gameLoop();
