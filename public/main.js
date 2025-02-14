import { getFileCookie } from "./js/cookieUtils.js";
import { getFile, makeError } from "./js/fileUtils.js";
import { hideToolbar } from "./js/toolbarUtils.js";

// show add file popup if no file cookie found
getFileCookie() || (await getFile());

let routingControl;
const map = L.map("map").setView([52.5, 13.4], 4);

function changeMapTheme(theme) {
  if (theme === "light") {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
  } else {
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);
  }
}

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// remove routing box in the top right
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          node.classList.contains("leaflet-routing-container")
        ) {
          node.remove();
        }
      });
    }
  });
});

observer.observe(document.querySelector("#map"), {
  childList: true,
  subtree: true,
});

document.querySelector("#filter-form").onsubmit = async (e) => {
  e.preventDefault();

  const fd = new FormData(e.target);

  let resp;
  try {
    resp = await fetch("/filter", { method: "POST", body: fd });
  } catch (e) {
    console.error(e);
    await makeError(
      "Encountered error while fetching commisions. Try again later"
    );
    return;
  }

  // if 204, no commisions found
  // if 400, weird error happened
  if (resp.status == 204) {
    makeError("No commisions found");
  } else if (resp.status == 400) {
    const data = await resp.json();

    await makeError(data.message);

    if (data.message.includes("file")) {
      window.location.reload();
    }
  } else if (resp.status != 200) {
    makeError("Encountered unknown error while filtering commisions");
  } else {
    const data = await resp.json();

    if (data.commisions.length > 0) {
      // clear previous commision
      const check = document.querySelector("#commision-list").children;
      if (check.length != 0)
        document.querySelector("#commision-list").innerHTML = ``;

      // show path for the first commision
      const firstLoadCoords = data.commisions[0].Załadunek_coords;
      const firstUnloadCoords = data.commisions[0].Rozładunek_coords;

      showPath(firstLoadCoords, firstUnloadCoords);
    }

    data.commisions.forEach((commision) => addCommision(commision));

    makeSummary(data.summary);

    hideToolbar();
    document.querySelector("#results").classList.add("show-results");
  }
};

document.querySelector("#add-file-btn").onclick = async () => {
  const newFileName = await getFile();

  if (newFileName != 0) fileName = newFileName;
  window.location.reload();
};

function addCommision(commisionData) {
  const commision = document.createElement("div");
  commision.classList.add("commision");

  commision.innerHTML = `
    <h1>Commision</h1>
    <div class="info">
      <ul>
        <li>
          <p class="postcode">
            Code <span>${
              commisionData["Załadunki"].split(" ")[0]
            }</span> - <span>${commisionData["Rozładunki"].split(" ")[0]}</span>
          </p>
        </li>
        <li>
          <p class="length">
            LDM <span>${commisionData["Całkowity ładunek [LDM]"]} LDM</span>
          </p>
        </li>
        <li>
          <p class="weight">
            Weight <span>${parseInt(
              commisionData["Całkowity ładunek [KG]"]
            )} kg</span>
          </p>
        </li>
        <li>
          <p class="income">Income <span>${
            commisionData["Przychód"]
          }zł</span></p>
        </li>
        <li>
          <p class="price">Cost <span>${commisionData["Koszt"]}zł</span></p>
        </li>
        <li>
          <p class="provision">Provision <span>${
            commisionData["Prowizja"]
          }zł</span></p>
        </li>
      </ul>
    </div>
  `;

  commision.onclick = () => {
    showPath(
      commisionData["Załadunek_coords"],
      commisionData["Rozładunek_coords"]
    );
  };

  document.querySelector("#commision-list").appendChild(commision);
}

function showPath(startCoords, endCoords) {
  if (routingControl) {
    map.removeControl(routingControl);
  }

  if (startCoords == "null,null" || endCoords == "null,null") {
    return makeError("Couldn't find post codes coordinates");
  }

  const startParsed = {
    latitude: startCoords.split(",")[0],
    longitude: startCoords.split(",")[1],
  };

  const endParsed = {
    latitude: endCoords.split(",")[0],
    longitude: endCoords.split(",")[1],
  };

  startCoords = L.latLng(
    parseFloat(startParsed.latitude),
    parseFloat(startParsed.longitude)
  );
  endCoords = L.latLng(
    parseFloat(endParsed.latitude),
    parseFloat(endParsed.longitude)
  );

  const startIcon = L.icon({
    iconUrl: "/icons/startIcon.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const endIcon = L.icon({
    iconUrl: "/icons/stopIcon.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  routingControl = L.Routing.control({
    waypoints: [startCoords, endCoords],
    routeWhileDragging: true,
    lineOptions: { styles: [{ color: "red", weight: 6, opacity: 0.8 }] },
    createMarker: function (i, waypoint, n) {
      if (i === 0) {
        return L.marker(waypoint.latLng, { icon: startIcon }).bindPopup(
          "Start"
        );
      } else if (i === n - 1) {
        return L.marker(waypoint.latLng, { icon: endIcon }).bindPopup("End");
      }
    },
  }).addTo(map);
}

function makeSummary(data) {
  const rangeDiv = document.querySelector("#summary-range");

  rangeDiv.innerHTML = `
    <p>Cost <span>${data.min.cost}zł</span> - <span>${data.max.cost}zł</span></p>
    <p>Income <span>${data.min.price}zł</span> - <span>${data.max.price}zł</span></p>
    <p>Provision <span>${data.min.commission}zł</span> - <span>${data.max.commission}zł</span></p>
  `;

  const averageDiv = document.querySelector("#summary-average");

  averageDiv.innerHTML = `
    <p>Cost <span>${data.avg.cost}zł</span></p>
    <p>Income <span>${data.avg.price}zł</span></p>
    <p>Provision <span>${data.avg.commission}zł</span></p>
  `;
}

export { changeMapTheme };
