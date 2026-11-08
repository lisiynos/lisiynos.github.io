const { test, expect } = require('@playwright/test');

const LESSON = '/s4/geom.html';
const WIDGET = '.viz[data-viz="orientation"]';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.geometryErrors = errors;
  await page.goto(LESSON);
});

test.afterEach(async ({ page }) => {
  expect(page.geometryErrors).toEqual([]);
});

test('orientation starts with the left example and an accessible coordinate diagram', async ({ page }) => {
  const widget = page.locator(WIDGET);
  await expect(widget.getByRole('textbox', { name: 'B: x', exact: true })).toHaveValue('2');
  await expect(widget.getByRole('textbox', { name: 'B: y', exact: true })).toHaveValue('2');
  await expect(widget.getByRole('combobox', { name: 'Пример', exact: true })).toHaveValue('left');
  await expect(widget.getByRole('img', { name: /Ориентация/ })).toBeVisible();
  await expect(widget.locator('.viz-caption')).toContainText('4 · (2) = 8');
  await expect(widget.locator('.viz-caption')).toContainText('слева');
  await expect(widget.locator('.viz-output .viz-note')).toContainText('Принадлежность отрезку OA: нет');
});

test('examples distinguish left, right, on-segment and collinear outside', async ({ page }) => {
  const widget = page.locator(WIDGET);
  const example = widget.getByRole('combobox', { name: 'Пример', exact: true });
  for (const [preset, x, y, product, orientation, belongs] of [
    ['right', 2, -2, -8, 'справа', 'нет'],
    ['on-segment', 2, 0, 0, 'коллинеарна', 'да'],
    ['outside', 6, 0, 0, 'коллинеарна', 'нет'],
    ['left', 2, 2, 8, 'слева', 'нет'],
  ]) {
    await example.selectOption(preset);
    await expect(widget.getByRole('textbox', { name: 'B: x', exact: true })).toHaveValue(String(x));
    await expect(widget.getByRole('textbox', { name: 'B: y', exact: true })).toHaveValue(String(y));
    await expect(widget.locator('.viz-caption')).toContainText(`4 · (${y}) = ${product}`);
    await expect(widget.locator('.viz-caption')).toContainText(orientation);
    await expect(widget.locator('.viz-output .viz-note')).toContainText(`Принадлежность отрезку OA: ${belongs}`);
    if (preset === 'outside') {
      await expect(widget.locator('.viz-output .viz-note')).toContainText('Коллинеарности недостаточно');
    }
  }
});

test('every supported integer point has exact arithmetic and the correct plotted position', async ({ page }) => {
  const widget = page.locator(WIDGET);
  const xInput = widget.getByRole('textbox', { name: 'B: x', exact: true });
  const yInput = widget.getByRole('textbox', { name: 'B: y', exact: true });
  for (let x = -1; x <= 6; x++) {
    await xInput.fill(String(x));
    for (let y = -2; y <= 3; y++) {
      await yInput.fill(String(y));
      await expect(widget.locator('.viz-caption')).toContainText(`4 · (${y}) = ${4 * y}`);
      await expect(widget.locator('.viz-caption')).toContainText(y > 0 ? 'слева' : y < 0 ? 'справа' : 'коллинеарна');
      const belongs = y === 0 && x >= 0 && x <= 4;
      await expect(widget.locator('.viz-output .viz-note')).toContainText(`Принадлежность отрезку OA: ${belongs ? 'да' : 'нет'}`);
      const points = await widget.locator('svg').evaluate((svg) => {
        const point = (name) => {
          const node = svg.querySelector(`[data-point="${name}"]`);
          return [Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))];
        };
        const labels = [...svg.querySelectorAll('text')].map((node) => {
          const box = node.getBBox();
          return { text: node.textContent, left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
        });
        const overlaps = [];
        for (let i = 0; i < labels.length; i++) {
          for (const other of labels.slice(i + 1)) {
            const label = labels[i];
            if (label.left < other.right && other.left < label.right && label.top < other.bottom && other.top < label.bottom) {
              overlaps.push([label.text, other.text]);
            }
          }
        }
        const o = point('O');
        const axes = [...svg.querySelectorAll('line[stroke="#778"]')];
        return {
          o, a: point('A'), b: point('B'), overlaps,
          labelsFit: labels.every((box) => box.left >= 0 && box.top >= 0 && box.right <= 420 && box.bottom <= 300),
          horizontalAxis: axes.some((axis) => Number(axis.getAttribute('y1')) === o[1] && Number(axis.getAttribute('y2')) === o[1] && Number(axis.getAttribute('x1')) < o[0] && Number(axis.getAttribute('x2')) > o[0]),
          verticalAxis: axes.some((axis) => Number(axis.getAttribute('x1')) === o[0] && Number(axis.getAttribute('x2')) === o[0] && Number(axis.getAttribute('y1')) > o[1] && Number(axis.getAttribute('y2')) < o[1]),
        };
      });
      const unit = (points.a[0] - points.o[0]) / 4;
      expect(unit).toBeGreaterThan(0);
      expect(points.a[1]).toBe(points.o[1]);
      expect(points.b).toEqual([points.o[0] + unit * x, points.o[1] - unit * y]);
      expect(points.overlaps).toEqual([]);
      expect(points.labelsFit).toBe(true);
      expect(points.horizontalAxis).toBe(true);
      expect(points.verticalAxis).toBe(true);
    }
  }
});

test('invalid coordinates show errors and recover on input or preset changes', async ({ page }) => {
  const widget = page.locator(WIDGET);
  const xInput = widget.getByRole('textbox', { name: 'B: x', exact: true });
  const yInput = widget.getByRole('textbox', { name: 'B: y', exact: true });
  for (const [input, invalid] of [[xInput, '-2'], [xInput, '7'], [xInput, '1.5'], [xInput, ''], [yInput, '-3'], [yInput, '4'], [yInput, '0.5'], [yInput, ''], [xInput, 'abc']]) {
    await input.fill(invalid);
    await expect(widget.locator('.viz-error')).toContainText('Введите целые координаты');
    await expect(widget.locator('svg')).toHaveCount(0);
    await input.fill('2');
    await expect(widget.locator('.viz-error')).toHaveCount(0);
    await expect(widget.getByRole('img', { name: /Ориентация/ })).toBeVisible();
  }
  await xInput.fill('');
  await widget.getByRole('combobox', { name: 'Пример', exact: true }).selectOption('on-segment');
  await expect(widget.locator('.viz-error')).toHaveCount(0);
  await expect(widget.locator('.viz-output .viz-note')).toContainText('Принадлежность отрезку OA: да');
});

test('the orientation diagram and controls fit a 390px phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const widget = page.locator(WIDGET);
  await expect(widget.getByRole('img', { name: /Ориентация/ })).toBeVisible();
  await widget.getByRole('combobox', { name: 'Пример', exact: true }).selectOption('outside');
  const layout = await widget.evaluate((root) => {
    const bounds = root.getBoundingClientRect();
    const children = [...root.querySelectorAll('input, select, svg')].map((node) => node.getBoundingClientRect());
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      widgetOverflow: root.scrollWidth - root.clientWidth,
      controlsFit: children.every((box) => box.left >= bounds.left && box.right <= bounds.right),
    };
  });
  expect(layout).toEqual({ pageOverflow: 0, widgetOverflow: 0, controlsFit: true });
});
