const { test, expect } = require('@playwright/test');

// The segment tree picture on the lesson about segment trees (js/viz.js, mountSegtree).
const LESSON = '/s5/segments_tree.html';
const TREE = '.viz[data-viz="segtree"]';

// Collects the JavaScript errors of the page; the test fails if the picture raises any.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

// Moves the player to its last frame, where the result is shown.
async function playToEnd(section) {
  const next = section.getByRole('button', { name: 'вперёд' });
  while (await next.isEnabled()) await next.click();
}

test('the segment tree is drawn with 15 vertices for the default array', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(TREE);
  await expect(section.locator('.viz-player')).toHaveCount(1);
  await expect(section.locator('svg.viz-seg rect')).toHaveCount(15);
  await expect(section.locator('.viz-seg-hint')).toBeHidden();
  await expect(section.locator('.viz-caption')).toContainText('корень tree[1] = сумма всех элементов = 30');
  expect(errors).toEqual([]);
});

test('building the tree step by step starts from the leaves', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(TREE);
  await section.getByRole('button', { name: 'Построить дерево' }).click();
  await expect(section.locator('.viz-caption')).toContainText('Листья — элементы массива');
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('корень tree[1] = сумма всех элементов = 30');
  expect(errors).toEqual([]);
});

test('the sum on [1..5] of the default array is 21', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(TREE);
  await section.locator('input').nth(1).fill('1');
  await section.locator('input').nth(2).fill('5');
  await section.getByRole('button', { name: 'Сумма на [l..r]' }).click();
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('Ответ: сумма на [1..5] = 21');
  expect(errors).toEqual([]);
});

test('setting a[2] = 10 makes the root 33', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(TREE);
  await section.locator('input').nth(3).fill('2');
  await section.locator('input').nth(4).fill('10');
  await section.getByRole('button', { name: 'Присвоить a[i] = x' }).click();
  await playToEnd(section);
  await expect(section.locator('.viz-caption')).toContainText('корень tree[1] = 33');
  expect(errors).toEqual([]);
});

test('a segment outside the array is reported, not drawn', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(LESSON);
  const section = page.locator(TREE);
  await section.locator('input').nth(2).fill('9');
  await section.getByRole('button', { name: 'Сумма на [l..r]' }).click();
  await expect(section.locator('.viz-error')).toContainText('Отрезок должен лежать внутри массива');
  expect(errors).toEqual([]);
});

test('the frames agree with plain sums in the browser', async ({ page }) => {
  await page.goto(LESSON);
  const mismatches = await page.evaluate(() => {
    const S = window.VizSegmentTree;
    const last = (frames) => frames[frames.length - 1];
    const bad = [];
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + Math.floor(Math.random() * 8);
      const plain = Array.from({ length: n }, () => Math.floor(Math.random() * 61) - 30);
      const built = S.segBuildFrames(plain);
      let state = { size: built.size, n, tree: built.tree };
      for (let step = 0; step < 8; step++) {
        if (Math.random() < 0.5) {
          const pos = Math.floor(Math.random() * n);
          const x = Math.floor(Math.random() * 61) - 30;
          state = { size: state.size, n, tree: S.segUpdateFrames(state, pos, x).tree };
          plain[pos] = x;
        } else {
          const l = Math.floor(Math.random() * n);
          const r = l + Math.floor(Math.random() * (n - l));
          const sum = plain.slice(l, r + 1).reduce((a, b) => a + b, 0);
          if (last(S.segQueryFrames(state, l, r)).answer !== sum) bad.push(`query ${plain} ${l} ${r}`);
        }
      }
      if (state.tree[1] !== plain.reduce((a, b) => a + b, 0)) bad.push(`root ${plain}`);
    }
    return bad;
  });
  expect(mismatches).toEqual([]);
});

// On a phone the picture is wider than its stage, so the stage scrolls it to keep the vertex of each step in view.
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // The vertex of the current step: whether the step has one, and whether it lies inside the visible part of the stage.
  async function currentState(section) {
    return section.evaluate((root) => {
      const current = root.querySelector('rect.viz-seg-current');
      if (!current) return { hasCurrent: false, inView: true };
      const stage = root.querySelector('.viz-stage').getBoundingClientRect();
      const box = current.getBoundingClientRect();
      return { hasCurrent: true, inView: box.left >= stage.left && box.right <= stage.right };
    });
  }

  test('the root is in view when the page opens, and the page does not scroll sideways', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(LESSON);
    const section = page.locator(TREE);
    await expect(section.locator('.viz-seg-hint')).toBeVisible();
    await expect.poll(async () => (await currentState(section)).inView).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    expect(errors).toEqual([]);
  });

  test('every step of building, querying and updating keeps its vertex in view', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(LESSON);
    const section = page.locator(TREE);
    const next = section.getByRole('button', { name: 'вперёд' });
    // Steps forward to the last frame and checks the vertex of every frame on the way. The walk must meet at least
    // one frame with a current vertex, so that the check cannot pass without looking at any vertex.
    async function walkThrough() {
      let withVertex = 0;
      const check = async () => {
        await expect.poll(async () => (await currentState(section)).inView).toBe(true);
        if ((await currentState(section)).hasCurrent) withVertex += 1;
      };
      await check();
      while (await next.isEnabled()) {
        await next.click();
        await check();
      }
      expect(withVertex).toBeGreaterThan(0);
    }
    // Each action restarts the player at its first step; this shows that the button did something.
    await section.getByRole('button', { name: 'Построить дерево' }).click();
    await expect(section.locator('.viz-counter')).toContainText('Шаг 1 из');
    await walkThrough();
    await section.locator('input').nth(1).fill('1');
    await section.locator('input').nth(2).fill('5');
    await section.getByRole('button', { name: 'Сумма на [l..r]' }).click();
    await expect(section.locator('.viz-counter')).toContainText('Шаг 1 из');
    await walkThrough();
    await section.locator('input').nth(3).fill('2');
    await section.locator('input').nth(4).fill('10');
    await section.getByRole('button', { name: 'Присвоить a[i] = x' }).click();
    await expect(section.locator('.viz-counter')).toContainText('Шаг 1 из');
    await walkThrough();
    expect(errors).toEqual([]);
  });

  test('after a resize the current vertex stays in view', async ({ page }) => {
    const errors = trackErrors(page);
    // Open on a wide screen, where the picture fits, then narrow the window without a new step.
    await page.setViewportSize({ width: 844, height: 844 });
    await page.goto(LESSON);
    const section = page.locator(TREE);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await currentState(section)).inView).toBe(true);
    expect(errors).toEqual([]);
  });
});
