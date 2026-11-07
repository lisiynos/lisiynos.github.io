// Interactive visualizations of algorithms. An element <div class="viz" data-viz="NAME"></div> on a page
// becomes a player: the algorithm runs in advance and every step is a frame. The reader moves through the
// frames or plays them, and changes the input to see the algorithm work on other data. No network access needed.
(function () {
  'use strict';

  const BASE = 10000; // a long number is kept in blocks of four decimal digits, the least significant first
  const STEP_MS = 700;

  function last(frames) {
    return frames[frames.length - 1];
  }

  // ----- page elements -----

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, onClick) {
    const node = el('button', 'viz-button', label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  function field(label, value, maxLength) {
    const wrap = el('label', 'viz-field');
    const input = el('input', 'viz-input');
    input.type = 'text';
    input.value = value;
    input.maxLength = maxLength;
    wrap.append(el('span', 'viz-field-label', label), input);
    return { wrap, input };
  }

  function select(label, options) {
    const wrap = el('label', 'viz-field');
    const input = el('select', 'viz-input');
    for (const [value, text] of options) {
      const option = el('option', null, text);
      option.value = value;
      input.append(option);
    }
    wrap.append(el('span', 'viz-field-label', label), input);
    return { wrap, input };
  }

  // Puts the controls above a new output area and returns the output area.
  function mountTool(root, controls) {
    const form = el('div', 'viz-form');
    form.append(...controls);
    const output = el('div', 'viz-output');
    root.append(form, output);
    return output;
  }

  function parseNumbers(text) {
    return text.trim().split(/\s+/).filter(Boolean).map(Number);
  }

  // ----- the player: frames with buttons to move through them -----

  // Shows the frames one at a time. draw(stage, frame) fills the stage for one frame.
  function player(frames, draw) {
    const wrapper = el('div', 'viz-player');
    const stage = el('div', 'viz-stage');
    const caption = el('p', 'viz-caption');
    const counter = el('span', 'viz-counter');
    const controls = el('div', 'viz-controls');
    let index = 0;
    let timer = null;

    function stop() {
      clearInterval(timer);
      timer = null;
      auto.textContent = '▶ авто';
    }
    function show(i) {
      index = Math.max(0, Math.min(frames.length - 1, i));
      stage.replaceChildren();
      draw(stage, frames[index]);
      caption.textContent = frames[index].caption;
      counter.textContent = `Шаг ${index + 1} из ${frames.length}`;
      prev.disabled = index === 0;
      next.disabled = index === frames.length - 1;
      if (index === frames.length - 1) stop();
    }
    function start() {
      if (index === frames.length - 1) show(0);
      auto.textContent = '❚❚ пауза';
      timer = setInterval(() => show(index + 1), STEP_MS);
    }
    const prev = button('◀ назад', () => { stop(); show(index - 1); });
    const next = button('вперёд ▶', () => { stop(); show(index + 1); });
    const auto = button('▶ авто', () => (timer ? stop() : start()));
    const reset = button('⏮ сначала', () => { stop(); show(0); });
    controls.append(prev, next, auto, reset, counter);
    wrapper.append(controls, stage, caption);
    wrapper.stop = stop;
    show(0);
    return wrapper;
  }

  // Replaces what the output area shows. A player that is still running is stopped first.
  function clear(output) {
    if (output.stopPlaying) output.stopPlaying();
    output.stopPlaying = null;
    output.replaceChildren();
  }

  function replacePlayer(output, frames, draw) {
    clear(output);
    const view = player(frames, draw);
    output.append(view);
    output.stopPlaying = view.stop;
  }

  function showError(output, message) {
    clear(output);
    output.append(el('p', 'viz-error', message));
  }

  // ----- drawing rows of cells -----

  // One labelled row of cells. A number is drawn with its most significant cell on the left, as it is written;
  // leftToRight draws an array in index order instead (used for the FFT arrays).
  function drawRow(stage, label, items, { active = [], hit = [], leftToRight = false } = {}) {
    const line = el('div', 'viz-row');
    line.append(el('span', 'viz-row-label', label));
    const cells = el('div', 'viz-cells');
    const indexes = [...items.keys()];
    if (!leftToRight) indexes.reverse();
    for (const i of indexes) {
      let cls = 'viz-cell';
      if (active.includes(i)) cls += ' viz-cell-active';
      if (hit.includes(i)) cls += ' viz-cell-hit';
      const cell = el('div', cls, String(items[i]));
      cell.title = `разряд ${i}`;
      cells.append(cell);
    }
    line.append(cells);
    stage.append(line);
  }

  // Pads an array on the more significant side, so that the rows of one picture line up.
  function widen(items, width, filler = 0) {
    return Array.from({ length: width }, (_, i) => (i < items.length ? items[i] : filler));
  }

  // ----- long numbers: arrays of blocks, the least significant block first -----

  function toBlocks(text) {
    const digits = text.replace(/^0+(?=\d)/, '');
    const blocks = [];
    for (let end = digits.length; end > 0; end -= 4) {
      blocks.push(Number(digits.slice(Math.max(0, end - 4), end)));
    }
    return blocks;
  }

  function trim(a) {
    const result = a.slice();
    while (result.length > 1 && result[result.length - 1] === 0) result.pop();
    return result;
  }

  function toText(a) {
    const top = trim(a);
    let text = String(top[top.length - 1]);
    for (let i = top.length - 2; i >= 0; i--) text += String(top[i]).padStart(4, '0');
    return text;
  }

  function compare(x, y) {
    const a = trim(x);
    const b = trim(y);
    if (a.length !== b.length) return a.length > b.length ? 1 : -1;
    for (let i = a.length - 1; i >= 0; i--) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  }

  function addFrames(a, b) {
    const frames = [];
    const result = [];
    let carry = 0;
    const snap = (extra) => Object.assign({ a, b, result: result.slice(), active: -1, carry: 0, final: false }, extra);
    frames.push(snap({ caption: `Складываем блоки по четыре цифры, начиная с младших: ${toText(a)} + ${toText(b)}` }));
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      const carryIn = carry;
      const sum = x + y + carryIn;
      result[i] = sum % BASE;
      carry = Math.floor(sum / BASE);
      frames.push(snap({ active: i, carry, caption: `Блок ${i}: ${x} + ${y} + перенос ${carryIn} = ${sum}. Пишем ${sum % BASE}, перенос ${carry}` }));
    }
    if (carry) {
      result.push(carry);
      frames.push(snap({ active: result.length - 1, caption: `Последний перенос ${carry} становится новым старшим блоком` }));
    }
    frames.push(snap({ final: true, caption: `Результат: ${toText(result)}` }));
    return frames;
  }

  function mulFrames(a, b) {
    const frames = [];
    const res = new Array(a.length + b.length).fill(0);
    const snap = (extra) => Object.assign({ a, b, res: res.slice(), active: [], final: false }, extra);
    frames.push(snap({ caption: `Умножаем столбиком: каждый блок ${toText(b)} умножаем на каждый блок ${toText(a)} и складываем сдвинутые строки` }));
    for (let i = 0; i < b.length; i++) {
      let carry = 0;
      for (let j = 0; j < a.length; j++) {
        const before = res[i + j];
        const cur = before + a[j] * b[i] + carry;
        res[i + j] = cur % BASE;
        carry = Math.floor(cur / BASE);
        frames.push(snap({
          row: i, col: j, active: [i + j],
          caption: `${a[j]} · ${b[i]} = ${a[j] * b[i]}; с учётом ${before} в этом разряде и переноса получаем ${cur}. Пишем ${cur % BASE} в разряд ${i + j}, перенос ${carry}`,
        }));
      }
      let k = i + a.length;
      let rest = carry;
      while (rest > 0) {
        const cur = res[k] + rest;
        res[k] = cur % BASE;
        rest = Math.floor(cur / BASE);
        k++;
      }
      frames.push(snap({ row: i, active: [i + a.length], caption: `Строка ${i} добавлена; перенос записан в разряды, начиная с ${i + a.length}-го` }));
    }
    frames.push(snap({ final: true, caption: `Результат: ${toText(res)}` }));
    return frames;
  }

  // Multiplication of a long number by a single block: the last frame of the column multiplication.
  function mulSmall(x, k) {
    return trim(last(mulFrames(x, [k])).res);
  }

  function subtractNumbers(x, y) {
    const result = [];
    let borrow = 0;
    for (let i = 0; i < x.length; i++) {
      let cur = x[i] - (y[i] || 0) - borrow;
      borrow = cur < 0 ? 1 : 0;
      if (cur < 0) cur += BASE;
      result.push(cur);
    }
    return trim(result);
  }

  function divFrames(a, b) {
    const frames = [];
    const q = new Array(a.length).fill(0);
    let rem = [0];
    const snap = (extra) => Object.assign({ a, b, q: q.slice(), rem: rem.slice(), index: -1, final: false }, extra);
    frames.push(snap({ caption: `Делим ${toText(a)} на ${toText(b)} столбиком: сверху вниз по блокам делимого` }));
    for (let i = a.length - 1; i >= 0; i--) {
      rem = trim([a[i], ...rem]);
      frames.push(snap({ index: i, caption: `Сносим блок ${a[i]}: остаток становится ${toText(rem)}` }));
      let lo = 0;
      let hi = BASE - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const product = mulSmall(b, mid);
        const fits = compare(product, rem) <= 0;
        frames.push(snap({
          index: i, trial: mid, fits,
          caption: `Пробуем блок частного ${mid}: ${toText(b)} · ${mid} = ${toText(product)} ${fits ? '≤' : '>'} ${toText(rem)}`,
        }));
        if (fits) lo = mid;
        else hi = mid - 1;
      }
      q[i] = lo;
      rem = subtractNumbers(rem, mulSmall(b, lo));
      frames.push(snap({ index: i, caption: `Блок частного ${lo}. Остаток ${toText(rem)}` }));
    }
    const check = last(addFrames(last(mulFrames(trim(q), b)).res, rem)).result;
    frames.push(snap({
      final: true,
      caption: `Частное ${toText(q)}, остаток ${toText(rem)}. Проверка: частное · делитель + остаток = ${toText(check)}`,
    }));
    return frames;
  }

  // ----- sorting -----

  function sortFrames(values, method) {
    const a = values.slice();
    const n = a.length;
    const done = new Set();
    const frames = [];
    const snap = (extra) => Object.assign({ a: a.slice(), done: [...done], pair: [] }, extra);
    frames.push(snap({ caption: `Исходный массив: ${a.join(', ')}` }));
    if (method === 'bubble') {
      for (let end = n - 1; end > 0; end--) {
        for (let j = 0; j < end; j++) {
          frames.push(snap({ pair: [j, j + 1], caption: `Сравниваем ${a[j]} и ${a[j + 1]}` }));
          if (a[j] > a[j + 1]) {
            frames.push(snap({ pair: [j, j + 1], caption: `${a[j]} > ${a[j + 1]}: меняем местами` }));
            [a[j], a[j + 1]] = [a[j + 1], a[j]];
            frames.push(snap({ pair: [j, j + 1], caption: `Теперь на месте ${j} число ${a[j]}, на месте ${j + 1} число ${a[j + 1]}` }));
          }
        }
        done.add(end);
        frames.push(snap({ caption: `Проход окончен: наибольшее ${a[end]} встало на своё место ${end}` }));
      }
    } else {
      for (let i = 0; i < n - 1; i++) {
        let m = i;
        for (let j = i + 1; j < n; j++) {
          frames.push(snap({ pair: [m, j], caption: `Ищем минимум: сравниваем ${a[j]} с текущим минимумом ${a[m]}` }));
          if (a[j] < a[m]) m = j;
        }
        if (m !== i) {
          frames.push(snap({ pair: [i, m], caption: `Минимум ${a[m]} меняем местами с ${a[i]}` }));
          [a[i], a[m]] = [a[m], a[i]];
        }
        done.add(i);
        frames.push(snap({ caption: `Место ${i} занято числом ${a[i]}` }));
      }
    }
    for (let i = 0; i < n; i++) done.add(i);
    frames.push(snap({ caption: `Готово: ${a.join(', ')}` }));
    return frames;
  }

  // ----- binary search -----

  function searchFrames(sorted, target) {
    const frames = [];
    let lo = 0;
    let hi = sorted.length - 1;
    const snap = (extra) => Object.assign({ a: sorted, lo, hi, mid: null, found: false }, extra);
    frames.push(snap({ caption: `Ищем число ${target} в отсортированном массиве из ${sorted.length} чисел` }));
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      frames.push(snap({ mid, caption: `Средний элемент a[${mid}] = ${sorted[mid]}` }));
      if (sorted[mid] === target) {
        frames.push(snap({ mid, found: true, caption: `Нашли: a[${mid}] = ${target}` }));
        return frames;
      }
      if (sorted[mid] < target) {
        lo = mid + 1;
        frames.push(snap({ caption: `${sorted[mid]} < ${target}: ищем справа, отрезок [${lo}..${hi}]` }));
      } else {
        hi = mid - 1;
        frames.push(snap({ caption: `${sorted[mid]} > ${target}: ищем слева, отрезок [${lo}..${hi}]` }));
      }
    }
    frames.push(snap({ caption: `Отрезок пуст: числа ${target} в массиве нет` }));
    return frames;
  }

  // ----- graph traversal -----

  const GRAPH = {
    edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [4, 6], [5, 6]],
    positions: [[160, 30], [80, 100], [240, 100], [40, 180], [120, 180], [200, 180], [280, 180]],
  };
  const ADJACENT = (() => {
    const list = GRAPH.positions.map(() => []);
    for (const [u, v] of GRAPH.edges) {
      list[u].push(v);
      list[v].push(u);
    }
    return list.map((neighbours) => neighbours.sort((x, y) => x - y));
  })();

  function bfsFrames(start) {
    const frames = [];
    const seen = GRAPH.positions.map(() => false);
    const order = [];
    const queue = [start];
    seen[start] = true;
    const snap = (extra) => Object.assign({ seen: seen.slice(), order: order.slice(), queue: queue.slice(), current: null, edge: null }, extra);
    frames.push(snap({ caption: `Начинаем с вершины ${start}: кладём её в очередь` }));
    while (queue.length) {
      const v = queue.shift();
      order.push(v);
      frames.push(snap({ current: v, caption: `Берём из очереди вершину ${v}` }));
      for (const u of ADJACENT[v]) {
        if (!seen[u]) {
          seen[u] = true;
          queue.push(u);
          frames.push(snap({ current: v, edge: [v, u], caption: `Сосед ${u} ещё не посещён: кладём его в очередь` }));
        }
      }
    }
    frames.push(snap({ caption: `Порядок обхода в ширину: ${order.join(' → ')}` }));
    return frames;
  }

  function dfsFrames(start) {
    const frames = [];
    const seen = GRAPH.positions.map(() => false);
    const order = [];
    const stack = [];
    const snap = (extra) => Object.assign({ seen: seen.slice(), order: order.slice(), queue: stack.slice(), current: null, edge: null }, extra);
    function visit(v) {
      seen[v] = true;
      order.push(v);
      stack.push(v);
      frames.push(snap({ current: v, caption: `Заходим в вершину ${v}` }));
      for (const u of ADJACENT[v]) {
        if (!seen[u]) {
          frames.push(snap({ current: v, edge: [v, u], caption: `Идём из ${v} в непосещённую вершину ${u}` }));
          visit(u);
          frames.push(snap({ current: v, caption: `Вернулись в вершину ${v}` }));
        }
      }
      stack.pop();
    }
    visit(start);
    frames.push(snap({ caption: `Порядок обхода в глубину: ${order.join(' → ')}` }));
    return frames;
  }

  // ----- complex numbers and the fast Fourier transform (used for multiplication) -----

  const magnitude = (z) => Math.hypot(z.re, z.im);

  const cx = {
    add: (x, y) => ({ re: x.re + y.re, im: x.im + y.im }),
    sub: (x, y) => ({ re: x.re - y.re, im: x.im - y.im }),
    mul: (x, y) => ({ re: x.re * y.re - x.im * y.im, im: x.re * y.im + x.im * y.re }),
  };

  function formatComplex(z) {
    const re = Math.abs(z.re) < 1e-9 ? 0 : z.re;
    const im = Math.abs(z.im) < 1e-9 ? 0 : z.im;
    return `${re.toFixed(1)}${im < 0 ? '−' : '+'}${Math.abs(im).toFixed(1)}i`;
  }

  function bitReversed(n) {
    const bits = Math.round(Math.log2(n));
    return Array.from({ length: n }, (_, i) => {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      return r;
    });
  }

  // Iterative FFT; every butterfly is reported to emit. sign is -1 for the forward and +1 for the inverse transform.
  function fftFrames(input, sign, title, emit) {
    const n = input.length;
    const a = bitReversed(n).map((k) => input[k]);
    emit({ points: a.slice(), active: [], caption: `${title}: переставляем коэффициенты в порядке битовой инверсии` });
    for (let len = 2; len <= n; len *= 2) {
      const half = len / 2;
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < half; k++) {
          const angle = (sign * 2 * Math.PI * k) / len;
          const w = { re: Math.cos(angle), im: Math.sin(angle) };
          const u = a[start + k];
          const v = cx.mul(a[start + k + half], w);
          a[start + k] = cx.add(u, v);
          a[start + k + half] = cx.sub(u, v);
          emit({
            points: a.slice(), active: [start + k, start + k + half], twiddle: w,
            caption: `${title}, отрезок длины ${len}: бабочка для k=${k}: ${formatComplex(u)} и ${formatComplex(v)} (с поворотом на ${formatComplex(w)})`,
          });
        }
      }
    }
    return a;
  }

  function convolutionFrames(aDigits, bDigits) {
    const frames = [];
    const size = 1 << Math.ceil(Math.log2(aDigits.length + bDigits.length));
    const pad = (digits) => Array.from({ length: size }, (_, i) => ({ re: digits[i] || 0, im: 0 }));
    // The FFT frames hold complex numbers; the page shows them as text.
    const emitComplex = (phase) => (f) => frames.push({ ...f, phase, values: f.points.map(formatComplex) });
    const polynomials = [{ name: 'A', coefficients: aDigits }, { name: 'B', coefficients: bDigits }];
    frames.push({ values: null, active: [], polynomials, caption:`Числа как многочлены по основанию 10: ${aDigits.join(' ')} и ${bDigits.join(' ')} (младшие разряды первыми). Дополняем нулями до N = ${size}` });
    const transformA = fftFrames(pad(aDigits), -1, 'FFT(A)', emitComplex('A'));
    const transformB = fftFrames(pad(bDigits), -1, 'FFT(B)', emitComplex('B'));
    const product = transformA.map((z, i) => cx.mul(z, transformB[i]));
    frames.push({ values: product.map(formatComplex), points: product, phase: 'product', active: [], caption: 'Поточечное умножение: C_k = A_k · B_k. Свёртка многочленов стала обычным умножением значений' });
    const inverse = fftFrames(product, 1, 'обратное FFT', emitComplex('inverse'));
    const coefficients = inverse.map((z) => Math.round(z.re / size));
    const coefficientTexts = coefficients.map(String);
    const realCoefficients = coefficients.map((c) => ({ re: c, im: 0 }));
    const polynomialOfProduct = [{ name: 'C', coefficients }];
    frames.push({ values: coefficientTexts, points: realCoefficients, phase: 'coefficients', polynomials: polynomialOfProduct, active: [], caption: `Делим на N = ${size} и округляем: коэффициенты c_k = ${coefficients.join(', ')}` });
    const digits = [];
    let carry = 0;
    coefficients.forEach((c, k) => {
      const carryIn = carry;
      const cur = c + carryIn;
      digits.push(cur % 10);
      carry = Math.floor(cur / 10);
      frames.push({ values: coefficientTexts, points: realCoefficients, phase: 'coefficients', active: [k], digits: digits.slice(), caption: `Разряд ${k}: ${c} + перенос ${carryIn} = ${cur}. Пишем ${cur % 10}, перенос ${carry}` });
    });
    while (carry > 0) {
      digits.push(carry % 10);
      carry = Math.floor(carry / 10);
    }
    const result = digits.slice().reverse().join('').replace(/^0+(?=\d)/, '');
    frames.push({ values: null, active: [], digits: digits.slice(), polynomials: polynomialOfProduct, caption: `Результат: ${result}` });
    // The frames of one phase share one scale, so that the plane does not jump between their steps.
    const radiusOf = {};
    for (const f of frames) {
      if (f.points) radiusOf[f.phase] = Math.max(radiusOf[f.phase] || 0, ...f.points.map(magnitude));
    }
    for (const f of frames) f.radius = Math.max(1, radiusOf[f.phase] || 0) * 1.15;
    return frames;
  }

  // ----- pictures of the frames -----

  function drawAddition(stage, f) {
    const width = Math.max(f.a.length, f.b.length) + 1;
    const active = f.active >= 0 ? [f.active] : [];
    drawRow(stage, 'A', widen(f.a, width), { active });
    drawRow(stage, 'B', widen(f.b, width), { active });
    drawRow(stage, 'Сумма', widen(f.result, width, ''), { active, hit: f.carry ? active : [] });
    if (f.carry) stage.append(el('p', 'viz-note', `перенос ${f.carry}`));
  }

  function drawMultiplication(stage, f) {
    const width = f.res.length;
    drawRow(stage, 'A', widen(f.a, width), { active: f.col === undefined ? [] : [f.col] });
    drawRow(stage, 'B', widen(f.b, width), { active: f.row === undefined ? [] : [f.row] });
    drawRow(stage, 'Произведение', f.res, { active: f.active });
  }

  function drawDivision(stage, f) {
    const width = Math.max(f.a.length, f.b.length);
    const active = f.index >= 0 ? [f.index] : [];
    drawRow(stage, 'Делимое A', widen(f.a, width), { active });
    drawRow(stage, 'Делитель B', widen(f.b, width));
    drawRow(stage, 'Остаток', widen(f.rem, width));
    drawRow(stage, 'Частное', widen(f.q, width), { active });
    if (f.trial !== undefined) stage.append(el('p', 'viz-note', `пробный блок ${f.trial}: ${f.fits ? 'подходит' : 'слишком большой'}`));
  }

  const LONG_OPERATIONS = {
    add: { run: addFrames, draw: drawAddition },
    mul: { run: mulFrames, draw: drawMultiplication },
    div: { run: divFrames, draw: drawDivision },
  };

  function drawBars(stage, f, max) {
    const bars = el('div', 'viz-bars');
    f.a.forEach((value, i) => {
      const cls = ['viz-bar', f.pair.includes(i) && 'viz-bar-pair', f.done.includes(i) && 'viz-bar-done'].filter(Boolean).join(' ');
      const bar = el('div', cls);
      bar.style.height = `${Math.max(4, (value / max) * 100)}%`;
      bar.append(el('span', 'viz-bar-value', String(value)));
      bars.append(bar);
    });
    stage.append(bars);
  }

  function drawSearch(stage, f) {
    const row = el('div', 'viz-search');
    f.a.forEach((value, i) => {
      const cell = el('div', 'viz-search-cell', String(value));
      if (i >= f.lo && i <= f.hi) cell.classList.add('viz-search-range');
      if (i === f.mid) cell.classList.add(f.found ? 'viz-search-found' : 'viz-search-mid');
      const marks = [i === f.lo && 'lo', i === f.hi && 'hi', i === f.mid && 'mid'].filter(Boolean).join(' ');
      const column = el('div', 'viz-search-column');
      column.append(cell, el('div', 'viz-search-pointer', marks));
      row.append(column);
    });
    stage.append(row);
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svgNode(tag, attributes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  function drawGraph(stage, f, isQueue) {
    const svg = svgNode('svg', { viewBox: '0 0 320 210', class: 'viz-graph' });
    for (const [u, v] of GRAPH.edges) {
      const [x1, y1] = GRAPH.positions[u];
      const [x2, y2] = GRAPH.positions[v];
      const hit = f.edge !== null && f.edge.includes(u) && f.edge.includes(v);
      svg.append(svgNode('line', { x1, y1, x2, y2, class: hit ? 'viz-edge viz-edge-hit' : 'viz-edge' }));
    }
    GRAPH.positions.forEach(([x, y], v) => {
      let cls = 'viz-node';
      if (v === f.current) cls += ' viz-node-current';
      else if (f.seen[v]) cls += ' viz-node-seen';
      const text = svgNode('text', { x, y: y + 5, 'text-anchor': 'middle' });
      text.textContent = String(v);
      svg.append(svgNode('circle', { cx: x, cy: y, r: 18, class: cls }), text);
    });
    stage.append(svg, el('p', 'viz-note', `${isQueue ? 'Очередь' : 'Стек'}: [${f.queue.join(', ')}]   Порядок: ${f.order.join(' → ') || '—'}`));
  }

  // A polynomial with the digits as coefficients, evaluated at x = 10, for example A(x) = 4 + 3 · x + 2 · x² + 1 · x³.
  function polynomialLine(name, coefficients) {
    const line = el('p', 'viz-formula', `${name}(x) = `);
    coefficients.forEach((c, k) => {
      if (k > 0) line.append(' + ');
      line.append(String(c));
      if (k >= 1) line.append(' · x');
      if (k >= 2) line.append(el('sup', null, String(k)));
    });
    const value = coefficients.reduceRight((total, c) => total * 10 + c, 0);
    line.append(`   при x = 10: ${name}(10) = ${value}`);
    return line;
  }

  // The complex plane: a point for every value, joined to the origin by a vector. The values taking part in
  // the step are yellow. The dashed circle has radius 1; a red vector shows the twiddle factor w.
  function drawPlane(stage, f) {
    const scale = 100 / f.radius; // pixels per unit; the picture edge is at ±1.2 · radius
    const x = (re) => 120 + re * scale;
    const y = (im) => 120 - im * scale;
    const svg = svgNode('svg', { viewBox: '0 0 240 240', class: 'viz-plane' });
    svg.append(
      svgNode('line', { x1: 0, y1: 120, x2: 240, y2: 120, class: 'viz-axis' }),
      svgNode('line', { x1: 120, y1: 0, x2: 120, y2: 240, class: 'viz-axis' }),
      svgNode('circle', { cx: 120, cy: 120, r: scale, class: 'viz-circle' }),
    );
    f.points.forEach((z, k) => {
      if (magnitude(z) < 1e-9) return; // zero values lie at the origin and are not drawn
      const active = f.active.includes(k);
      svg.append(
        svgNode('line', { x1: 120, y1: 120, x2: x(z.re), y2: y(z.im), class: active ? 'viz-vector viz-vector-active' : 'viz-vector' }),
        svgNode('circle', { cx: x(z.re), cy: y(z.im), r: 4, class: active ? 'viz-point viz-point-active' : 'viz-point' }),
      );
      const label = svgNode('text', { x: x(z.re) + 6, y: y(z.im) - 6 });
      label.textContent = String(k);
      svg.append(label);
    });
    if (f.twiddle) {
      svg.append(svgNode('line', { x1: 120, y1: 120, x2: x(f.twiddle.re), y2: y(f.twiddle.im), class: 'viz-twiddle' }));
    }
    const edge = svgNode('text', { x: 4, y: 14 });
    edge.textContent = `±${(1.2 * f.radius).toFixed(1)}`;
    svg.append(edge);
    stage.append(svg, el('p', 'viz-note', 'Комплексная плоскость: горизонталь — действительная часть, вертикаль — мнимая. Точка — значение, число у точки — его индекс. Жёлтым выделены участвующие в шаге; пунктир — единичная окружность; красная стрелка — поворот w на ней.'));
  }

  function drawConvolution(stage, f) {
    for (const { name, coefficients } of f.polynomials || []) stage.append(polynomialLine(name, coefficients));
    if (f.values) drawRow(stage, 'значения', f.values, { active: f.active, leftToRight: true });
    if (f.points) drawPlane(stage, f);
    if (f.digits) drawRow(stage, 'разряды', f.digits, { active: f.active });
  }

  // ----- mounting: each function builds the controls of one visualization on a page -----

  function mountLong(root) {
    const a = field('Число A', '12345678901234567890', 40);
    const b = field('Число B', '9876543210', 40);
    const op = select('Операция', [['add', 'сложение A + B'], ['mul', 'умножение A · B'], ['div', 'деление A : B']]);
    const output = mountTool(root, [a.wrap, b.wrap, op.wrap]);

    function go() {
      const first = a.input.value.trim();
      const second = b.input.value.trim();
      if (!/^\d{1,40}$/.test(first) || !/^\d{1,40}$/.test(second)) {
        showError(output, 'Введите неотрицательные целые числа: до 40 цифр, без пробелов.');
        return;
      }
      const x = toBlocks(first);
      const y = toBlocks(second);
      if (op.input.value === 'div' && compare(y, [0]) === 0) {
        showError(output, 'На ноль делить нельзя: введите ненулевой делитель B.');
        return;
      }
      const { run, draw } = LONG_OPERATIONS[op.input.value];
      replacePlayer(output, run(x, y), draw);
    }

    for (const control of [a.input, b.input, op.input]) control.addEventListener('input', go);
    go();
  }

  function mountSort(root) {
    const input = field('Числа через пробел', '5 3 8 1 9 2 7', 60);
    const method = select('Алгоритм', [['bubble', 'пузырьком'], ['selection', 'выбором']]);
    const output = mountTool(root, [input.wrap, method.wrap]);

    function go() {
      const values = parseNumbers(input.input.value);
      if (!values.length || values.some((v) => !Number.isInteger(v) || v < 0 || v > 99)) {
        showError(output, 'Введите целые числа от 0 до 99 через пробел.');
        return;
      }
      const max = Math.max(...values, 1);
      replacePlayer(output, sortFrames(values, method.input.value), (stage, f) => drawBars(stage, f, max));
    }

    for (const control of [input.input, method.input]) control.addEventListener('input', go);
    go();
  }

  function mountSearch(root) {
    const list = field('Отсортированный массив', '1 3 5 7 9 11 13 15 17 19', 80);
    const target = field('Ищем число', '11', 6);
    const output = mountTool(root, [list.wrap, target.wrap]);

    function go() {
      const values = parseNumbers(list.input.value);
      const keyText = target.input.value.trim();
      if (!values.length || !values.every(Number.isInteger) || !/^-?\d+$/.test(keyText)) {
        showError(output, 'Введите целые числа через пробел.');
        return;
      }
      const sorted = values.slice().sort((p, q) => p - q);
      replacePlayer(output, searchFrames(sorted, Number(keyText)), drawSearch);
    }

    for (const control of [list.input, target.input]) control.addEventListener('input', go);
    go();
  }

  function mountGraph(root) {
    const method = select('Обход', [['bfs', 'в ширину (очередь)'], ['dfs', 'в глубину (стек вызовов)']]);
    const start = select('Начальная вершина', GRAPH.positions.map((_, v) => [String(v), String(v)]));
    const output = mountTool(root, [method.wrap, start.wrap]);

    function go() {
      const isQueue = method.input.value === 'bfs';
      const from = Number(start.input.value);
      const frames = isQueue ? bfsFrames(from) : dfsFrames(from);
      replacePlayer(output, frames, (stage, f) => drawGraph(stage, f, isQueue));
    }

    for (const control of [method.input, start.input]) control.addEventListener('input', go);
    go();
  }

  function mountFFT(root) {
    const a = field('Число A (до 4 цифр)', '1234', 4);
    const b = field('Число B (до 4 цифр)', '5678', 4);
    const output = mountTool(root, [a.wrap, b.wrap]);

    function go() {
      const first = a.input.value.trim();
      const second = b.input.value.trim();
      if (!/^\d{1,4}$/.test(first) || !/^\d{1,4}$/.test(second)) {
        showError(output, 'Введите числа из 1–4 цифр: так схема остаётся наглядной.');
        return;
      }
      const digitsOf = (text) => text.split('').reverse().map(Number);
      replacePlayer(output, convolutionFrames(digitsOf(first), digitsOf(second)), drawConvolution);
    }

    for (const control of [a.input, b.input]) control.addEventListener('input', go);
    go();
  }

  const MOUNTS = {
    longarith: mountLong,
    sort: mountSort,
    binsearch: mountSearch,
    graph: mountGraph,
    fft: mountFFT,
  };

  document.querySelectorAll('.viz[data-viz]').forEach((root) => {
    const mount = MOUNTS[root.dataset.viz];
    if (mount) mount(root);
  });

  // Exposed for the tests of the arithmetic.
  window.VizLongArithmetic = { toBlocks, toText, addFrames, mulFrames, divFrames };
})();
