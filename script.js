/* ============================================================
   XIAODOU 个人主页复刻 — 交互脚本
   ============================================================ */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- 0. 舞台等比缩放：所有卡片完整居中显示于视口 ---------------- */
  const stage = document.querySelector('.stage');
  const STAGE_SCALE = 0.9;   // 整体缩放系数：想让整页再大/小一点，只改这一个数
  /* 注：曾试过改用 zoom 代替 transform: scale 来提升文字锐度——不行。
     zoom 会改变 getBoundingClientRect() 的返回值，而 fitStage 正是靠它测量包围盒，
     设置一次 zoom 后二次测量就拿到被缩过的尺寸，s 越算越小、舞台整体跑偏。
     维持 transform 方案。 */
  function fitStage() {
    if (!stage) return;
    if (window.matchMedia('(max-width: 640px)').matches) {
      stage.style.transform = 'none';
      return;
    }
    // 先以原始尺寸测量全部卡片（含导航卡 -60、横幅卡 -45 等出界坐标）的包围盒
    stage.style.transform = 'none';
    let minX = Infinity, minY = Infinity, maxR = -Infinity, maxB = -Infinity;
    for (const el of stage.querySelectorAll('.card, .btn-write')) {
      const r = el.getBoundingClientRect();
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxR = Math.max(maxR, r.right);
      maxB = Math.max(maxB, r.bottom);
    }
    const w = maxR - minX;
    const h = maxB - minY;
    const s = Math.min(innerWidth / w, innerHeight / h, 1) * STAGE_SCALE;
    // 舞台原点固定在左上角(0,0)，包围盒中心 = 视口中心：
    // 平移量 = 视口中心 - 包围盒中心 * s（纯像素，无百分比/calc 兼容问题）
    const tx = innerWidth / 2 - (minX + w / 2) * s;
    const ty = innerHeight / 2 - (minY + h / 2) * s;
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }
  window.addEventListener('resize', fitStage);
  fitStage();
  /* 补两次重算（很关键）：
     首帧量包围盒时，网页字体（Averia 走 CDN）和图片往往还没到，
     此时文字宽度/卡片高度都还没稳定，算出来的 scale 和居中偏移就是错的，
     而且 resize 之前不会再校。所以等「字体就绪」和「整页加载完」各再量一次。 */
  window.addEventListener('load', fitStage);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitStage);
  }

  /* ---------------- 1. 背景粒子画布（模糊色块 + 微尘） ----------------
     ⚠️ 性能红线（真机掉帧严重查出来的根因）：
     这一版曾经每帧全屏重绘 + CSS filter: blur(50px)。每帧的代价是
     「CPU 重绘全屏画布 → 整块纹理上传 GPU → 对整个视口跑 3 个 pass 的 50px 模糊」，
     60fps 跑下来中端核显直接见底 —— 整页都掉帧，最显眼的就是光标跟手性变差。
     所以三条铁律：
       1. 不许挂 CSS filter —— 柔边直接画进色块（径向渐变），一次成型零后处理；
       2. 画布按 1 倍分辨率跑（色块本来就是糊的，高分栅格纯属浪费，还省 4 倍纹理上传）；
       3. 重绘限到 30fps —— 色块每帧只挪 0.2px，60 和 30 肉眼无差，GPU 预算砍一半。 */
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  const blobs = [];
  const dust = [];
  const THEME = [
    [47, 203, 231],
    [238, 194, 94],
    [255, 255, 255],
    [150, 206, 240],
    [186, 160, 240],
    [244, 170, 196],
    [110, 216, 186],
  ];

  function sizeCanvas() {
    // 刻意不乘 devicePixelRatio：色块是超软的渐变，1 倍栅格足够，纹理上传量省 4~8 倍
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  sizeCanvas();

  function initParticles() {
    blobs.length = 0;
    dust.length = 0;
    const n = Math.max(9, Math.floor(window.innerWidth / 170));
    for (let i = 0; i < n; i++) {
      const cc = THEME[i % THEME.length];
      blobs.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 70 + Math.random() * 140,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.18,
        cr: cc[0], cg: cc[1], cb: cc[2],
        a: 0.2 + Math.random() * 0.24,
      });
    }
    for (let i = 0; i < 34; i++) {
      dust.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 3.2 + 0.8,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        a: 0.1 + Math.random() * 0.5,
        w: Math.random() * Math.PI * 2,
      });
    }
  }
  initParticles();

  function drawParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of blobs) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -200) b.x = canvas.width + 200;
      if (b.x > canvas.width + 200) b.x = -200;
      if (b.y < -120) b.y = canvas.height + 120;
      if (b.y > canvas.height + 120) b.y = -120;
      // 柔边直接画出来：中心到 55% 半径保持原 alpha，之后向边缘落到 0 ——
      // 和「实心圆 + 50px CSS blur」的观感几乎一致，但省掉每帧的全屏模糊 pass
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(${b.cr},${b.cg},${b.cb},${b.a})`);
      g.addColorStop(0.55, `rgba(${b.cr},${b.cg},${b.cb},${b.a})`);
      g.addColorStop(1, `rgba(${b.cr},${b.cg},${b.cb},0)`);
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.globalAlpha = 1;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const d of dust) {
      d.x += d.vx;
      d.y += d.vy;
      d.w += 0.02;
      if (d.x < -8) d.x = canvas.width + 8;
      if (d.x > canvas.width + 8) d.x = -8;
      if (d.y < -8) d.y = canvas.height + 8;
      if (d.y > canvas.height + 8) d.y = -8;
      // 微尘同样画成软点。以前 50px blur 会把 3px 的点摊到几乎看不见，
      // 这里把 alpha 压到一成，保持「隐约有几点微光」的原有观感
      const alpha = d.a * (0.55 + 0.45 * Math.sin(d.w)) * 0.12;
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 30fps 节流：色块每帧只挪零点几像素，60fps 与 30fps 肉眼无差，
  // 但画布重绘 + 纹理上传的 GPU/CPU 预算直接砍半（rAF 本身仍按刷新率跑，跳帧只是空转，几乎零成本）
  const FRAME_MS = 1000 / 30;
  let lastDraw = 0;
  function tick(t) {
    if (t - lastDraw >= FRAME_MS) { lastDraw = t; drawParticles(); }
    if (!prefersReducedMotion) requestAnimationFrame(tick);
  }

  if (prefersReducedMotion) {
    drawParticles(); // 只画一帧
  } else {
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => {
    sizeCanvas();
    initParticles();
  });

  requestAnimationFrame(() => canvas.classList.add('on'));

  /* ---------------- 2. 问候语 + 时钟（七段数码管） ---------------- */
  const greetWord = document.getElementById('greetWord');
  const clockTime = document.getElementById('clockTime');
  const clockDate = document.getElementById('clockDate');
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  /* 七段数码管：段坐标与字形映射（复刻原站 SVG 数码钟，HH:MM + 闪烁冒号指示秒） */
  const SEGPATH = {
    a: 'M6 7H18',
    b: 'M18 9V19',
    c: 'M18 25V35',
    d: 'M6 37H18',
    e: 'M6 25V35',
    f: 'M6 9V19',
    g: 'M6 22H18',
  };
  const SEGMAP = {
    0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd',
    4: 'fgbc', 5: 'afgcd', 6: 'afgecd', 7: 'abc',
    8: 'abcdefg', 9: 'abfgcd',
  };
  let clockSegs = [];
  let clockColons = [];

  function buildSegClock(root) {
    if (!root) return;
    const NS = 'http://www.w3.org/2000/svg';
    clockSegs = [];
    clockColons = [];
    for (let i = 0; i < 4; i++) {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'seg');
      svg.setAttribute('viewBox', '0 0 24 44');
      for (const k of Object.keys(SEGPATH)) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('data-k', k);
        p.setAttribute('d', SEGPATH[k]);
        svg.appendChild(p);
      }
      root.appendChild(svg);
      clockSegs.push(svg);
      if (i === 1) {
        const colon = document.createElement('span');
        colon.className = 'colon';
        root.appendChild(colon);
        clockColons.push(colon);
      }
    }
  }

  function renderSegs(segEl, digit) {
    const on = SEGMAP[digit] || '';
    for (const p of segEl.querySelectorAll('path')) {
      p.classList.toggle('on', on.includes(p.getAttribute('data-k')));
    }
  }

  function updateClock() {
    const now = new Date();
    const h = now.getHours();
    const pad = (n) => String(n).padStart(2, '0');
    const hh = pad(h), mm = pad(now.getMinutes());
    if (clockSegs.length) {
      renderSegs(clockSegs[0], +hh[0]);
      renderSegs(clockSegs[1], +hh[1]);
      renderSegs(clockSegs[2], +mm[0]);
      renderSegs(clockSegs[3], +mm[1]);
    }
    for (const c of clockColons) {
      c.classList.toggle('blink', now.getSeconds() % 2 === 0);
    }
    if (clockDate) clockDate.textContent = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} 周${WEEK[now.getDay()]}`;
    if (greetWord) {
      if (h >= 5 && h < 12) greetWord.textContent = 'Good Morning';
      else if (h >= 12 && h < 18) greetWord.textContent = 'Good Afternoon';
      else greetWord.textContent = 'Good Evening';
    }
  }
  buildSegClock(clockTime);
  updateClock();
  setInterval(updateClock, 1000);

  /* ---------------- 3. 日历 ----------------
     节假日数据来源：国务院办公厅《关于 2026 年部分节假日安排的通知》
     国办发明电〔2025〕7 号，2025-11-04 发布（gov.cn）。
     要支持新一年，只需往 HOLIDAYS 里再加一个年份键，其余代码都不用动：
       off  —— 放假调休日，键 "MM-DD"，值是该段的短名（格子里显示这个）
       fest —— 节日当天的正式名（同一天优先显示它，如 2-17「春节」、2-16「除夕」）
       work —— 调休上班日（周末补班） */
  const HOLIDAYS = {
    2026: {
      off: {
        '01-01': '元旦', '01-02': '元旦', '01-03': '元旦',
        '02-15': '春节', '02-16': '春节', '02-17': '春节', '02-18': '春节',
        '02-19': '春节', '02-20': '春节', '02-21': '春节', '02-22': '春节', '02-23': '春节',
        '04-04': '清明', '04-05': '清明', '04-06': '清明',
        '05-01': '劳动', '05-02': '劳动', '05-03': '劳动', '05-04': '劳动', '05-05': '劳动',
        '06-19': '端午', '06-20': '端午', '06-21': '端午',
        '09-25': '中秋', '09-26': '中秋', '09-27': '中秋',
        '10-01': '国庆', '10-02': '国庆', '10-03': '国庆', '10-04': '国庆',
        '10-05': '国庆', '10-06': '国庆', '10-07': '国庆'
      },
      fest: {
        '01-01': '元旦', '02-16': '除夕', '02-17': '春节', '04-05': '清明节',
        '05-01': '劳动节', '06-19': '端午节', '09-25': '中秋节', '10-01': '国庆节'
      },
      work: {
        '01-04': '元旦调休', '02-14': '春节调休', '02-28': '春节调休',
        '05-09': '劳动节调休', '09-20': '国庆调休', '10-10': '国庆调休'
      }
    }
  };

  const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);

  /* 某一天的假期状态；该年没有安排数据时 known=false（前端会提示"待公布"） */
  function dayHoliday(y, m, d) {
    const year = HOLIDAYS[y];
    if (!year) return { known: false, off: false, work: false, name: '' };
    const key = `${pad2(m + 1)}-${pad2(d)}`;
    const off = year.off[key];
    const work = year.work[key];
    return {
      known: true,
      off: !!off,
      work: !!work,
      name: off ? year.fest[key] || off : work || ''
    };
  }

  /* 某个月的假期概览：把连续的放假日并成一段，输出「本月放假 3 天 · 25–27 日 中秋节」。
     合并时按 off 里的"段名"判断（春节/国庆…），而不是按当天显示名 ——
     否则 25 日（中秋节）和 26 日（中秋）会被当成两段，读起来很啰嗦。
     显示名取这段第一天的正式名。 */
  function monthSummary(y, m) {
    const year = HOLIDAYS[y];
    const days = new Date(y, m + 1, 0).getDate();
    if (!year) return `${y} 年放假安排待公布`;
    const blocks = [];
    for (let d = 1; d <= days; d++) {
      const key = `${pad2(m + 1)}-${pad2(d)}`;
      const base = year.off[key];
      if (!base) continue;
      const last = blocks[blocks.length - 1];
      if (last && last.end === d - 1 && last.base === base) last.end = d;
      else blocks.push({ start: d, end: d, base, label: year.fest[key] || base });
    }
    if (!blocks.length) {
      const works = [];
      for (let d = 1; d <= days; d++) if (dayHoliday(y, m, d).work) works.push(d);
      return works.length
        ? `本月无假期 · ${works.map((d) => `${d} 日`).join('、')}补班`
        : '本月无法定节假日';
    }
    const total = blocks.reduce((n, b) => n + (b.end - b.start + 1), 0);
    const desc = blocks
      .map((b) => `${b.start === b.end ? b.start : `${b.start}–${b.end}`} 日 ${b.label}`)
      .join(' · ');
    return `本月放假 ${total} 天 · ${desc}`;
  }

  const calTitle = document.getElementById('calTitle');
  const calToday = document.getElementById('calToday');
  const calGrid = document.getElementById('calGrid');

  function buildCalendar(now) {
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const startWeek = first.getDay(); // 0 周日
    const days = new Date(y, m + 1, 0).getDate();
    const order = [0, 1, 2, 3, 4, 5, 6].map((w) => (w + 1) % 7); // 周一开头：一 二 三 四 五 六 日
    // 标题只给"年 + 月"（日历的身份），具体是哪天交给右上角那枚小字，
    // 也免得和左边时钟卡那行完整日期重复。
    if (calTitle) calTitle.textContent = `${y} 年 ${m + 1} 月`;
    if (calToday) calToday.textContent = `今天 · 周${WEEK[now.getDay()]}`;
    if (!calGrid) return;
    const blanks = ((startWeek + 6) % 7); // 周一起始的偏移：周日=6 … 周一=0
    let html = order.map((w) => `<div class="wk">${WEEK[w]}</div>`).join('');
    for (let i = 0; i < blanks; i++) {
      html += '<div class="day blank"></div>';
    }
    for (let d = 1; d <= days; d++) {
      const isToday = d === now.getDate();
      const wd = (blanks + d - 1) % 7; // 0=周一 … 5=周六 6=周日
      const h = dayHoliday(y, m, d);
      // 放假 / 补班日在数字下面点一个小圆点：不占位置、不打断网格，
      // 但一眼能看出"这个月有假"，也提示这张卡能点开看详情。
      const mark = h.off ? '<i class="dot off"></i>' : h.work ? '<i class="dot work"></i>' : '';
      html += `<div class="day${isToday ? ' today' : ''}${wd >= 5 ? ' we' : ''}">${d}${mark}</div>`;
    }
    calGrid.innerHTML = html;
  }
  buildCalendar(new Date());

  /* ---------------- 3.2 日历详情面板（点击日历卡打开） ----------------
     动画思路（iOS 那种"小卡片长成大面板"）：
       ① 面板先以最终尺寸摆好（visibility: visible 但 opacity 0），量出它的矩形；
       ② 用「卡片矩形 → 面板矩形」算出 scale + translate 当作起始 transform，
          再让它回到 transform: none —— 视觉上面板就是从卡片里长出来的；
       ③ 圆角同步形变（起始圆角 = 卡片视觉圆角 / 缩放比），末端回到面板自己的 34px；
       ④ 内容（.sheet-inner）延迟 0.16s 再淡入，飞行过程只看到一块"面板色的光板"，
          避免缩小状态下的文字糊成一团 —— iOS 也是这么干的；
       ⑤ 关闭就是反过来：量一次卡片矩形，把 transform 设回去，动画结束后隐藏。
     面板用 left/top 之外的 grid 居中，**不给 transform 写居中的 translate**，
     这样 transform 才能空出来做 FLIP。 */
  const calCard = document.querySelector('.card-calendar');
  const calLayer = document.getElementById('calLayer');
  const calBackdrop = document.getElementById('calBackdrop');
  const calSheet = document.getElementById('calSheet');
  const sheetYM = document.getElementById('sheetYM');
  const sheetSub = document.getElementById('sheetSub');
  const sheetGrid = document.getElementById('sheetGrid');
  const sheetSum = document.getElementById('sheetSum');

  let shY = 0;          // 面板当前显示的年
  let shM = 0;          // 面板当前显示的月（0-11）
  let shSel = 0;        // 面板里选中的日
  let sheetOpen = false;
  let closeTimer = 0;

  function sheetRect() {
    // 卡片当前的视口矩形。面板和卡片都在同一坐标系（面板是 fixed，不受舞台缩放影响），
    // 所以 getBoundingClientRect 的值可以直接相减算 FLIP。
    return calCard ? calCard.getBoundingClientRect() : { left: 0, top: 0, width: 10, height: 10 };
  }

  function drawSheet() {
    const days = new Date(shY, shM + 1, 0).getDate();
    const blanks = ((new Date(shY, shM, 1).getDay() + 6) % 7); // 周一起始
    const today = new Date();
    const isThisMonth = today.getFullYear() === shY && today.getMonth() === shM;
    let html = '';
    for (let i = 0; i < blanks; i++) html += '<div class="sd blank"></div>';
    for (let d = 1; d <= days; d++) {
      const wd = (blanks + d - 1) % 7; // 0=周一 … 5=周六 6=周日
      const h = dayHoliday(shY, shM, d);
      const cls = ['sd'];
      if (h.off) cls.push('d-off');
      if (h.work) cls.push('d-work');
      if (wd >= 5 && !h.off && !h.work) cls.push('d-we');
      if (isThisMonth && d === today.getDate()) cls.push('today');
      if (d === shSel) cls.push('sel');
      const badge = h.off ? '<i class="sd-b">休</i>' : h.work ? '<i class="sd-b">班</i>' : '';
      html += `<div class="${cls.join(' ')}" data-d="${d}">${badge}` +
        `<span class="sd-n">${d}</span><span class="sd-t">${h.name}</span></div>`;
    }
    if (sheetGrid) sheetGrid.innerHTML = html;
    if (sheetYM) sheetYM.textContent = `${shY} 年 ${shM + 1} 月`;
    if (sheetSum) sheetSum.textContent = monthSummary(shY, shM);
    describeDay(shSel);
  }

  /* 头部副标题：选中日的完整信息 —— 这就是"写啥节 + 是否放假" */
  function describeDay(d) {
    if (!sheetSub || !d) return;
    const wd = new Date(shY, shM, d).getDay();
    const h = dayHoliday(shY, shM, d);
    let state;
    if (h.off) state = `${h.name || '假期'} · 放假`;
    else if (h.work) state = `${h.name || '调休'} · 上班`;
    else if (wd === 0 || wd === 6) state = '周末休息';
    else state = '工作日';
    const isToday = (() => {
      const t = new Date();
      return t.getFullYear() === shY && t.getMonth() === shM && t.getDate() === d;
    })();
    sheetSub.textContent = `${shM + 1} 月 ${d} 日 周${WEEK[wd]} · ${state}${isToday ? ' · 今天' : ''}`;
  }

  /* 翻月之后默认选中哪天：本月选今天，别的月份选 1 号 ——
     否则头部那行"X 月 X 日 · 什么节 · 放不放假"会停在上个月，看着像没刷新。 */
  function defaultSel() {
    const t = new Date();
    return t.getFullYear() === shY && t.getMonth() === shM ? t.getDate() : 1;
  }

  function openSheet(day) {
    if (!calLayer || !calSheet || sheetOpen) return;
    const today = new Date();
    const init = day && day <= new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      ? day
      : today.getDate();
    shY = today.getFullYear();
    shM = today.getMonth();
    shSel = init;
    drawSheet();

    sheetOpen = true;
    clearTimeout(closeTimer);
    document.body.classList.add('sheet-lock');

    // ① 先摆好、隐藏内容、清掉上一次的 transform，量出"目的地"矩形
    calLayer.classList.add('vis');
    calLayer.classList.remove('content');
    calSheet.style.willChange = 'transform';   // 只在动画期间提层，结束就撤（见关闭计时器）
    calSheet.style.transition = 'none';
    calSheet.style.opacity = '0';
    calSheet.style.transform = '';
    calSheet.style.borderRadius = '';
    const to = calSheet.getBoundingClientRect();
    const from = sheetRect();
    const sx = from.width / to.width;
    const sy = from.height / to.height;

    // ② 圆角也跟着形变：起始值要让"缩放之后"看起来正好是卡片的圆角
    const rCard = parseFloat(getComputedStyle(calCard).borderTopLeftRadius) || 0;
    const vbScale = from.width / (calCard.offsetWidth || from.width); // 舞台的等比缩放
    calSheet.style.borderRadius = `${(rCard * vbScale) / sx}px`;
    calSheet.style.transform =
      `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
    void calSheet.offsetWidth; // 强制提交起始态，否则浏览器会把两步合并、动画消失

    // ③ 回到最终位置：这一步才是真正的动画
    calSheet.style.transition = '';
    calSheet.style.transform = '';
    /* 圆角也要归位。不清掉的话会永远停在"起始大圆角"上（它被写成内联值，
       优先级高于 CSS 里的 34px），面板就变成一个胶囊 —— 四角会把标题和图例切掉。 */
    calSheet.style.borderRadius = '';
    calSheet.style.opacity = '1';
    if (calBackdrop) calBackdrop.style.opacity = '1';
    setTimeout(() => { if (sheetOpen) calLayer.classList.add('content'); }, 160);
  }

  function closeSheet() {
    if (!sheetOpen || !calSheet) return;
    sheetOpen = false;
    calLayer.classList.remove('content');

    const to = calSheet.getBoundingClientRect(); // 此刻 transform 已是 none，量到的就是最终矩形
    const from = sheetRect();
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    const rCard = parseFloat(getComputedStyle(calCard).borderTopLeftRadius) || 0;
    const vbScale = from.width / (calCard.offsetWidth || from.width);

    calSheet.style.transition =
      'transform .42s cubic-bezier(.36, 0, .3, 1), border-radius .42s cubic-bezier(.36, 0, .3, 1)';
    calSheet.style.borderRadius = `${(rCard * vbScale) / sx}px`;
    calSheet.style.transform =
      `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
    if (calBackdrop) calBackdrop.style.opacity = '0';

    closeTimer = setTimeout(() => {
      calLayer.classList.remove('vis');
      document.body.classList.remove('sheet-lock');
      calSheet.style.transition = 'none';
      calSheet.style.transform = '';
      calSheet.style.borderRadius = '';
      calSheet.style.opacity = '0';
      calSheet.style.willChange = '';
      requestAnimationFrame(() => { calSheet.style.transition = ''; });
    }, 430);
  }

  if (calCard && calLayer) {
    calCard.addEventListener('click', (e) => {
      const cell = e.target.closest('.cal-grid .day');
      const d = cell && !cell.classList.contains('blank') ? parseInt(cell.textContent, 10) : 0;
      openSheet(d || 0);
    });
    calCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSheet(0);
      }
    });

    document.getElementById('sheetClose').addEventListener('click', closeSheet);
    calBackdrop.addEventListener('click', closeSheet);

    document.getElementById('sheetPrev').addEventListener('click', () => {
      shM -= 1;
      if (shM < 0) { shM = 11; shY -= 1; }
      shSel = defaultSel();
      drawSheet();
    });
    document.getElementById('sheetNext').addEventListener('click', () => {
      shM += 1;
      if (shM > 11) { shM = 0; shY += 1; }
      shSel = defaultSel();
      drawSheet();
    });
    document.getElementById('sheetToday').addEventListener('click', () => {
      const t = new Date();
      shY = t.getFullYear();
      shM = t.getMonth();
      shSel = t.getDate();
      drawSheet();
    });

    // 点某一天：高亮它，并在头部写出这天是什么节、放不放假
    sheetGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.sd');
      if (!cell || cell.classList.contains('blank')) return;
      shSel = parseInt(cell.dataset.d, 10);
      drawSheet();
    });

    document.addEventListener('keydown', (e) => {
      if (!sheetOpen) return;
      if (e.key === 'Escape') closeSheet();
      else if (e.key === 'ArrowLeft') document.getElementById('sheetPrev').click();
      else if (e.key === 'ArrowRight') document.getElementById('sheetNext').click();
    });
  }

  /* ---------------- 3.5 横幅幻灯片：三张壁纸自动轮播 ---------------- */
  const bannerBox = document.getElementById('cardBanner');
  const bannerSlides = bannerBox
    ? Array.prototype.slice.call(bannerBox.querySelectorAll('.banner-slide'))
    : [];
  if (bannerSlides.length > 1) {
    const dotBox = document.getElementById('bannerDots');
    const DWELL = 7000;           // 每张停留时长（毫秒）——想快/想慢只改这一个数
    let cur = 0;
    let timer = null;

    // 每张图配一个指示点，点了直接跳过去
    const dots = bannerSlides.map(function (_, i) {
      if (!dotBox) return null;
      const d = document.createElement('i');
      d.className = i === 0 ? 'on' : '';
      d.addEventListener('click', function () { go(i); play(); });
      dotBox.appendChild(d);
      return d;
    });

    function go(i) {
      cur = (i + bannerSlides.length) % bannerSlides.length;
      bannerSlides.forEach(function (s, k) { s.classList.toggle('is-active', k === cur); });
      dots.forEach(function (d, k) { if (d) d.classList.toggle('on', k === cur); });
    }
    function play() { stop(); timer = setInterval(function () { go(cur + 1); }, DWELL); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    go(0);
    play();
    // 鼠标停在卡上时暂停（正在细看某张就不打断），移开继续
    bannerBox.addEventListener('mouseenter', stop);
    bannerBox.addEventListener('mouseleave', play);
    // 切去别的标签页时停掉，回来再继续——否则回来瞬间会把攒下的几次一次跳完
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); } else { go(cur); play(); }
    });
  }

  /* ---------------- 4. 音乐播放条 ---------------- */
  const musicPlay = document.getElementById('musicPlay');
  const musicIcon = document.getElementById('musicIcon');
  const eqBox = document.getElementById('eqBox');
  let playing = false;

  if (musicPlay && eqBox && musicIcon) {
    musicPlay.addEventListener('click', () => {
      playing = !playing;
      eqBox.classList.toggle('playing', playing);
      musicIcon.innerHTML = playing
        ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' // 暂停图标
        : '<path d="M8 5.14v14l11-7z"/>';          // 播放图标
    });
  }

  

  const btnMuyu = document.getElementById('btnMuyu');

  // Web Audio 合成木鱼"笃"声：主共鸣快速下滑音 + 高频瞬态，零音频文件
  let audioCtx = null;
  function playMuyuSound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime;

      // 木质主共鸣：950Hz 快速滑落，指数衰减
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.09);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.16);

      // 敲击瞬态：高频短音"嗒"
      const tick = audioCtx.createOscillator();
      const tickGain = audioCtx.createGain();
      tick.type = 'triangle';
      tick.frequency.setValueAtTime(2400, t);
      tickGain.gain.setValueAtTime(0.16, t);
      tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      tick.connect(tickGain).connect(audioCtx.destination);
      tick.start(t);
      tick.stop(t + 0.05);
    } catch (e) { /* 无声环境下静默失败 */ }
  }

  if (btnMuyu) {
    btnMuyu.addEventListener('click', (e) => {
      playMuyuSound();

      let meritoriousDeeds = parseInt(localStorage.getItem('meritoriousDeeds') || '0', 10);
      meritoriousDeeds++;
      localStorage.setItem('meritoriousDeeds', String(meritoriousDeeds));

      // 敲击动画：移除后强制的重排再添加，保证连点每次都重放
      btnMuyu.classList.remove('hit');
      void btnMuyu.offsetWidth;
      btnMuyu.classList.add('hit');

      // 鼠标位置冒出"功德 +1"（键盘触发时退化为按钮中心）
      const pop = document.createElement('div');
      pop.className = 'muyu-pop';
      pop.innerHTML = '功德 +1<span class="lotus">🪷</span>';
      const r = btnMuyu.getBoundingClientRect();
      const hasPointer = e.clientX !== 0 || e.clientY !== 0;
      const x = hasPointer ? e.clientX : r.left + r.width / 2;
      const y = hasPointer ? e.clientY : r.top + r.height / 2;
      pop.style.left = x + 'px';
      pop.style.top = (y - 14) + 'px';
      // 随机水平抖一点，连点时字不至于叠在一起
      pop.style.marginLeft = (Math.random() * 24 - 12) + 'px';
      document.body.appendChild(pop);
      pop.addEventListener('animationend', () => pop.remove());
    });
    btnMuyu.addEventListener('animationend', () => btnMuyu.classList.remove('hit'));
  }

  /* ---------------- 5.5 推荐分享：点击复制域名 ---------------- */
  // 分享页暂不做（等有正式域名再上线），先点击复制 mcxiaodou.top
  const navShare = document.getElementById('navShare');
  if (navShare) {
    const SHARE_DOMAIN = 'mcxiaodou.top';
    const showCopied = (x, y) => {
      const pop = document.createElement('div');
      pop.className = 'copy-pop';
      pop.textContent = '已复制 ' + SHARE_DOMAIN;
      pop.style.left = x + 'px';
      pop.style.top = y + 'px';
      document.body.appendChild(pop);
      pop.addEventListener('animationend', () => pop.remove());
    };
    const copyDomain = (x, y) => {
      const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = SHARE_DOMAIN;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        ta.remove();
        showCopied(x, y);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(SHARE_DOMAIN)
          .then(() => showCopied(x, y))
          .catch(fallback);
      } else {
        fallback();
      }
    };
    navShare.addEventListener('click', (e) => {
      e.preventDefault();
      const r = navShare.getBoundingClientRect(); // 视口坐标（stage 缩放已含在内）
      copyDomain(r.left + r.width / 2, r.top + 6);
    });
  }

  /* ---------------- 6. 最新新闻：打开页面即刷新，随机抽 3 条渲染 ---------------- */
  // NEWS_POOL 是"最后一层兜底"静态池（update_news.py 可手动/脚本刷新）。
  // 正常情况下页面显示的是 6.5 段每次打开现拉的当日新闻。
  // 条目格式：{ t: 标题, s: 来源, u: 链接, d: 'MM-DD' }
  const NEWS_POOL = [
    { t: "2026年服贸会迎公众开放日", s: "中国新闻网", u: "http://www.chinanews.com.cn/tp/hd2011/2026/09-12/1204067.shtml", d: "09-12" },
    { t: "25位菲尔兹奖得主联合警告：AI与数学正在出现“严重错位”", s: "中国新闻网", u: "https://www.chinanews.com.cn/cj/2026/09-12/10695225.shtml", d: "09-12" },
    { t: "“圈养雪豹博流量” ？ 救护中心用科普回应谣言", s: "中国新闻网", u: "https://www.chinanews.com.cn/sh/2026/09-12/10695224.shtml", d: "09-12" },
    { t: "2026巴黎设计周中国创新馆开馆仪式举行", s: "中国新闻网", u: "https://www.chinanews.com.cn/gj/2026/09-12/10695174.shtml", d: "09-12" },
    { t: "莫桑比克商界：外汇短缺和燃油危机制约营商环境", s: "中国新闻网", u: "https://www.chinanews.com.cn/gj/2026/09-12/10695173.shtml", d: "09-12" },
    { t: "巴黎国际空间峰会举行 致力于加强航天合作", s: "中国新闻网", u: "https://www.chinanews.com.cn/gj/2026/09-12/10695171.shtml", d: "09-12" },
    { t: "特朗普、拜登、奥巴马、小布什、克林顿……美国总统与多位前总统出席“9·11”纪念活动现场", s: "中国新闻网", u: "https://www.chinanews.com.cn/gj/2026/09-12/10695222.shtml", d: "09-12" },
    { t: "视频画报｜重温习近平主席在金砖峰会的精彩时刻", s: "中国新闻网", u: "https://www.chinanews.com.cn/gn/2026/09-12/10695221.shtml", d: "09-12" },
    { t: "学习新语｜习近平主席深刻阐述“金砖合作”", s: "中国新闻网", u: "https://www.chinanews.com.cn/gn/2026/09-12/10695219.shtml", d: "09-12" },
    { t: "一个“查无此人”的皇帝，为何让台湾老百姓念念不忘？——微短剧《嘉庆君游台湾》首映侧记", s: "中国新闻网", u: "https://www.chinanews.com.cn/gn/2026/09-12/10695217.shtml", d: "09-12" },
    { t: "京雄快线开启全线贯通试运行", s: "中国新闻网", u: "https://www.chinanews.com.cn/sh/2026/09-12/10695216.shtml", d: "09-12" },
    { t: "全国算力“一张网、一盘棋、一体化”发展格局基本形成", s: "中国新闻网", u: "https://www.chinanews.com.cn/cj/2026/09-12/10695215.shtml", d: "09-12" },
    { t: "秦岭小村里的台湾主厨：以山野烟火融合两岸“味蕾”精华", s: "中国新闻网", u: "https://www.chinanews.com.cn/gn/2026/09-12/10695206.shtml", d: "09-12" },
    { t: "延安红色半程马拉松中秋小长假开跑 红色文创及景区惠民政策发布", s: "中国新闻网", u: "https://www.chinanews.com.cn/gn/2026/09-12/10695199.shtml", d: "09-12" },
    { t: "一块屏守护老城记忆 重庆江津几江街道数字文保的“加减法”", s: "中国新闻网", u: "https://www.chinanews.com.cn/gn/2026/09-12/10695198.shtml", d: "09-12" },
  ];

  const newsList = document.querySelector('.news-list');

  // Fisher-Yates 洗牌后取前 3 条渲染：每次刷新组合与顺序都不同
  function renderNews(pool) {
    if (!newsList || !Array.isArray(pool) || pool.length < 3) return;
    const arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    newsList.innerHTML = arr.slice(0, 3).map((n) => `
      <li>
        <a href="${n.u}" target="_blank" rel="noopener">
          <span class="news-title">${n.t}</span>
          <span class="news-src">${n.s} · ${n.d}</span>
        </a>
      </li>`).join('');
  }

  /* ------- 6.5 新闻实时层：每打开一次页面就跑一次刷新 ------- */
  // 触发时机（不再依赖系统计划任务）：
  //   ① 首次加载；② 前进/后退从缓存恢复（pageshow）；③ 重新切回本标签页（visibilitychange，60s 节流）
  // 每次触发都拉 60s API：成功 → 当日 15+ 条整池替换，并写两份缓存
  //   （当日 xiaodouNews-MM-DD + 跨天兜底 xiaodouNews-latest）；
  // 失败 → 当日缓存 → latest 缓存 → script.js 静态池，逐级降级，任何情况下都有内容可显示。
  const dateStr = () => {
    const n = new Date();
    return String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  };
  const LATEST_KEY = 'xiaodouNews-latest';

  const readCache = (k) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  };

  if (newsList) {
    // 初始渲染先用手里最新的一层顶上（避免空白）：当日缓存 → latest 缓存 → 静态池
    renderNews(readCache('xiaodouNews-' + dateStr()) || readCache(LATEST_KEY) || NEWS_POOL);

    // 清理历史残留 key（旧前缀 yysuniNews- 与过期的当日缓存），只留当日 + latest
    try {
      const keep = ['xiaodouNews-' + dateStr(), LATEST_KEY];
      Object.keys(localStorage).forEach((k) => {
        if (/^(yysuniNews-|xiaodouNews-)/.test(k) && keep.indexOf(k) === -1) localStorage.removeItem(k);
      });
    } catch (e) {}

    let busy = false;       // 上一次刷新还没回来，不重复发请求
    let lastTry = 0;        // 最近一次尝试时间，用于节流
    const THROTTLE_MS = 60000;

    function refreshNews(force) {
      const now = Date.now();
      if (busy) return;
      if (!force && now - lastTry < THROTTLE_MS) return;
      busy = true;
      lastTry = now;
      const today = dateStr();   // 每次现算，跨天挂着的标签页也能自动切到新的一天
      fetch('https://60s.viki.moe/v2/60s', { signal: AbortSignal.timeout(6000) })
        .then((r) => r.json())
        .then((j) => {
          const d = (j && j.data) || {};
          const list = d.news || [];
          // 校验确实是今天的数据（date 为 YYYY-MM-DD，取 MM-DD 与本地比对）
          if (!Array.isArray(list) || list.length < 3 || String(d.date).slice(5) !== today) {
            throw new Error('stale or bad data');
          }
          return list.map((t) => ({
            t,
            s: '60s早报',
            u: 'https://www.baidu.com/s?wd=' + encodeURIComponent(t),
            d: today,
          }));
        })
        .then((items) => {
          renderNews(items);
          try {
            localStorage.setItem('xiaodouNews-' + today, JSON.stringify(items));
            localStorage.setItem(LATEST_KEY, JSON.stringify(items));
          } catch (e) {}
        })
        .catch(() => { /* 拉取失败：保持当前内容不动，下次打开再试 */ })
        .finally(() => { busy = false; });
    }

    refreshNews(true);                                            // ① 打开即跑一次
    window.addEventListener('pageshow', () => refreshNews(true));  // ② 前进/后退恢复页面
    document.addEventListener('visibilitychange', () => {          // ③ 重新切回本标签页
      if (!document.visibilityState || document.visibilityState === 'visible') refreshNews(false);
    });
  }

  /* ---------------- 7. 随机推荐：每次刷新从池中随机抽 1 个网站 ---------------- */
  // 池子：{ n: 名称, d: 推荐语, u: 链接,
  //   g: [三色渐变 c1,c2,c3], a: 装饰强调色,
  //   svg: 图形 path（默认白色线稿；noStroke 时 path 自带 fill 色，如 Figma 真彩 logo） }
  // 想增删网站改这个数组即可。
  const REC_POOL = [
    { n: 'MDN Web Docs', d: 'Web 开发权威文档', u: 'https://developer.mozilla.org/',
      g: ['#0f2027', '#1e5f8e', '#3fa9f5'], a: '#7fd8ff',
      svg: '<path d="M12 6c-1.8-1.6-4.5-2-8-1.4v13.8c3.5-.6 6.2-.2 8 1.4 1.8-1.6 4.5-2 8-1.4V4.6C16.5 4 13.8 4.4 12 6z"/><path d="M12 6v13.4"/>' },
    { n: 'CodePen', d: '海量炫酷 demo 随便拆', u: 'https://codepen.io/',
      g: ['#0b0f14', '#14425e', '#2dd4bf'], a: '#47cf73',
      svg: '<path d="M12 2.5l9.5 6.2v6.6L12 21.5l-9.5-6.2V8.7z"/><path d="M2.5 8.7L12 15l9.5-6.3"/><path d="M2.5 15.3L12 9l9.5 6.3"/><path d="M12 15v6.5"/>' },
    { n: 'CSS-Tricks', d: 'CSS 技巧与教程', u: 'https://css-tricks.com/',
      g: ['#7f1d1d', '#e6392b', '#ff9a3d'], a: '#ffd166',
      svg: '<path d="M9.5 3 7.5 21"/><path d="M16.5 3l-2 18"/><path d="M4 8.5h17"/><path d="M3 15.5h17"/>' },
    { n: 'Can I Use', d: '浏览器兼容性一查便知', u: 'https://caniuse.com/',
      g: ['#14532d', '#22a559', '#86e08e'], a: '#d9f99d',
      svg: '<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/>' },
    { n: 'Dribbble', d: '设计师作品与 UI 灵感库', u: 'https://dribbble.com/',
      g: ['#b81e5e', '#ea4c89', '#ff9ec4'], a: '#ffd3e6',
      svg: '<circle cx="12" cy="12" r="9"/><path d="M5.6 6.4c3.4 3.1 6.8 8 8.2 13.6"/><path d="M18.4 6c-2.9 4.4-8.6 6.1-15.3 5.6"/><path d="M20.8 13.4c-5.9-1.6-10.4.5-12.9 5.1"/>' },
    { n: 'Awwwards', d: '优秀网页设计颁奖台', u: 'https://www.awwwards.com/',
      g: ['#0a1030', '#14424a', '#2ee6a8'], a: '#b9ffe9',
      svg: '<path d="M4 5.5L7.2 19l4.8-10.5L16.8 19 20 5.5"/><path d="M20.8 18.8h.01"/>' },
    { n: 'Unsplash', d: '免费高清图库，可商用', u: 'https://unsplash.com/',
      g: ['#1a2740', '#2d5f8a', '#6db3f2'], a: '#cfe8ff',
      svg: '<path d="M7 3.5h10v5.5H7z"/><path d="M3.5 13h5.7v5h5.6v-5h5.7v7.5H3.5z"/>' },
    { n: 'Vercel', d: '前端项目一键部署', u: 'https://vercel.com/',
      g: ['#0b0b12', '#24243e', '#5b5bd6'], a: '#8b8bf5',
      svg: '<path d="M12 4.5L21 19.5H3z"/>' },
    { n: 'Figma', d: '在线协作设计工具', u: 'https://www.figma.com/',
      g: ['#2b1055', '#7c3aed', '#f24e1e'], a: '#ffd166', noStroke: true,
      svg: '<path d="M8 24a4 4 0 0 1-4-4 4 4 0 0 1 4-4h4v4a4 4 0 0 1-4 4z" fill="#0ACF83"/><path d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" fill="#A259FF"/><path d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" fill="#F24E1E"/><path d="M12 0h4a4 4 0 0 1 0 8h-4V0z" fill="#FF7262"/><circle cx="16" cy="12" r="4" fill="#1ABCFE"/>' },
    { n: 'Stack Overflow', d: '程序员问答社区', u: 'https://stackoverflow.com/',
      g: ['#7c2d12', '#ea7317', '#ffc46b'], a: '#fff1d6',
      svg: '<path d="M6.5 14.5v6h11v-6"/><path d="M9 12l7.6 1.2"/><path d="M9.4 8.4l7.2-2.4"/><path d="M10.6 4.6l6-3.4"/>' },
    { n: '稀土掘金', d: '中文开发者技术社区', u: 'https://juejin.cn/',
      g: ['#0b3ea8', '#1e80ff', '#67c3ff'], a: '#d6ecff', noStroke: true,
      // 官方 mark（Simple Icons 的 24×24 路径）。外层 <g> 是 fill:none，所以这里自带白色填充。
      svg: '<path fill="#fff" d="m12 14.316 7.454-5.88-2.022-1.625L12 11.1l-.004.003-5.432-4.288-2.02 1.624 7.452 5.88Zm0-7.247 2.89-2.298L12 2.453l-.004-.005-2.884 2.318 2.884 2.3Zm0 11.266-.005.002-9.975-7.87L0 12.088l.194.156 11.803 9.308 7.463-5.885L24 12.085l-2.023-1.624Z"/>' },
    { n: 'GitHub', d: '全球最大代码托管平台', u: 'https://github.com/',
      g: ['#0d1117', '#1f3a5f', '#3f7fd1'], a: '#79c0ff',
      svg: '<circle cx="12" cy="13.5" r="7.5"/><path d="M6.2 8.2 5.6 3.6l4.2 2.2"/><path d="M17.8 8.2l.6-4.6-4.2 2.2"/><path d="M9.5 13h.01"/><path d="M14.5 13h.01"/>' },
  ];

  const cardRec = document.getElementById('cardRec');
  if (cardRec && REC_POOL.length) {
    const rec = REC_POOL[Math.floor(Math.random() * REC_POOL.length)];
    const thumb = document.getElementById('recThumb');
    document.getElementById('recName').textContent = rec.n;
    document.getElementById('recDesc').textContent = rec.d;
    if (thumb) {
      // mesh 风格封面：暗底 + 两团径向羽化光斑（边缘自然消散，无渐变分带）
      // + 强调色光晕/双层发光圆环/圆点 + 居中图形（24 网格放大 2 倍）
      const icon = rec.svg
        ? `<g transform="translate(76 22) scale(2)" fill="none" stroke="${rec.noStroke ? 'none' : '#fff'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${rec.svg}</g>`
        : `<text x="100" y="46" text-anchor="middle" dominant-baseline="central" font-size="40" font-weight="700" fill="#fff">${rec.i}</text>`;
      thumb.innerHTML = `<svg viewBox="0 0 200 92" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="recb1">
            <stop offset="0" stop-color="${rec.g[1]}" stop-opacity=".95"/>
            <stop offset="1" stop-color="${rec.g[1]}" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="recb2">
            <stop offset="0" stop-color="${rec.g[2]}" stop-opacity=".9"/>
            <stop offset="1" stop-color="${rec.g[2]}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="200" height="92" fill="${rec.g[0]}"/>
        <ellipse cx="50" cy="4" rx="98" ry="64" fill="url(#recb1)"/>
        <ellipse cx="164" cy="90" rx="108" ry="74" fill="url(#recb2)"/>
        <circle cx="100" cy="46" r="36" fill="${rec.a}" opacity=".16"/>
        <circle cx="163" cy="64" r="17" fill="none" stroke="${rec.a}" stroke-opacity=".28" stroke-width="5"/>
        <circle cx="163" cy="64" r="17" fill="none" stroke="${rec.a}" stroke-opacity=".85" stroke-width="1.8"/>
        <circle cx="34" cy="14" r="4.5" fill="${rec.a}" opacity=".95"/>
        ${icon}
      </svg>`;
    }
    cardRec.href = rec.u;
  }

  /* ---------------- 8. 虚拟鼠标（DOM 光标） ----------------
     系统光标只能是一张位图：给不了半透明的玻璃质感，
     在 125% / 150% 的屏上还会被缩放插值而发虚。这里自己画一支箭头跟着指针走：
       .vcur-glass 箭头轮廓的半透明灰渐变层（clip-path 裁形）
       .vcur-edge  同一条轮廓画两条 path：深色宽线垫底 + 白色细线，任何背景上边界都清楚
     就这一支灰色箭头 —— 白边、无拖尾、无悬停变色、无光晕，普通鼠标，只是灰玻璃的。
     ⚠️ 别再把 backdrop-filter 加回来：光标每帧平移、背后像素每帧变化，
     浏览器就得每帧把整个 backdrop root（整页）重新投影 + 模糊一遍，真机上掉帧严重
     （无头 --disable-gpu 量不出这个成本）。玻璃感全靠半透明渐变 + 双色描边。
     样式全在 style.css 末尾的「虚拟鼠标」一节，这里只管跟手逻辑。

     不掉帧这件事，一半在 CSS（见那一节末尾的三条约束），一半靠下面三条：
       1. 一帧只写一次 transform。pointermove 的触发频率远高于刷新率（1000Hz 的鼠标
          一秒能来上千次），每次都写 style 就是上千次样式失效 —— 这是掉帧最直接的来源。
          这里只把坐标记下来，统一在 rAF 里落地，同一帧写多少遍结果都一样；
       2. 指针静止时没有任何 rAF 在跑 —— 不留空转循环，页面其余动画（轮播/粒子）不被挤；
       3. devicePixelRatio 缓存起来，只在 resize 时重读，不在热路径里做样式查询。 */
  (function virtualCursor() {
    // 只在"有真指针"的设备上启用：触屏藏掉系统光标等于没有指针可用
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    // 箭头轮廓只写一遍：玻璃的 clip-path 与描边的 path 必须严丝合缝，
    // 各写各的一旦改动就错位（描边会比玻璃胖一圈或瘦一圈）。
    // 三个点：尖端 (2,2)、左下 (2,26)、右 (20,19) —— 不带尾巴的三角，比初版大一号。
    // 放大必须改路径坐标、绝不能用 transform: scale —— 缩放会把整层当位图重采样，
    // 描边直接发糊；坐标取整还有个附带好处：垂直边正好压在 x=2 的整像素上，锐利不灰。
    const ARROW = 'M2 2 L2 26 L20 19 Z';

    const cur = document.createElement('div');
    cur.className = 'vcur';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML =
      '<span class="vcur-glass" style="clip-path:path(\'' + ARROW +
        '\');-webkit-clip-path:path(\'' + ARROW + '\')"></span>' +
      '<svg class="vcur-edge" viewBox="0 0 22 28" width="22" height="28">' +
        '<path class="under" d="' + ARROW + '"/>' +
        '<path class="line" d="' + ARROW + '"/>' +
      '</svg>';
    document.body.appendChild(cur);

    // 注意顺序：藏系统光标这一步也交给 JS。脚本没跑起来就什么也不加，
    // 用户照旧有默认光标可用（纯 CSS 写死 cursor:none 就变成"没指针"了）。
    document.documentElement.classList.add('has-vcur');

    // 把坐标按设备像素取整。落点带 0.5px 时斜边会被重采样成灰边，
    // 这是"光标看着不清晰"的第一大原因。（dpr 缓存住，别在热路径里每帧问一次）
    let dpr = window.devicePixelRatio || 1;
    const snap = (v) => Math.round(v * dpr) / dpr;
    // 箭头尖画在 22×28 画布里的 (2,2)：元素左上角往回挪 2px，尖端才落在指针上。
    // 取 2 而不是 1.5 是有意的 —— 整数偏移 + 像素取整，描边永远压在整像素上。
    const TIP = 2;

    let mx = -300, my = -300; // 指针的真实位置（可能是半像素）
    let shown = false;
    let raf = 0;              // 排着队的帧；0 表示当前没有

    function paint() {
      raf = 0;
      cur.style.transform =
        'translate3d(' + snap(mx - TIP) + 'px,' + snap(my - TIP) + 'px,0)';
    }

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX;
      my = e.clientY;
      if (!shown) { shown = true; cur.classList.add('on'); }
      // 箭头零延迟：指针在哪箭头尖就在哪 —— 光标一旦"追不上手"，再好看也难用。
      // 但一帧只落地一次：本帧里后续的事件只更新坐标，不再写 style。
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });

    // 指针离开窗口（切到别的应用）：隐去，别让箭头冻在最后一个位置
    document.addEventListener('mouseleave', () => {
      shown = false;
      cur.classList.remove('on');
    });

    // 换到不同缩放比的显示器后 devicePixelRatio 会变：重读一次，按新的像素栅格再对一次
    window.addEventListener('resize', () => {
      dpr = window.devicePixelRatio || 1;
      if (shown && !raf) raf = requestAnimationFrame(paint);
    });
  })();

  /* ---------------- 9. FPS 计数器（诊断用，默认关闭） ----------------
     只有地址栏带 #fps 才会出现：右上角一个小角标，实时显示帧率。
     平时一行代码都不跑，零成本。掉帧排查时打开它，一眼看出「整页帧率」
     到底是被什么拖下去的 —— 不用再靠肉眼猜。 */
  if (location.hash.indexOf('fps') !== -1) {
    const fps = document.createElement('div');
    fps.setAttribute('aria-hidden', 'true');
    fps.style.cssText =
      'position:fixed;top:10px;right:12px;z-index:10000;' +
      'font:600 12px/1.6 "Segoe UI","Microsoft YaHei UI",sans-serif;' +
      'color:#fff;background:rgba(30,34,44,.72);padding:2px 10px;' +
      'border-radius:8px;pointer-events:none;font-variant-numeric:tabular-nums';
    document.body.appendChild(fps);
    let n = 0, t0 = performance.now();
    (function loop(t) {
      n++;
      if (t - t0 >= 500) {
        fps.textContent = Math.round(n * 1000 / (t - t0)) + ' fps';
        n = 0; t0 = t;
      }
      requestAnimationFrame(loop);
    })(t0);
  }
})();
