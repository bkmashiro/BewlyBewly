<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { BewlyPage } from '../types'

const { t } = useI18n()

const activePage = ref<BewlyPage>(BewlyPage.Home)

const pages = [
  {
    value: BewlyPage.Home,
    title: t('settings.menu_home'),
    icon: 'i-mingcute:home-5-line',
    iconActivated: 'i-mingcute:home-5-fill',
    component: defineAsyncComponent(() => import('./Home/Home.vue')),
  },
  {
    value: BewlyPage.Search,
    title: t('settings.menu_search_page'),
    icon: 'i-mingcute:search-2-line',
    iconActivated: 'i-mingcute:search-2-fill',
    component: defineAsyncComponent(() => import('./SearchPage/SearchPage.vue')),
  },
  {
    value: BewlyPage.Moments,
    title: t('settings.menu_moments_filter'),
    icon: 'i-mingcute:filter-2-line',
    iconActivated: 'i-mingcute:filter-2-fill',
    component: defineAsyncComponent(() => import('./Moments/Moments.vue')),
  },
]
</script>

<template>
  <div class="bewly-pages-layout">
    <nav class="bewly-pages-nav" :aria-label="$t('settings.menu_bewly_pages')">
      <ul>
        <li v-for="page in pages" :key="page.value">
          <button
            type="button"
            :class="{ active: activePage === page.value }"
            :aria-current="activePage === page.value ? 'page' : undefined"
            @click="activePage = page.value"
          >
            <span :class="activePage === page.value ? page.iconActivated : page.icon" class="page-icon" />
            <span>{{ page.title }}</span>
          </button>
        </li>
      </ul>
    </nav>

    <div class="bewly-pages-content">
      <Transition name="page-fade">
        <Component :is="pages.find(page => page.value === activePage)?.component" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.bewly-pages-layout {
  display: flex;
  gap: 8px;
}

.bewly-pages-nav {
  width: 140px;
  flex: 0 0 140px;
}

.bewly-pages-nav ul {
  position: fixed;
  display: flex;
  width: 140px;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.bewly-pages-nav button {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  padding: 8px 16px;
  border: 0;
  border-radius: var(--bew-radius);
  color: inherit;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: background-color 0.2s ease;
}

.bewly-pages-nav button:hover {
  background: var(--bew-fill-2);
}

.bewly-pages-nav button.active {
  background: var(--bew-fill-3);
}

.bewly-pages-nav button:focus-visible {
  outline: 2px solid var(--bew-theme-color);
  outline-offset: 2px;
}

.page-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex: 0 0 auto;
  margin-inline-end: 8px;
  font-size: 1.125rem;
}

.bewly-pages-content {
  min-width: 0;
  flex: 1;
  padding: 16px;
}

@media (max-width: 600px) {
  .bewly-pages-layout {
    flex-direction: column;
  }

  .bewly-pages-nav {
    width: 100%;
    flex-basis: auto;
  }

  .bewly-pages-nav ul {
    position: static;
    width: 100%;
    flex-flow: row wrap;
  }

  .bewly-pages-nav li {
    flex: 1 1 110px;
  }

  .bewly-pages-nav button {
    justify-content: center;
    padding-inline: 10px;
  }

  .bewly-pages-content {
    padding: 8px 0 0;
  }
}
</style>
