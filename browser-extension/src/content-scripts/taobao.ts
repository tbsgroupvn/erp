/**
 * Content script for taobao.com and tmall.com product pages.
 * Scrapes product info and provides a floating "Add to ERP" button.
 *
 * Note: Taobao DOM changes frequently; selectors may need updates.
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
    '.tb-main-title',
    'h3[data-title]',
    '[class*="mainTitle"]',
    '.ItemHeader--mainTitle',
    'h1',
    '#J_Title h3',
    '.tm-main-title',
  ],
  price: [
    '.tb-rmb-num',
    '[class*="priceText"]',
    '.tm-price',
    '.tm-promo-price .tm-price',
    '.Price--priceText',
    '#J_PromoPriceNum',
    '.tb-rmb',
  ],
  images: [
    '#J_UlThumb img',
    '[class*="thumbnail"] img',
    '.tb-thumb img',
    '.PicGallery--thumbnails img',
    '#J_ImgBooth',
    '.tm-gallery img',
  ],
  shopName: [
    '.tb-seller-name',
    '[class*="shopName"]',
    '.ShopHeader--title',
    '.shop-name a',
    '#J_ShopInfo a',
  ],
};

async function scrapeProduct(): Promise<ScrapedProduct> {
  // Wait for title to appear (SPA rendering)
  await waitForElement(SELECTORS.title, 10000);

  const title = queryText(SELECTORS.title) || '';
  const priceText = queryText(SELECTORS.price);
  const price = parsePrice(priceText);
  const images = queryImages(SELECTORS.images);
  const shopName = queryText(SELECTORS.shopName);

  // Determine source
  const isTmall = window.location.hostname.includes('tmall');
  const source = isTmall ? 'tmall' as const : 'taobao' as const;

  return {
    title,
    price,
    priceCurrency: 'CNY',
    imageUrl: images[0] || null,
    productUrl: window.location.href,
    shopName,
    specs: null,
    source: source as 'taobao', // tmall shares taobao type
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

// Initialize
async function init() {
  await waitForElement(SELECTORS.title, 12000);
  createFloatingButton(handleAddToCart);
}

init();
