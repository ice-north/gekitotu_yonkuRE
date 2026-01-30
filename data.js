// data.js - マシンデータ定義
// パラメータ: speed(最高速), accel(加速), brake(ブレーキ), offroad(オフロード適性), attack(攻撃力), durability(耐久力), handling(ハンドリング)
// 各値は1〜10

const CAR_DATA = [
  { id: 0,  name: "BATLE BOOMERANG",     img: "cars/01_BATLE BOOMERANG.png",        speed: 6,  accel: 7,  brake: 5, offroad: 4, attack: 5, durability: 5, handling: 7 },
  { id: 1,  name: "BATTLE FOX",          img: "cars/02_BATTLE FOX.png",             speed: 7,  accel: 6,  brake: 5, offroad: 5, attack: 4, durability: 5, handling: 8 },
  { id: 2,  name: "BATTLE FALCON",       img: "cars/03_BATTLE FALCON.png",          speed: 8,  accel: 5,  brake: 5, offroad: 3, attack: 4, durability: 4, handling: 6 },
  { id: 3,  name: "BATTLE SUPER SABRE",  img: "cars/04_BATTLE SUPER SABRE.png",     speed: 9,  accel: 4,  brake: 4, offroad: 3, attack: 3, durability: 4, handling: 5 },
  { id: 4,  name: "BATTLE THUNDER SHOT", img: "cars/05_BATTLE THUNDER SHOT.png",    speed: 7,  accel: 7,  brake: 6, offroad: 5, attack: 6, durability: 5, handling: 6 },
  { id: 5,  name: "BATTLE SUPER DRAGON", img: "cars/06_BATTLE SUPER DRAGON.png",    speed: 6,  accel: 6,  brake: 5, offroad: 7, attack: 7, durability: 7, handling: 5 },
  { id: 6,  name: "BATTLE FIRE DRAGON",  img: "cars/07_BATTLE FIRE DRAGON.png",     speed: 7,  accel: 5,  brake: 5, offroad: 6, attack: 8, durability: 6, handling: 5 },
  { id: 7,  name: "BATTLE THUNDER DRAGON",img:"cars/08_BATTLE THUNDER DRAGON.png",  speed: 7,  accel: 6,  brake: 5, offroad: 6, attack: 7, durability: 7, handling: 5 },
  { id: 8,  name: "BATTLE EMPEROR",      img: "cars/09_BATTLE EMPEROR.png",         speed: 8,  accel: 5,  brake: 6, offroad: 5, attack: 6, durability: 8, handling: 6 },
  { id: 9,  name: "BATTLE BURNING SUN",  img: "cars/10_BATTLE BURNING SUN.png",     speed: 8,  accel: 6,  brake: 5, offroad: 4, attack: 7, durability: 5, handling: 5 },
  { id: 10, name: "BATTLE SHOOTING STAR",img: "cars/11_BATTLE SHOOTING STAR.png",   speed: 9,  accel: 7,  brake: 4, offroad: 3, attack: 4, durability: 3, handling: 6 },
  { id: 11, name: "BATTLE CANNON BALL",  img: "cars/12_BATTLE CANNON BALL.png",     speed: 5,  accel: 5,  brake: 7, offroad: 8, attack: 9, durability: 9, handling: 4 },
  { id: 12, name: "BATTLE DANCING DALL", img: "cars/13_BATTLE DANCING DALL.png",    speed: 6,  accel: 8,  brake: 6, offroad: 5, attack: 5, durability: 5, handling: 9 },
  { id: 13, name: "BATTLE DRAGON SP1",   img: "cars/14_BATTLE DRAGON SP1.png",      speed: 7,  accel: 6,  brake: 6, offroad: 6, attack: 7, durability: 6, handling: 6 },
  { id: 14, name: "BATTLE DRAGON SP2",   img: "cars/15_BATTLE DRAGON SP2.png",      speed: 8,  accel: 6,  brake: 5, offroad: 6, attack: 7, durability: 6, handling: 5 },
  { id: 15, name: "BATTLE DRAGON SP3",   img: "cars/16_BATTLE DRAGON SP3.png",      speed: 8,  accel: 7,  brake: 5, offroad: 5, attack: 8, durability: 5, handling: 5 },
  { id: 16, name: "BATTLE THUNDER SP",   img: "cars/17_BATTLE THUNDER SP.png",      speed: 8,  accel: 7,  brake: 6, offroad: 5, attack: 6, durability: 6, handling: 6 },
  { id: 17, name: "BATTLE AVANTE SP",    img: "cars/18_BATTLE AVANTE SP.png",       speed: 9,  accel: 6,  brake: 5, offroad: 4, attack: 5, durability: 5, handling: 7 },
  { id: 18, name: "BATTLE HOT SHOT",     img: "cars/19_BATTLE HOT SHOT.png",        speed: 7,  accel: 8,  brake: 6, offroad: 5, attack: 6, durability: 5, handling: 7 },
  { id: 19, name: "BATTLE HORNET",       img: "cars/20_BATTLE HORNET.png",          speed: 6,  accel: 9,  brake: 6, offroad: 5, attack: 5, durability: 5, handling: 8 },
  { id: 20, name: "BATTLE BIG WIG",      img: "cars/21_BATTLE BIG WIG.png",         speed: 5,  accel: 5,  brake: 6, offroad: 7, attack: 8, durability: 9, handling: 4 },
  { id: 21, name: "BATTLE GRASS HOPPER II",img:"cars/22_BATTLE GRASS HOPPER II.png",speed: 6,  accel: 7,  brake: 5, offroad: 9, attack: 5, durability: 6, handling: 7 },
  { id: 22, name: "BATTLE RISING BIRD",  img: "cars/23_BATTLE RISING BIRD.png",     speed: 8,  accel: 6,  brake: 5, offroad: 4, attack: 5, durability: 5, handling: 8 },
  { id: 23, name: "BATTLE VANQUISH",     img: "cars/24_BATTLE VANQUISH.png",        speed: 9,  accel: 5,  brake: 5, offroad: 3, attack: 6, durability: 6, handling: 6 },
  { id: 24, name: "BATTLE SAINT DRAGON", img: "cars/25_BATTLE SAINT DRAGON.png",    speed: 7,  accel: 6,  brake: 6, offroad: 6, attack: 7, durability: 8, handling: 6 },
  { id: 25, name: "BATTLE SCORCHER",     img: "cars/26_BATTLE SCORCHER.png",        speed: 8,  accel: 7,  brake: 5, offroad: 5, attack: 6, durability: 5, handling: 7 },
];
