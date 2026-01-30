// courses.js - コース定義（6ステージ）
// コースはウェイポイント（制御点）の連結で定義し、道路幅・路面タイプを持つ
// surfaceType: "road"(舗装), "offroad"(未舗装), "ice"(氷)

const COURSES = [
  {
    id: 0,
    name: "オーバルサーキット",
    description: "基本の楕円コース。初心者向け。",
    bgColor: "#3a7d3a",
    roadColor: "#666",
    roadWidth: 70,
    laps: 5,
    // ウェイポイント: {x, y, surface}
    waypoints: [
      { x: 400, y: 120, surface: "road" },
      { x: 620, y: 160, surface: "road" },
      { x: 720, y: 300, surface: "road" },
      { x: 620, y: 440, surface: "road" },
      { x: 400, y: 480, surface: "road" },
      { x: 180, y: 440, surface: "road" },
      { x: 80,  y: 300, surface: "road" },
      { x: 180, y: 160, surface: "road" },
    ],
  },
  {
    id: 1,
    name: "テクニカルサーキット",
    description: "S字やヘアピンが連続するテクニカルコース。",
    bgColor: "#3a7d3a",
    roadColor: "#555",
    roadWidth: 65,
    laps: 5,
    waypoints: [
      { x: 400, y: 80,  surface: "road" },
      { x: 600, y: 100, surface: "road" },
      { x: 720, y: 200, surface: "road" },
      { x: 650, y: 320, surface: "road" },
      { x: 500, y: 280, surface: "road" },
      { x: 350, y: 350, surface: "road" },
      { x: 200, y: 450, surface: "road" },
      { x: 100, y: 380, surface: "road" },
      { x: 120, y: 220, surface: "road" },
      { x: 250, y: 130, surface: "road" },
    ],
  },
  {
    id: 2,
    name: "ダートクロス",
    description: "全面オフロード。グリップの低い荒れた路面。",
    bgColor: "#8B7355",
    roadColor: "#a0855a",
    roadWidth: 75,
    laps: 5,
    waypoints: [
      { x: 400, y: 100, surface: "offroad" },
      { x: 650, y: 150, surface: "offroad" },
      { x: 700, y: 350, surface: "offroad" },
      { x: 550, y: 480, surface: "offroad" },
      { x: 300, y: 500, surface: "offroad" },
      { x: 100, y: 400, surface: "offroad" },
      { x: 80,  y: 200, surface: "offroad" },
      { x: 200, y: 100, surface: "offroad" },
    ],
  },
  {
    id: 3,
    name: "アイスレイク",
    description: "凍った湖の上のコース。滑りやすい！",
    bgColor: "#b8d4e3",
    roadColor: "#d0e8f5",
    roadWidth: 80,
    laps: 5,
    waypoints: [
      { x: 400, y: 100, surface: "ice" },
      { x: 650, y: 180, surface: "ice" },
      { x: 680, y: 400, surface: "ice" },
      { x: 450, y: 500, surface: "ice" },
      { x: 200, y: 480, surface: "ice" },
      { x: 100, y: 300, surface: "ice" },
      { x: 150, y: 140, surface: "ice" },
    ],
  },
  {
    id: 4,
    name: "ミックスラリー",
    description: "舗装・ダート・氷が混在するコース。",
    bgColor: "#4a6b3a",
    roadColor: "#666",
    roadWidth: 65,
    laps: 5,
    waypoints: [
      { x: 400, y: 80,  surface: "road" },
      { x: 650, y: 120, surface: "road" },
      { x: 730, y: 280, surface: "offroad" },
      { x: 680, y: 450, surface: "offroad" },
      { x: 500, y: 520, surface: "ice" },
      { x: 300, y: 500, surface: "ice" },
      { x: 120, y: 400, surface: "offroad" },
      { x: 80,  y: 230, surface: "road" },
      { x: 200, y: 110, surface: "road" },
    ],
  },
  {
    id: 5,
    name: "グランプリファイナル",
    description: "全要素が詰まった最終決戦コース！",
    bgColor: "#2a4a2a",
    roadColor: "#555",
    roadWidth: 60,
    laps: 5,
    waypoints: [
      { x: 400, y: 70,  surface: "road" },
      { x: 600, y: 80,  surface: "road" },
      { x: 730, y: 170, surface: "ice" },
      { x: 720, y: 320, surface: "ice" },
      { x: 620, y: 420, surface: "offroad" },
      { x: 480, y: 350, surface: "road" },
      { x: 380, y: 450, surface: "offroad" },
      { x: 220, y: 520, surface: "offroad" },
      { x: 100, y: 430, surface: "ice" },
      { x: 80,  y: 280, surface: "road" },
      { x: 130, y: 150, surface: "road" },
      { x: 250, y: 90,  surface: "road" },
    ],
  },
];

// コースのウェイポイント間をスムーズに補間するユーティリティ
function getCoursePoints(course, resolution) {
  const wp = course.waypoints;
  const points = [];
  const n = wp.length;
  for (let i = 0; i < n; i++) {
    const p0 = wp[(i - 1 + n) % n];
    const p1 = wp[i];
    const p2 = wp[(i + 1) % n];
    const p3 = wp[(i + 2) % n];
    for (let t = 0; t < resolution; t++) {
      const f = t / resolution;
      // Catmull-Rom spline
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * f + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f * f + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f * f * f);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * f + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f * f + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f * f * f);
      points.push({ x, y, surface: p1.surface });
    }
  }
  return points;
}
