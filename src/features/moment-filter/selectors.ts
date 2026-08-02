export const MOMENT_PAGE_ROOT_SELECTOR = '.bili-dyn-home--member, .bili-dyn-home--visitor'
export const MOMENT_LIST_SELECTOR = '.bili-dyn-list__items'
export const MOMENT_CARD_SELECTOR = '.bili-dyn-list__item'
export const MOMENT_AUTHOR_SELECTOR = '.bili-dyn-title__text, .bili-dyn-title'
export const MOMENT_AUTHOR_LINK_SELECTOR = 'header a[href*="space.bilibili.com/"], .bili-dyn-item__header a[href*="space.bilibili.com/"]'
export const MOMENT_CONTENT_SELECTORS = [
  '.dyn-card-opus__summary',
  '.bili-dyn-card-link-common__detail__title',
  '.bili-dyn-card-video__title',
] as const

export const MOMENT_COMMERCIAL_SIGNAL_SELECTORS = {
  'goods-card': '.bili-dyn-card-goods, .bili-dyn-content__orig__goods',
  'ad-card': '[data-dyn-card-type="ad"], .bili-dyn-item__ad',
  'paid-promotion-label': '[aria-label="广告"], [aria-label="推广"], [aria-label="Advertisement"], [aria-label="Paid promotion"]',
} as const
