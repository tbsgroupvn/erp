/**
 * Content script for 1688.com product pages.
 * Scrapes product info and provides a floating "Add to ERP" button.
 */

import type { ScrapedProduct } from '../types';
import {
  queryText,
  queryImages,
  parsePrice,
  waitForElement,
  type SelectorMap,
} from './shared/scrape-engine';
import {
  createFloatingButton,
  showButtonSuccess,
  showButtonError,
} from './shared/floating-button';

const SELECTORS: SelectorMap = {
  title: [
    'h1.title-text',
    '.mod-detail-title h1',
    '.d-title',
    '[class*="title-text"]',
    '.offer-title-text',
    'h1',
  ],
  price: [
    '.price-text',
    '.price-original-text',
    '[class*="priceText"]',
    '.ladder-price-text',
    '.price-length-5',
    '.price-length-4',
    '.price-length-3',
  ],
  images: [
    '.detail-gallery img',
    '.tab-pane img[data-src]',
    '.gallery-image img',
    '.detail-gallery-turn img',
    '.offer-details-img img',
    '.detail-main-image img',
  ],
  shopName: [
    '.company-name a',
    '.shop-name',
    '.company-name',
    '[class*="companyName"]',
  ],
};

async function scrapeProduct(): Promise<ScrapedProduct> {
  // Wait for title to appear (SPA rendering)
  await waitForElement(SELECTORS.title, 8000);

  const title = queryText(SELECTORS.title) || '';
  const priceText = queryText(SELECTORS.price);
  const price = parsePrice(priceText);
  const images = queryImages(SELECTORS.images);
  const shopName = queryText(SELECTORS.shopName);

  return {
    title,
    price,
    priceCurrency: 'CNY',
    imageUrl: images[0] || null,
    productUrl: window.location.href,
    shopName,
    specs: null,
    source: '1688',
    scrapedAt: new Date().toISOString(),
  };
}

async function handleAddToCart() {
  const btn = document.getElementById('tbs-erp-floating-btn') as HTMLButtonElement | null;

  try {
    const product = await scrapeProduct();

    if (!product.title) {
      if (btn) showButtonError(btn, 'Không tìm thấy tên SP');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'ADD_TO_CART',
      payload: product,
    });

    if (response?.success) {
      if (btn) showButtonSuccess(btn);
    } else {
      if (btn) showButtonError(btn, response?.error || 'Lỗi');
    }
  } catch (error) {
    console.error('[TBS ERP] Scrape error:', error);
    if (btn) showButtonError(btn, 'Lỗi scrape');
  }
}

// Initialize: wait for page to load, then show button
async function init() {
  // Wait a bit for SPA to render
  await waitForElement(SELECTORS.title, 10000);
  createFloatingButton(handleAddToCart);
}

init();
