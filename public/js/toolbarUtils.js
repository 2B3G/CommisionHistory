document.querySelector("#toolbar #hide").onclick = hideToolbar;
document.querySelector("#toolbar #show").onclick = showToolbar;
let toolbar = document.querySelector("#toolbar");

function hideToolbar() {
  toolbar.classList.add("hide-filters");

  setTimeout(() => {
    toolbar.classList.add("transition-complete");
  }, 200);
}

function showToolbar() {
  toolbar.classList.remove("hide-filters");
  toolbar.classList.remove("transition-complete");
}

export { hideToolbar };
