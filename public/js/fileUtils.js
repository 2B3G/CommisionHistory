import { setFileCookie } from "./cookieUtils.js";

function getFile() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "bg-overlay";

    const popup = document.createElement("div");
    popup.id = "file-popup";

    popup.innerHTML = ` 
      <div>
        <h1>Upload file</h1>
        <p>Click this button or drag the file over this field</p>
      </div>
      <img src="icons/file.png" draggable="false">
    `;

    popup.onclick = (e) => {
      if (e.target.nodeName == "INPUT") return;

      const inp = document.createElement("input");
      inp.style.display = "none";
      inp.type = "file";
      inp.accept = ".xls,.xlsx";

      inp.onchange = async (ev) => {
        // loading animation
        popup.innerHTML = `
        <div>
          <h1>Processing file</h1>
          <p>Wait while your file is processed in the backend</p>
        </div>
        <div id="loading-spinner"></div>
        `;

        const file = ev.target.files[0];

        try {
          await saveFile(file);

          popup.remove();
          overlay.remove();

          setFileCookie(file.name);

          resolve(file.name);
        } catch (e) {
          await makeError("Encountered error while saving file");

          resolve();
        }
      };

      popup.appendChild(inp);
      inp.click();
    };

    popup.ondragover = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };

    popup.ondragenter = (e) => {
      popup.querySelector("p").textContent = "";
      popup.querySelector("h1").textContent = "Upuść plik tutaj";
      popup.classList.add("drop-highlight");
    };

    popup.ondragleave = () => {
      popup.querySelector("p").textContent =
        "Naciśnij przycisk lub przeciągnij plik na pole";
      popup.querySelector("h1").textContent = "Prześlij plik";
      popup.classList.remove("drop-highlight");
    };

    popup.ondrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer.files;
      const file = files[0];

      try {
        await saveFile(file);

        popup.remove();
        overlay.remove();

        setFileCookie(file.name);

        resolve(file.name);
      } catch (e) {
        await makeError("Encountered error while saving file");

        resolve();
      }

      resolve();
    };

    document.body.append(overlay, popup);
  });
}

async function saveFile(file) {
  const fd = new FormData();
  fd.append("file", file);

  const resp = await fetch("/save", { method: "POST", body: fd });
  if (resp.status != 200) throw Error();
}

function makeError(message) {
  const errorDiv = document.querySelector(".error-container");
  errorDiv.classList.add("error-show");

  errorDiv.querySelector("p").textContent = message;

  return new Promise((resolve) =>
    setTimeout(() => {
      errorDiv.classList.remove("error-show");

      resolve();
    }, 3000)
  );
}

export { getFile, makeError };
