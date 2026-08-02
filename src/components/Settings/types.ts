export enum MenuType {
  General = 'General',
  DesktopAndDock = 'DesktopAndDock',
  Appearance = 'Appearance',
  BewlyPages = 'BewlyPages',
  Compatibility = 'Compatibility',
  BilibiliSettings = 'BilibiliSettings',
  About = 'About',
}

export enum BewlyPage {
  Home = 'Home',
  Moments = 'Moments',
  Search = 'Search',
}

export interface MenuItem {
  value: MenuType
  title: string
  icon: string
  iconActivated: string
}
