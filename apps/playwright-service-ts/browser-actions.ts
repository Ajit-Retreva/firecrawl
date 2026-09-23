import { Page } from 'playwright';

export type ScreenshotOptions = {
  fullPage?: boolean;
  quality?: number;
  viewport?: { width: number; height: number };
};
export type Action = ScreenshotOptions & {
  type: string;
  selector?: string;
  milliseconds?: number;
  all?: boolean;
  text?: string;
  key?: string;
  direction?: 'up' | 'down';
  script?: string;
  landscape?: boolean;
  scale?: number;
  format?: string;
};
export const actionTypes = new Set([
  'wait', 'click', 'write', 'press', 'scroll', 'scrape',
  'screenshot', 'executeJavascript', 'pdf',
]);

export async function takeScreenshot(page: Page, options: ScreenshotOptions) {
  if (options.viewport) await page.setViewportSize(options.viewport);
  const type = options.quality === undefined ? 'png' : 'jpeg';
  const buffer = await page.screenshot({ type, fullPage: options.fullPage ?? false, quality: options.quality });
  return `data:image/${type};base64,${buffer.toString('base64')}`;
}

export async function runActions(page: Page, actions: Action[]) {
  const results = {
    screenshots: [] as string[],
    scrapes: [] as { url: string; html: string }[],
    javascriptReturns: [] as { type: string; value: unknown }[],
    pdfs: [] as string[],
  };
  for (const action of actions) {
    switch (action.type) {
      case 'wait':
        if (action.selector !== undefined) await page.locator(action.selector).first().waitFor();
        else await page.waitForTimeout(action.milliseconds!);
        break;
      case 'click': {
        const locator = page.locator(action.selector!);
        if (action.all) {
          await locator.first().waitFor();
          for (const element of await locator.all()) await element.click();
        } else await locator.first().click();
        break;
      }
      case 'write': await page.keyboard.insertText(action.text!); break;
      case 'press': await page.keyboard.press(action.key!); break;
      case 'scroll': {
        const delta = action.direction === 'up' ? -1 : 1;
        if (action.selector) {
          await page.locator(action.selector).first().evaluate((element, direction) => {
            element.scrollBy(0, direction * element.clientHeight);
          }, delta);
        } else await page.evaluate(direction => window.scrollBy(0, direction * window.innerHeight), delta);
        break;
      }
      case 'scrape': results.scrapes.push({ url: page.url(), html: await page.content() }); break;
      case 'screenshot': results.screenshots.push(await takeScreenshot(page, action)); break;
      case 'executeJavascript': {
        // Runs inside the isolated target page, never in the Node process.
        const result = await page.evaluate(script =>
          Promise.resolve(new Function(script)()).then(value => ({
            type: typeof value, value: value === undefined ? null : value,
          })), action.script!);
        results.javascriptReturns.push(result);
        break;
      }
      case 'pdf': {
        const buffer = await page.pdf({
          landscape: action.landscape, scale: action.scale,
          format: action.format ?? 'Letter', printBackground: true,
        });
        results.pdfs.push(`data:application/pdf;base64,${buffer.toString('base64')}`);
        break;
      }
      default: throw new Error(`Unsupported action: ${action.type}`);
    }
  }
  return results;
}
