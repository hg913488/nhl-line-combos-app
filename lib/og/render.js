// Satori (layout) -> resvg (raster) -> PNG, with an optional baseline-JPEG
// encode for Instagram, which only accepts JPEG.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import jpeg from 'jpeg-js';
import { SATORI_FONTS } from './assets.js';

const JPEG_QUALITY = 90;

/**
 * Renders an element tree to image bytes.
 * @param {object} element Satori element tree
 * @param {{width: number, height: number, format?: 'png'|'jpg'}} options
 * @returns {Promise<{body: Buffer, contentType: string}>}
 */
export async function renderCard(element, { width, height, format = 'png' }) {
  const svg = await satori(element, { width, height, fonts: SATORI_FONTS });
  const rendered = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: false },
    background: '#17191D',
  }).render();

  if (format === 'jpg') {
    const { data } = jpeg.encode({ data: rendered.pixels, width: rendered.width, height: rendered.height }, JPEG_QUALITY);
    return { body: data, contentType: 'image/jpeg' };
  }
  return { body: rendered.asPng(), contentType: 'image/png' };
}
