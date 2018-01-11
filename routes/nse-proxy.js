var express = require('express');
var router = express.Router();
var logger = require('debug')('st2:nse-rev-proxy');
let _ = require('lodash');
var fs = require('fs');

var symToNseSym = {
    "ADANI POWER": "NSE:ADANIPOWER",
    "ALOK": "NSE:ALOKTEXT",
    "AND BANK": "NSE:ANDHRABANK",
    "ASHOK": "NSE:ASHOKLEY",
    "BLUE STAR": "NSE:BLUESTARCO",
    "CAN BANK": "NSE:CANBK",
    "CENTURY": "NSE:CENTURYTEX",
    "COAL IND": "NSE:COALINDIA",
    "CROM GREAVES": "NSE:CGPOWER",
    "CROMPTON ELEC": "NSE:CROMPTON",
    "EICHER": "BSE:505200",
    "EXIDE": "NSE:EXIDEIND",
    "GAIL": "NSE:GAIL",
    "HDFC": "NSE:HDFC",
    "HDFCBANK": "NSE:HDFCBANK",
    "HIND ZINC": "NSE:HINDZINC",
    "HINDAL": "NSE:HINDALCO",
    "HPCL": "NSE:HINDPETRO",
    "HUL": "NSE:HINDUNILVR",
    "ITC": "NSE:ITC",
    "IDEA": "NSE:IDEA",
    "L&T": "NSE:LT",
    "L&T FIN": "NSE:L&TFH",
    "LIC": "NSE:LICHSGFIN",
    "M&M": "NSE:M&M",
    "MARUTI": "NSE:MARUTI",
    "NTPC": "NSE:NTPC",
    "ONGC": "NSE:ONGC",
    "POWERG": "NSE:POWERGRID",
    "SAIL": "NSE:SAIL",
    "SBI": "NSE:SBIN",
    "TATA MOTORS": "NSE:TATAMOTORS",
    "TATA POW": "NSE:TATAPOWER",
    "TATA ST": "NSE:TATASTEEL",
    "TCS": "NSE:TCS",
    "TECHM": "NSE:TECM",
    "STEEL STRIPS": "NSE:SSWL",
    "VOLTAS": "NSE:VOLTAS",
    "BFORGE": "NSE:BHARATFORG",
    "NOCIL": "NSE:NOCIL",
    "JK TYRE": "NSE:JKTYRE",
    "ICICI": "NSE:ICICIBANK",
    "FED BK": "BSE:500469",
    "BAJAJFIN": "NSE:BAJFINANCE",
    "8KMILES": "BSE:8KMILES"

};

var path = require('path');


router.get('/', function (req, res, next) {

    var quotesFile = path.resolve('./quotes_db/quotes.json');
    logger(quotesFile);

    if (!fs.existsSync(quotesFile)) {
        logger('Quotes_Db missing - cannot retrieve quotes')
        res.status(500).end();
        next();
    }

    let nseSymbols = getNseSymbols(req.query.symbol);

    var quotes = JSON.parse(fs.readFileSync(quotesFile).toString());
    var response = _(quotes).filter(q => _.includes(nseSymbols, q.s))
        .map(q => {
            let stock = _.findKey(symToNseSym, v => v === q.s);
            return [stock, { 's': stock, 'p': q.p, 'c': q.c }];
        })
        .fromPairs();
    res.json({ "data": response });

});

function getNseSymbols(symbolList) {
    var symbols = symbolList.split(',').map(s => decodeURIComponent(s));
    var nseSymbolsCsv = _.map(symbols, s => (symToNseSym[s] || s));
    return nseSymbolsCsv;
}

module.exports = router;
