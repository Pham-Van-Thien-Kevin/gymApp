// Gedeeld tussen het inline script in de root layout en de themaknop.
export const THEME_KEY = "liftlog:theme";
export type Theme = "light" | "dark";

/**
 * Draait als inline <script> in <head>, vóór de eerste paint: zo zie je nooit
 * eerst het verkeerde thema. Geen gekozen thema → geen data-theme, en dan volgt
 * de CSS het systeem (prefers-color-scheme). try/catch: localStorage kan geblokkeerd zijn.
 */
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
