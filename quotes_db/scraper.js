// we will scrape the google finance portfolio page for quotes now :|

var trumpet = require('trumpet');
var getString = require('raw-body');
var stockRowReader = trumpet();
var _ = require('lodash');

if (process.argv.length != 4) {
    console.error('Usage: node scraper.js googleFin.html quotes.json');
    process.exit(-1);
}

let quotes = [];

var fileWriteTimeout;
stockRowReader.selectAll('#pf-view-table > table > tbody > tr', tr => {
    toJson(tr.createReadStream(), (err, quote) => {
        console.log('%j', quote);
        quotes.push(quote);

        if (fileWriteTimeout) {
            clearTimeout(fileWriteTimeout);
        }

        fileWriteTimeout = setTimeout(function (count) {
            if (count != quotes.length) {
                console.error('Premature dump of quotes? ', count, '-', quotes.length);
            }
            fs.createWriteStream(process.argv[3]).end(JSON.stringify(quotes))
            console.log('Data written to ', process.argv[3]);
        },
            2000,
            quotes.length);

    })
});

function toJson(rowStream, cb) {
    var jsonTrumpet = trumpet();
    rowStream.pipe(jsonTrumpet);
    var elements = _.map(['.pf-table-s > a', '.pf-table-lp > span ', '.pf-table-cp > span '], cssClass => jsonTrumpet.select(cssClass));

    var promises = _.map(elements, function (e) {
        return getString(e.createReadStream(), { encoding: 'utf-8' });
    });


    Promise.all(promises)
        .then(values => cb(null, { 's': getNseSymbol(values[0]), 'p': getPrice(values[1]), 'c': sanitizeNumber(values[2]) }))
        .catch(err => {
            console.log(err);
            cb(err, null);
        });

}

function getNseSymbol(symbol) {
    symbol = symbol.replace('&amp;', '&');
    return (isNaN(parseInt(symbol))) ? 'NSE:' + symbol : 'BSE:' + symbol;
}

// google finance uses a simple span with price 224.40 in offline mode
// however in live update mode, it will use 2 nested spans for '22' and '5.40' (optimize unchanged portion update?)
function getPrice(priceHtml) {

    var price = sanitizeNumber(priceHtml);
    if (!isNaN(price))
        return price;

    let nestedSpan = /<span.*?>([\d.,]*)<\/span>/g,
        match = null,
        part1 = part2 = '';

    match = nestedSpan.exec(priceHtml);
    part1 = match[1];
    match = nestedSpan.exec(priceHtml);
    if (match)
        part2 = match[1];

    return sanitizeNumber(part1 + part2);
}

function sanitizeNumber(input) {
    return _.toNumber(input.replace(',', ''));
}

var fs = require('fs');

console.log(process.argv[2])
fs.createReadStream(process.argv[2]).pipe(stockRowReader);



