import { createReadStream, appendFile } from "fs";
import csvParser from "csv-parser";
import fetch from "node-fetch";

class csvUtil {
  static rows = [];

  static loadCsv() {
    return new Promise((resolve) => {
      createReadStream("final.csv", { encoding: "utf-8" })
        .pipe(csvParser())
        .on("data", (row) => {
          this.rows.push(row);
        })
        .on("error", (error) => {
          console.log(error);
        })
        .on("close", () => {
          resolve(this.rows);
        });
    });
  }

  static async findRow(country, postcode) {
    const result = this.rows.filter(
      (v) => v.country_code == country && postcode == v.post_code
    );

    if (result.length == 0) {
      const start = Date.now();

      const r = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${postcode}&lang=en&limit=1&type=postcode&filter=countrycode:${country.toLowerCase()}&format=json&apiKey=31acba8294aa41d89e3ad4dc64f9662c`
      );

      let cords = {
        latitude: null,
        longitude: null,
      };

      if (r.status == 200) {
        const data = await r.json();

        if (data.results.length > 0) {
          const first = data.results[0];

          const newRow = {
            country_code: country,
            post_code: postcode,
            latitude: first.lat,
            longitude: first.lon,
          };

          // "prevent" race condition xDDDD
          const check = this.rows.filter(
            (v) => v.country_code == country && postcode == v.post_code
          );

          if (check.length == 0) {
            this.rows.push(newRow);

            const saveData = `\r\n${country},${postcode},${first.lat},${first.lon}`;

            appendFile("final.csv", saveData, (err) => {
              if (err) {
                console.error(
                  `Error updating postcode database for ${country}${postcode}:`,
                  err
                );
              }
            });
          }

          cords = {
            latitude: first.lat,
            longitude: first.lon,
          };
        }
      }

      return cords;
    }

    return result[0];
  }
}

export default csvUtil;
