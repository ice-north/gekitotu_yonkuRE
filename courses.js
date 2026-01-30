// courses.js - コース定義（6ステージ）
// 画面サイズ: 1200x900
// surfaceType: "road"(舗装), "offroad"(未舗装), "ice"(氷)

const COURSES = [
  {
    id: 0,
    name: "OVAL CIRCUIT",
    description: "基本の楕円コース。初心者向け。",
    bgColor: "#2d5a1e",
    roadColor: "#707070",
    wallColor: "#c03030",
    roadWidth: 100,
    laps: 5,
    waypoints: [
      { x: 600, y: 160, surface: "road" },
      { x: 930, y: 220, surface: "road" },
      { x: 1060, y: 450, surface: "road" },
      { x: 930, y: 680, surface: "road" },
      { x: 600, y: 740, surface: "road" },
      { x: 270, y: 680, surface: "road" },
      { x: 120, y: 450, surface: "road" },
      { x: 270, y: 220, surface: "road" },
    ],
  },
  {
    id: 1,
    name: "TECHNICAL GP",
    description: "S字やヘアピンが連続するテクニカルコース。",
    bgColor: "#2d5a1e",
    roadColor: "#606060",
    wallColor: "#c03030",
    roadWidth: 90,
    laps: 5,
    waypoints: [
      { x: 600, y: 100, surface: "road" },
      { x: 900, y: 130, surface: "road" },
      { x: 1080, y: 280, surface: "road" },
      { x: 970, y: 460, surface: "road" },
      { x: 750, y: 400, surface: "road" },
      { x: 520, y: 500, surface: "road" },
      { x: 300, y: 660, surface: "road" },
      { x: 150, y: 560, surface: "road" },
      { x: 180, y: 320, surface: "road" },
      { x: 380, y: 180, surface: "road" },
    ],
  },
  {
    id: 2,
    name: "DIRT CROSS",
    description: "全面オフロード。グリップの低い荒れた路面。",
    bgColor: "#6b5535",
    roadColor: "#9a7d50",
    wallColor: "#8b6030",
    roadWidth: 110,
    laps: 5,
    waypoints: [
      { x: 600, y: 130, surface: "offroad" },
      { x: 970, y: 200, surface: "offroad" },
      { x: 1050, y: 500, surface: "offroad" },
      { x: 820, y: 720, surface: "offroad" },
      { x: 450, y: 750, surface: "offroad" },
      { x: 150, y: 600, surface: "offroad" },
      { x: 120, y: 300, surface: "offroad" },
      { x: 300, y: 130, surface: "offroad" },
    ],
  },
  {
    id: 3,
    name: "ICE LAKE",
    description: "凍った湖の上のコース。滑りやすい！",
    bgColor: "#90b8d0",
    roadColor: "#c0dae8",
    wallColor: "#4080b0",
    roadWidth: 115,
    laps: 5,
    waypoints: [
      { x: 600, y: 130, surface: "ice" },
      { x: 970, y: 250, surface: "ice" },
      { x: 1020, y: 580, surface: "ice" },
      { x: 680, y: 750, surface: "ice" },
      { x: 300, y: 710, surface: "ice" },
      { x: 150, y: 440, surface: "ice" },
      { x: 230, y: 190, surface: "ice" },
    ],
  },
  {
    id: 4,
    name: "MIX RALLY",
    description: "舗装・ダート・氷が混在するコース。",
    bgColor: "#3a5a2a",
    roadColor: "#686868",
    wallColor: "#c03030",
    roadWidth: 95,
    laps: 5,
    waypoints: [
      { x: 600, y: 100, surface: "road" },
      { x: 970, y: 160, surface: "road" },
      { x: 1090, y: 400, surface: "offroad" },
      { x: 1020, y: 660, surface: "offroad" },
      { x: 750, y: 780, surface: "ice" },
      { x: 450, y: 750, surface: "ice" },
      { x: 180, y: 600, surface: "offroad" },
      { x: 120, y: 340, surface: "road" },
      { x: 300, y: 150, surface: "road" },
    ],
  },
  {
    id: 5,
    name: "FINAL GP",
    description: "全要素が詰まった最終決戦コース！",
    bgColor: "#1e3a1e",
    roadColor: "#585858",
    wallColor: "#d02020",
    roadWidth: 85,
    laps: 5,
    waypoints: [
      { x: 600, y: 90,  surface: "road" },
      { x: 900, y: 100, surface: "road" },
      { x: 1090, y: 240, surface: "ice" },
      { x: 1080, y: 460, surface: "ice" },
      { x: 930, y: 620, surface: "offroad" },
      { x: 720, y: 510, surface: "road" },
      { x: 570, y: 660, surface: "offroad" },
      { x: 330, y: 780, surface: "offroad" },
      { x: 150, y: 640, surface: "ice" },
      { x: 120, y: 400, surface: "road" },
      { x: 200, y: 210, surface: "road" },
      { x: 380, y: 120, surface: "road" },
    ],
  },
];

// Catmull-Rom spline補間
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
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * f + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f * f + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f * f * f);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * f + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f * f + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f * f * f);
      points.push({ x, y, surface: p1.surface });
    }
  }
  return points;
}
