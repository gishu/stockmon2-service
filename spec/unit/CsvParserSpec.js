describe('CsvParser', function () {

    var _csv_sample1 = ',Date,Stock,Qty,UnitPrice,Amt,Type,Notes\n' +
        ',2015-07-15,AND BANK,,,600,DIV, interim\n' +
        ',2010-08-17,VOLTAS,,,200,DIV, \n' +
        ',2009-09-24,HDFCBANK,10,1607.1,16071,SOLD,\n' +
        ',2009-09-04,HDFC,4,2705,10820,SOLD,Bonus\n' +
        ',2009-09-23,BALRAM,83,119.5,9918.5,,\n' +
        ',2008-07-14,HDFCBANK,10,1030,10300,,\n';

    var helper = require('../helpers/test_helper.js');
    var parse = require('../../src/CsvParser.js');
    var make = require('../../src/Trade.js');

    var istream;
    beforeEach(function () {
        istream = helper.createStringStream(_csv_sample1);
    });

    it('should parse and return chronological trades', function (done) {
        var expected = [make.makeBuy('2008-07-13T18:30:00.000Z', 'HDFCBANK', 10, '1030', '69.01'),
            make.makeSale('2009-09-03T18:30:00.000Z', 'HDFC', 4, '2705', '75.09', 'Bonus'),
            make.makeBuy('2009-09-22T18:30:00.000Z', 'BALRAM', 83, '119.5', '66.45'),
            make.makeSale('2009-09-23T18:30:00.000Z', 'HDFCBANK', 10, '1607.1', '111.53')
        ];

        parse(istream, function (err, results) {
            expect(JSON.stringify(results.trades)).toEqual(JSON.stringify(expected));
            done();
        });
    });

    it('should parse and return dividends received in chronological order', function (done) {
        var dividends = [
            make.makeDividend('2010-08-16T18:30:00.000Z', 'VOLTAS', '200', ''),
            make.makeDividend('2015-07-14T18:30:00.000Z', 'AND BANK', '600', 'interim')
        ];

        parse(istream, function (err, results) {
            expect(JSON.stringify(results.dividends)).toEqual(JSON.stringify(dividends));
            done();
        });
    });
    xit('stock names should be case insensitive');

});

