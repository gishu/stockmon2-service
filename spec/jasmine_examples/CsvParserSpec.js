describe('CsvParser', function () {

    var _csv_sample1 = ',Date,Stock,Qty,UnitPrice,Amt,Type\n' +
        ',15-Jul-15,AND BANK,,,600,DIV\n' +
        ',17-Aug-10,VOLTAS,,,200,DIV\n' +
        ',24-Sep-09,HDFCBANK,10,1607.1,16071,SOLD\n' +
        ',4-Sep-09,HDFC,4,2705,10820,SOLD\n' +
        ',23-Sep-09,BALRAM,83,119.5,9918.5,\n' +
        ',14-Jul-08,HDFCBANK,10,1030,10300,\n';

    var helper = require('../helpers/test_helper.js');
    var parse = require('../../src/CsvParser.js');
    var make = require('../../src/Trade.js');
    var getBrokerage = function (qty, price) { return price.times(qty).times(0.0067).round(2); };


    var istream;
    beforeEach(function () {
        istream = helper.createStringStream(_csv_sample1);
    });

    it('should parse and return chronological trades', function (done) {
        var expected = [make.makeBuy('2008-07-13T18:30:00.000Z', 'HDFCBANK', 10, '1030', getBrokerage),
            make.makeSale('2009-09-03T18:30:00.000Z', 'HDFC', 4, '2705', getBrokerage),
            make.makeBuy('2009-09-22T18:30:00.000Z', 'BALRAM', 83, '119.5', getBrokerage),
            make.makeSale('2009-09-23T18:30:00.000Z', 'HDFCBANK', 10, '1607.1', getBrokerage)
        ];

        parse(istream, function (err, results) {
            expect(JSON.stringify(results.trades)).toEqual(JSON.stringify(expected));
            done();
        });
    });

    it('should parse and return dividends received in chronological order', function (done) {
        var dividends = [make.makeDividend('2010-08-16T18:30:00.000Z', 'VOLTAS', '200'),
            make.makeDividend('2015-07-14T18:30:00.000Z', 'AND BANK', '600')];

        parse(istream, function (err, results) {
            expect(JSON.stringify(results.dividends)).toEqual(JSON.stringify(dividends));
            done();
        });
    });


});

