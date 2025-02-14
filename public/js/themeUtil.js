import { changeMapTheme } from "../main.js";

const lightBtn = document.querySelector("#light-theme");
const darkBtn = document.querySelector("#dark-theme");

let theme = localStorage.getItem("theme");

if (theme === null) {
  saveTheme("light");
  setLightTheme();
} else {
  if (theme === "light") setLightTheme();
  else setDarkTheme();
}

lightBtn.onclick = setLightTheme;
darkBtn.onclick = setDarkTheme;

function setLightTheme() {
  if (lightBtn.classList.contains("selected-theme") && theme != "light") return;

  darkBtn.classList.remove("selected-theme");
  lightBtn.classList.add("selected-theme");

  document.body.classList.remove("dark-theme");

  changeMapTheme("light");
  saveTheme("light");
}

function setDarkTheme() {
  if (darkBtn.classList.contains("selected-theme") && theme != "dark") return;

  lightBtn.classList.remove("selected-theme");
  darkBtn.classList.add("selected-theme");

  document.body.classList.add("dark-theme");

  changeMapTheme("dark");
  saveTheme("dark");
}

function saveTheme(theme) {
  theme = theme;
  localStorage.setItem("theme", theme);
}
