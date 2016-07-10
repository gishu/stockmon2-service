var _ = require('lodash');
var BigNumber = require('bignumber.js');
var make = require('./Trade.js');
var calcBrokerage = require('./HdfcBrokerage.js');
var log = require('debug')('parser');

function parse(csvStream, callback) {
    var parse = require('csv-parse');
    var parse_options = { skip_empty_lines: true, trim: true, columns: true },
        trades = new Array(),
        dividends = new Array();

    csvStream.pipe(parse(parse_options, function (err, data) {
        var looper = 0, price, qty, record;

        if (err) {
            callback(err, null);
            return;
        }
        try {
            for (looper = 0; looper < data.length; looper++) {
                record = data[looper];
                if (record['Date'] && record['Stock']) {
                    if (record['Type'] === 'DIV') {
                        dividends.push(make.makeDividend(record['Date'], record['Stock'], record['Amt'].replace(',', ''), record['Notes']));
                    }
                    else {
                        price = new BigNumber(record['UnitPrice'].replace(',', ''));
                        qty = parseInt(record['Qty']);
                        if (record['Type'] != 'SOLD') {
                            trades.push(make.makeBuy(record['Date'], record['Stock'], qty, price, calcBrokerage(qty, price, true), record['Notes']));
                        }
                        else {
                            trades.push(make.makeSale(record['Date'], record['Stock'], qty, price, calcBrokerage(qty, price, false), record['Notes']));
                        }
                    }
                }
            }
        }
        catch (e) {
            log('Error in Parse Error = %s. Records Processed=%d', e, looper);
            callback(e, null);
        }
        callback(null, {
            trades: _.sortBy(trades, ['date', 'stock']),
            dividends: _.sortBy(dividends, ['date', 'stock'])
        });

    }));

}

module.exports = parse;