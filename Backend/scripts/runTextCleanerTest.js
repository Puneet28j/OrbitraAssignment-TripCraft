import { cleanOcrText } from "../dist/shared/ocr/textCleaner.util.js";

const noisy = `BOARDING PASS

BOARDING PASS

John SMITH
THE BEST AIRLINES
PARIS
RIO DE JANEIRO
PNR: ABC123
Flight: AB 1234
Seat: 55L
08:10
Download from Dreamstime.com`;

function run() {
  const result = cleanOcrText(noisy, "flight");
  console.log("CLEANED SUMMARY:\n", result.cleanedText);
  console.log("\nKEY FIELDS:\n", JSON.stringify(result.keyFields, null, 2));
}

try {
  run();
} catch (err) {
  console.error(err);
  process.exit(1);
}
