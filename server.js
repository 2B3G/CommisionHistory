import express from "express";
import fileUpload from "express-fileupload";
import path from "path";
import fs from "fs";
import xlsx from "xlsx";
import cookieParser from "cookie-parser";
import csvUtil from "./public/js/csvUtils.js"; // Ensure csvUtils is an ES module
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  console.log("Loading the GeoDatabase...");
  await csvUtil.loadCsv();

  app.listen(port, console.log("Listening on port " + port));
})();

const app = express();
const port = 3000 | process.env.PORT;

app.use(express.static(path.join(__dirname, "public")));
app.use(fileUpload());
app.use(cookieParser());

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.get("/", (req, res) => {
  res.sendFile("/public/index.html");
});

app.post("/save", (req, res) => {
  if (!req.files || !req.files.file)
    return res.status(400).json({ message: "No file uploaded" });

  try {
    const uploadedFile = req.files.file;
    const savePath = path.join(uploadDir, uploadedFile.name);

    uploadedFile.mv(savePath, async (err) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "File upload failed", error: err });
      }

      // load the excel file
      const workbook = xlsx.readFile(savePath);

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      let data = xlsx.utils.sheet_to_json(worksheet);

      // go throught each row and add the lat and len for load and unload as new columns
      data = await Promise.all(
        data.map(async (row) => {
          const loadFullCode = row["Załadunki"].split(" ")[0];
          const loadCountryCode = loadFullCode.slice(0, 2);
          const loadPostCode = loadFullCode.slice(2);

          const loadCoords = await csvUtil.findRow(
            loadCountryCode,
            loadPostCode
          );

          const unloadFullCode = row["Rozładunki"].split(" ")[0];
          const unloadCountryCode = unloadFullCode.slice(0, 2);
          const unloadPostCode = unloadFullCode.slice(2);

          const unloadCoords = await csvUtil.findRow(
            unloadCountryCode,
            unloadPostCode
          );

          const updatedRow = {
            ...row,
            Załadunek_coords:
              (loadCoords.latitude ? loadCoords.latitude : "null") +
              "," +
              (loadCoords.longitude ? loadCoords.longitude : "null"),
            Rozładunek_coords:
              (unloadCoords.latitude ? unloadCoords.latitude : null) +
              "," +
              (unloadCoords.longitude ? unloadCoords.longitude : "null"),
          };

          return updatedRow;
        })
      );

      // save the updated file
      const updatedSheet = xlsx.utils.json_to_sheet(data);
      workbook.Sheets[sheetName] = updatedSheet;

      xlsx.writeFile(workbook, savePath);

      res.json({
        message: "File uploaded successfully!",
        filename: uploadedFile.name,
      });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e });
  }
});

app.post("/filter", async (req, res) => {
  try {
    const postFrom = req.body["post-from"];
    const postTo = req.body["post-to"];
    const lengthFrom = req.body["length-from"];
    const lengthTo = req.body["length-to"];
    const weightFrom = req.body["weight-from"];
    const weightTo = req.body["weight-to"];
    const radius = req.body["radius"];
    const fileName = req.cookies.file;

    if (fileName == undefined) {
      res.clearCookie("file", { path: "/" });

      return res.status(400).json({ message: "File cookie not found" });
    } else if (!fs.existsSync("./uploads/" + fileName)) {
      res.clearCookie("file", { path: "/" });

      return res.status(400).json({ message: "Uploaded file not found" });
    } else if (postFrom == undefined || postTo == undefined) {
      return res
        .status(400)
        .json({ message: "Load post code or Unload post code not found" });
    }

    const workbook = xlsx.readFile("./uploads/" + fileName);

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const originalPathStartPoint = await csvUtil.findRow(
      postFrom.slice(0, 2),
      postFrom.slice(2)
    );
    const originalPathEndingPoint = await csvUtil.findRow(
      postTo.slice(0, 2),
      postTo.slice(2)
    );

    let filteredData = data.filter((row) => {
      const ldm = parseFloat(row["Całkowity ładunek [LDM]"]);
      const kg = parseFloat(row["Całkowity ładunek [KG]"]);
      const loadCoords = row["Załadunek_coords"].split(",");
      const unloadCoords = row["Rozładunek_coords"].split(",");

      const loadDistance = getPointDistance(originalPathStartPoint, {
        latitude: loadCoords[0],
        longitude: loadCoords[1],
      });

      const unloadDistance = getPointDistance(originalPathEndingPoint, {
        latitude: unloadCoords[0],
        longitude: unloadCoords[1],
      });

      return (
        (lengthFrom ? ldm >= lengthFrom : true) &&
        (lengthTo ? ldm <= lengthTo : true) &&
        (weightFrom ? kg >= weightFrom : true) &&
        (weightTo ? kg <= weightTo : true) &&
        (radius && !isNaN(loadDistance) && !isNaN(unloadDistance)
          ? loadDistance <= radius && unloadDistance <= radius
          : true)
      );
    });

    // if no results return 204
    if (filteredData.length == 0) return res.status(204).json({});

    // get average and range
    let averageValues = {
      cost: 0,
      price: 0,
      commission: 0,
    };

    let minMaxArray = {
      price: [],
      cost: [],
      commission: [],
    };

    filteredData.forEach((row) => {
      const cost = row["Koszt"];
      const price = row["Przychód"];
      const commission = row["Prowizja"];

      minMaxArray.cost.push(parseFloat(cost));
      minMaxArray.price.push(parseFloat(price));
      minMaxArray.commission.push(parseFloat(commission));

      averageValues.price += parseFloat(price);
      averageValues.cost += parseFloat(cost);
      averageValues.commission += parseFloat(commission);
    });

    let minValues = {
      price: [],
      cost: [],
      commission: [],
    };
    let maxValues = {
      price: [],
      cost: [],
      commission: [],
    };

    minValues.cost = Math.min(...minMaxArray.cost);
    minValues.price = Math.min(...minMaxArray.price);
    minValues.commission = Math.min(...minMaxArray.commission);

    maxValues.cost = Math.max(...minMaxArray.cost);
    maxValues.price = Math.max(...minMaxArray.price);
    maxValues.commission = Math.max(...minMaxArray.commission);

    const dataLength = filteredData.length;

    averageValues.cost = (averageValues.cost / dataLength).toFixed(2);
    averageValues.price = (averageValues.price / dataLength).toFixed(2);
    averageValues.commission = (averageValues.commission / dataLength).toFixed(
      2
    );

    res.json({
      summary: {
        min: minValues,
        max: maxValues,
        avg: averageValues,
      },
      commisions: filteredData,
    });
  } catch (e) {
    console.error(e);

    res.status(500).send({ error: e });
  }
});

/***
 * Returns distance in km
 */
function getPointDistance(pointOne, pointTwo) {
  const lat1 = pointOne["latitude"];
  const lon1 = pointOne["longitude"];
  const lat2 = pointTwo["latitude"];
  const lon2 = pointTwo["longitude"];

  if (lat1 === "null" || lat2 === "null") return NaN;

  const R = 6371; // Radius of Earth in km
  const toRad = (angle) => angle * (Math.PI / 180); // Convert degrees to radians

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
