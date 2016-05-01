var _ = require('lodash');
var make = require('./Trade.js');
var calcBrokerage = require('./HdfcBrokerage.js');

function parse(csvStream, callback){
    var parse = require('csv-parse');
    var parse_options = {
            skip_empty_lines: true,
            trim: true,
            columns: true
        },
        trades = new Array(),
        dividends = new Array();

    csvStream.pipe(parse(parse_options, function(err, data){
        if (err){
            callback(err, null);
            return;
        }
        try {
            var looper = 0;
            for (looper = 0; looper < data.length; looper++) {
                var record = data[looper];
                if (record['Date'] && record['Stock']) {
                    if (record['Type'] === 'DIV') {
                        dividends.push(make.makeDividend(record['Date'], record['Stock'], record['Amt'].replace(',', '')));
                    }
                    else {

                        if (record['Type'] != 'SOLD') {
                            trades.push(make.makeBuy(record['Date'], record['Stock'], parseInt(record['Qty']), record['UnitPrice'].replace(',', ''), calcBrokerage));
                        }
                        else {
                            trades.push(make.makeSale(record['Date'], record['Stock'], parseInt(record['Qty']), record['UnitPrice'].replace(',', ''), calcBrokerage));
                        }
                    }
                }
            }
        }
        catch (e) {
            console.error('Error in Parse Error = %s', e);
            callback(e, null);
        }
        callback(null, { trades: _.sortBy(trades, 'date'), dividends: _.sortBy(dividends, 'date') });

    }));
    
}

module.exports = parse;