var express = require("express");
var router = express.Router();
var logger = require("debug")("st2:nse-rev-proxy");
let _ = require("lodash");
var fs = require("fs");

var symToNseSym = {
  "ADANI POWER": "ADANIPOWER",
  ALOK: "ALOKTEXT",
  "AND BANK": "ANDHRABANK",
  ASHOK: "ASHOKLEY",
  "BLUE STAR": "BLUESTARCO",
  "CAN BANK": "CANBK",
  CENTURY: "CENTURYTEX",
  "COAL IND": "COALINDIA",
  "CROM GREAVES": "CGPOWER",
  "CROMPTON ELEC": "CROMPTON",
  EICHER: "EICHERMOT",
  EXIDE: "EXIDEIND",
  "HIND ZINC": "HINDZINC",
  HINDAL: "HINDALCO",
  HPCL: "HINDPETRO",
  HUL: "HINDUNILVR",
  "L&T": "LT",
  "L&T FIN": "L&TFH",
  LIC: "LICHSGFIN",
  "M&M": "M&M",
  POWERG: "POWERGRID",
  SBI: "SBIN",
  "TATA MOTORS": "TATAMOTORS",
  "TATA POW": "TATAPOWER",
  "TATA ST": "TATASTEEL",
  TECHM: "TECM",
  "STEEL STRIPS": "SSWL",
  BFORGE: "BHARATFORG",
  "JK TYRE": "JKTYRE",
  ICICI: "ICICIBANK",
  "FED BK": "FEDERALBNK",
  BAJAJFIN: "BAJFINANCE",
  PAGE: "PAGEIND",
  "GOV-SGB": "GOV-SGB",
};

var path = require("path");
var parse = require("csv-parse");

router.get("/", function (req, res) {
  // check for missing symbol query param
  if (!req.query.symbol) {
    res
      .status(400)
      .json("Missing symbol param - specify stocks to retrieve prices");
    return;
  }

  var quotesFile = path.resolve("./quotes_db/quotes.csv");

  // check for missing file
  if (!fs.existsSync(quotesFile)) {
    logger("Quotes_Db missing - cannot retrieve quotes");
  }
  let parser = parse(),
    quotes = [],
    quoteMap = {};

  parser.on("error", console.log);

  parser.on("readable", () => {
    let record;
    while ((record = parser.read())) {
      quotes.push(record);
    }
  });

  parser.on("end", () => {
    quoteMap = _.fromPairs(quotes);

    let response = _(req.query.symbol.split(","))
      .map(decodeURIComponent)
      .map((stock) => {
        let nseSymbol = symToNseSym[stock] || stock;
        return [stock, { s: stock, p: quoteMap[nseSymbol] || 0 }];
      })
      .fromPairs();

    res.status(200).json({ data: response });
  });

  fs.createReadStream(quotesFile).pipe(parser);
});

function getNseSymbols(symbolList) {
  var symbols = symbolList.split(",").map((s) => decodeURIComponent(s));
  var nseSymbolsCsv = _.map(symbols, (s) => symToNseSym[s] || s);
  return nseSymbolsCsv;
}

module.exports = router;
