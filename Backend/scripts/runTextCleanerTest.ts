import { cleanOcrText } from "../src/shared/ocr/textCleaner.util";

const noisy = `BOARDING PASS\n\nBOARDING PASS\n\nJohn SMITH\nTHE BEST AIRLINES\nPARIS\nRIO DE JANEIRO\nPNR: ABC123\nFlight: AB 1234\nSeat: 55L\n08:10\nDownload from Dreamstime.com`;

async function run() {
  const result = cleanOcrText(noisy, "flight");
  console.log("CLEANED SUMMARY:\n", result.cleanedText);
  console.log("\nKEY FIELDS:\n", JSON.stringify(result.keyFields, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
