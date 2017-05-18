var express = require('express');
var router = express.Router();
var logger = require('debug')('st2:nse-rev-proxy');
var through2 = require('through2');
let cheerdo = require('cheerio');
let zlib = require('zlib');
let _ = require('lodash');

var NSE_QUOTE_URL = 'https://nseindia.com/live_market/dynaContent/live_watch/get_quote/GetQuote.jsp',
    proxy = require('express-request-proxy');

var symToNseSym = {
    "ADANI POWER": "ADANIPOWER",
    "ALOK": "ALOKTEXT",
    "AND BANK": "ANDHRABANK",
    "ASHOK": "ASHOKLEY",
    "BLUE STAR": "BLUESTARCO",
    "CAN BANK": "CANBK",
    "CENTURY": "CENTURYTEX",
    "COAL IND": "COALINDIA",
    "CROM GREAVES": "CGPOWER",
    "CROMPTON ELEC": "CROMPTON",
    "EICHER": "EICHERMOT",
    "EXIDE": "EXIDEIND",
    "GAIL": "GAIL",
    "HDFC": "",
    "HDFCBANK": "",
    "HIND ZINC": "HINDZINC",
    "HINDAL": "HINDALCO",
    "HPCL": "HINDPETRO",
    "HUL": "HINDUNILVR",
    "IDEA": "",
    "L&T": "LT",
    "L&T FIN": "L&TFH",
    "LIC": "LICHSGFIN",
    "M&M": "M&M",
    "MARUTI": "",
    "NTPC": "",
    "ONGC": "",
    "POWERG": "POWERGRID",
    "SAIL": "",
    "SBI": "SBIN",
    "TATA MOTORS": "TATAMOTORS",
    "TATA POW": "TATAPOWER",
    "TATA ST": "TATASTEEL",
    "TCS": "",
    "TECHM": "",
    "STEEL STRIPS": "SSWL",
    "VOLTAS": "",
    "BFORGE": "BHARATFORG",
    "NOCIL": ""
};


router.get('/', function (req, res, next) {
    proxy({
        url: NSE_QUOTE_URL,
        timeout: 5000,
        query: {
            symbol: getNseSymbols(req.query.symbol)
        },
        transforms: [unzipper(), extractQuotesJson(), zipper()]
    })(req, res, next);
});

function sanitizeNumber(input) {
    var value = _.toNumber(input.replace(',', ''));
    return _.isNaN(value) ? 0 : value;
}
function getNseSymbols(symbolList) {
    var symbols = symbolList.split(',').map(s => decodeURIComponent(s));
    var nseSymbolsCsv = _.map(symbols, s => (symToNseSym[s] || s)).join(',');
    return nseSymbolsCsv;
}

function unzipper() {
    return {
        name: 'Unzipper',
        transform: function () {
            return zlib.createGunzip();
        }
    }
}

function zipper() {
    return {
        name: 'zipper',
        transform: function () {
            return zlib.createGzip();
        }
    }
}

function extractQuotesJson() {
    let bufferChunks = [];
    return {
        name: 'RipThatNseQuoteOut',
        transform: function () {
            return through2(
                (chunk, enc, cb) => {
                    bufferChunks.push(chunk);
                    cb();
                },
                (cb) => {
                    var scraped = Buffer.concat(bufferChunks).toString();
                    let dom = cheerdo.load(scraped)
                    var maal = JSON.parse(dom('#responseDiv').text());
                    logger('Scraped JSON -> ' + JSON.stringify(maal));

                    var reduction = _.map(maal.data, function (quote) {
                        var symbol = _.has(symToNseSym, quote.symbol) ? quote.symbol : _.findKey(symToNseSym, v => v === quote.symbol) || quote.symbol;
                        return [symbol,
                            {
                                's': symbol,
                                'p': sanitizeNumber(quote.lastPrice),
                                'c': sanitizeNumber(quote.change),
                                'r52': quote.low52 + ' - ' + quote.high52
                            }];
                    });

                    cb(null, JSON.stringify({ 'data': _.fromPairs(reduction) }));
                }
            );
        }

    };

}


module.exports = router;
