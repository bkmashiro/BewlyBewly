import { settings } from '~/logic'
import { isVerticalVideo } from '~/utils/uriParse'

function get(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((value, part) => {
    if (typeof value !== 'object' || value === null)
      return undefined
    return Reflect.get(value, part)
  }, obj)
}

export enum FilterType {
  filterOutVerticalVideos,
  viewCount,
  viewCountStr,
  duration,
  title,
  user,
}

type FilterValue = number | string | undefined
type FilterFunction = (item: object, keyPath: string[], filterValue: FilterValue) => boolean

type FuncMap = { [key in FilterType]: {
  func: FilterFunction
  enabledKey: string
  valueKey: string
} }

type KeyPath = Array<string>[]

export function useFilter(isFollowedKeyPath: string[], filterOpt: FilterType[], keyList: KeyPath) {
  function filterOutVerticalVideos(item: object, keyPath: string[], _filterValue: FilterValue) {
    const value = get(item, keyPath)
    return typeof value !== 'string' || !isVerticalVideo(value)
  }

  /**
   * Compares a number value in an object with a filter value.
   * Return `true` if the number value is greater than the filter value, `false` otherwise.
   *
   * @param item - The object containing the number value.
   * @param keyPath - The path to the number value in the object.
   * @param filterValue - The filter value to compare with.
   * @returns `true` if the number value is greater than the filter value, `false` otherwise.
   */
  function compareNumber(item: object, keyPath: string[], filterValue: FilterValue) {
    const numericValue = Number(get(item, keyPath))
    const numericFilterValue = Number(filterValue)
    return !Number.isNaN(numericValue) && !Number.isNaN(numericFilterValue) && numericValue > numericFilterValue
  }

  /**
   * Compares a number or number string with a filter value.
   * @param item - The object to compare.
   * @param keyPath - The path to the property in the object.
   * @param filterValue - The value to compare against.
   * @returns `true` if the value is greater than the filter value, `false` otherwise.
   */
  function compareNumberString(item: object, keyPath: string[], filterValue: FilterValue) {
    const value = get(item, keyPath)
    const numericFilterValue = Number(filterValue)

    if (Number.isNaN(numericFilterValue))
      return false

    // for example: `1.2万`, `1.2萬`, `-` (indicates no data)
    if (typeof value === 'string' && (value.includes('万') || value.includes('萬'))) {
      const processedValue = value.replace(/万|萬/g, '')
      return Number(processedValue) * 10000 > numericFilterValue
    }

    const numericValue = Number(value)
    return !Number.isNaN(numericValue) && numericValue > numericFilterValue
  }

  // #region filter by title
  const filterByTitleStringValues: string[] = []
  const filterByTitleRegExpValues: RegExp[] = []

  settings.value.filterByTitle.forEach((item) => {
    if (item.keyword.startsWith('/') && item.keyword.endsWith('/')) {
      filterByTitleRegExpValues.push(new RegExp(item.keyword.slice(1, -1), 'i'))
    }
    else {
      filterByTitleStringValues.push(`${item.keyword}`.toUpperCase())
    }
  })

  /**
   * Compares the title of an item with the given key path.
   * @param item - The item to compare.
   * @param keyPath - The key path to access the title of the item.
   * @returns `true` if the title does not contain any of the filter keywords, `false` otherwise.
   */
  function compareTitle(item: object, keyPath: string[], _filterValue: FilterValue) {
    const value = get(item, keyPath)

    return !(filterByTitleStringValues.some(keyword => `${value}`.toUpperCase().includes(keyword))
      || filterByTitleRegExpValues.some(regex => regex.test(String(value))))
  }
  // #endregion

  // #region filter by user
  const filterByUserStringValues: string[] = []
  const filterByUserRegExpValues: RegExp[] = []

  settings.value.filterByUser.forEach((item) => {
    if (item.keyword.startsWith('/') && item.keyword.endsWith('/')) {
      filterByUserRegExpValues.push(new RegExp(item.keyword.slice(1, -1), 'i'))
    }
    else {
      filterByUserStringValues.push(`${item.keyword}`.toUpperCase())
    }
  })

  /**
   * Compares a given item with a key path and determines if it does not meets the filter criteria.
   * @param item - The item to compare.
   * @param keyPath - The key path to access the value in the item.
   * @returns `true` if the item does not meet the filter criteria, `false` otherwise.
   */
  function compareUser(item: object, keyPath: string[], _filterValue: FilterValue) {
    const value = get(item, keyPath)

    return !(filterByUserStringValues.includes(`${value}`.toUpperCase())
      || filterByUserRegExpValues.some(regex => regex.test(String(value))))
  }
  // #endregion

  const funcMap: FuncMap = {
    [FilterType.filterOutVerticalVideos]: {
      func: filterOutVerticalVideos,
      enabledKey: 'filterOutVerticalVideos',
      valueKey: '',
    },
    [FilterType.viewCount]: {
      func: compareNumber,
      enabledKey: 'enableFilterByViewCount',
      valueKey: 'filterByViewCount',
    },
    [FilterType.duration]: {
      func: compareNumber,
      enabledKey: 'enableFilterByDuration',
      valueKey: 'filterByDuration',
    },
    [FilterType.viewCountStr]: {
      func: compareNumberString,
      enabledKey: 'enableFilterByViewCount',
      valueKey: 'filterByViewCount',
    },
    [FilterType.title]: {
      func: compareTitle,
      enabledKey: 'enableFilterByTitle',
      valueKey: '',
    },
    [FilterType.user]: {
      func: compareUser,
      enabledKey: 'enableFilterByUser',
      valueKey: '',
    },
  }

  const filter = ref<((item: object) => boolean) | null>(null)

  watch(() => [
    settings.value.filterOutVerticalVideos,
    settings.value.enableFilterByDuration,
    settings.value.enableFilterByViewCount,
    settings.value.enableFilterByTitle,
    settings.value.enableFilterByUser,
    settings.value.filterByDuration,
    settings.value.filterByViewCount,
    settings.value.filterByTitle,
    settings.value.filterByUser,
  ], ([filterOutVerticalVideos, durationFilter, viewCountFilter, titleFilter, userFilter]) => {
    if (!filterOutVerticalVideos && !durationFilter && !viewCountFilter && !titleFilter && !userFilter) {
      filter.value = null
      return
    }
    filter.value = factoryFilter(funcMap, filterOpt, keyList)
  }, { immediate: true })

  function factoryFilter(funcMap: FuncMap, filterOpt: FilterType[], keyList: KeyPath): (item: object) => boolean {
    interface FuncParams {
      keyPath: string[]
      func: FilterFunction
      value?: number | string
    }

    const funcs: FuncParams[] = []

    filterOpt.forEach((type, index) => {
      const { func, enabledKey, valueKey } = funcMap[type]
      if (Reflect.get(settings.value, enabledKey)) {
        const settingValue = valueKey ? Reflect.get(settings.value, valueKey) : ''
        const funcParams: FuncParams = {
          keyPath: keyList[index],
          func,
          value: typeof settingValue === 'number' || typeof settingValue === 'string' ? settingValue : '',
        }
        funcs.push(funcParams)
      }
    })

    return (item: object): boolean => {
      const result = funcs.every(({ keyPath, func, value }) => {
        // const check = func(item, keyPath, value)
        // if (!check) {
        //   // console.log('当前项目被拦截! 原因: ', '目标路径值 :>> ', keyPath, '大于', value, 'currentValue :>> ', get(item, keyPath))
        //   console.log('当前项目被拦截! 原因: ', '目标路径值 :>> ', keyPath, '過濾內容', value, 'currentValue :>> ', get(item, keyPath))
        // }
        if (isAllowedContent(item))
          return true

        return func(item, keyPath, value)
      })
      return result
    }
  }

  function isAllowedContent(item: object): boolean {
    if (settings.value.recommendationMode === 'web') {
      const isFollowed = get(item, isFollowedKeyPath)
      return Boolean(isFollowed) && settings.value.disableFilterForFollowedUser
    }
    if (settings.value.recommendationMode === 'app') {
      const isFollowed = get(item, isFollowedKeyPath) === '已关注' || get(item, isFollowedKeyPath) === '已關注'
      return Boolean(isFollowed) && settings.value.disableFilterForFollowedUser
    }
    return false
  }
  return filter
}
