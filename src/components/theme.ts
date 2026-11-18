// Chế độ giao diện: 'system' theo máy, hoặc chọn tay 'light' / 'dark'. Lưu ở localStorage, áp vào <html data-theme>.
export type ThemePref = 'system' | 'light' | 'dark';
export const THEME_KEY = 'eh:theme';
export const THEME_COLOR = { light: '#0e1e4a', dark: '#0c1428' } as const;

/** Chạy trong <head> trước khi vẽ trang để không bị nháy sai màu. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.setAttribute('content',t==='dark'?'${THEME_COLOR.dark}':'${THEME_COLOR.light}')})}}catch(e){}})()`;
